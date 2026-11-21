/**
 * データ層
 * - Supabase が設定されていればクラウド同期（リアルタイム）
 * - 未設定なら localStorage でローカル動作（この端末のみ）
 *
 * 画面側は mode を気にせず同じ API を呼べるようにしています。
 */
window.Store = (function () {
  "use strict";

  var CFG = window.APP_CONFIG || {};
  var URL = String(CFG.SUPABASE_URL || "").trim();
  var KEY = String(CFG.SUPABASE_ANON_KEY || "").trim();
  var looksPlaceholder = function (v) {
    return !v || /YOUR_|ここに|example\.com/i.test(v);
  };
  var configured =
    /^https?:\/\//i.test(URL) && !!KEY && !looksPlaceholder(URL) && !looksPlaceholder(KEY);
  var sdkAvailable = !!(window.supabase && typeof window.supabase.createClient === "function");
  var client = null;

  if (configured && sdkAvailable) {
    try {
      client = window.supabase.createClient(URL, KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 8 } },
      });
    } catch (err) {
      console.error("[Store] Supabase init failed", err);
    }
  }

  var mode = client ? "cloud" : "local";
  var warnings = [];
  if (configured && !sdkAvailable) {
    warnings.push(
      "Supabase SDKを読み込めなかったため、ローカル保存モードで起動しました。通信環境を確認してください。"
    );
  }
  if (!configured) {
    warnings.push(
      "Supabase未設定のため、ローカル保存モードで動作中です。config.js を設定すると友達と共有できます。"
    );
  }

  var listeners = new Set();
  var channel = null;
  var LS_KEY = "chartlog.local.v1";

  /* ------------------------------------------------------------------ */
  /* ローカルストレージ                                                   */
  /* ------------------------------------------------------------------ */

  function emptyDB() {
    return { profiles: [], progress: {}, logs: [] };
  }

  function readLocal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return emptyDB();
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return emptyDB();
      if (!Array.isArray(data.profiles)) data.profiles = [];
      if (!Array.isArray(data.logs)) data.logs = [];
      if (!data.progress || typeof data.progress !== "object") data.progress = {};
      return data;
    } catch (err) {
      console.warn("[Store] local data broken, resetting", err);
      return emptyDB();
    }
  }

  function writeLocal(db) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(db));
    } catch (err) {
      console.error("[Store] localStorage write failed", err);
      throw new Error("ローカル保存に失敗しました（空き容量を確認してください）");
    }
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function normalizeName(raw) {
    return String(raw == null ? "" : raw)
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .replace(/\s+/g, " ");
  }

  /* ------------------------------------------------------------------ */
  /* 共通                                                                */
  /* ------------------------------------------------------------------ */

  function localProgressKey(bookId, section, no) {
    return bookId + ":" + section + ":" + no;
  }

  function assertRange(bookId, section, from, to, delta) {
    var book = window.CM.BOOK_MAP[bookId];
    if (!book) throw new Error("参考書が不正です");
    var max = book[section];
    if (!max) throw new Error("区分が不正です");
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > max || from > to) {
      throw new Error("1〜" + max + " の範囲で指定してください");
    }
    if (delta !== 1 && delta !== -1) throw new Error("操作が不正です");
    return { max: max, count: to - from + 1 };
  }

  /* ------------------------------------------------------------------ */
  /* クラウド API                                                        */
  /* ------------------------------------------------------------------ */

  var cloud = {
    listProfiles: async function () {
      var res = await client
        .from("profiles")
        .select("id,name,created_at")
        .order("created_at", { ascending: true });
      if (res.error) throw res.error;
      return res.data || [];
    },

    createProfile: async function (rawName) {
      var name = normalizeName(rawName);
      if (!name) throw new Error("名前を入力してください");
      if (Array.from(name).length > 16) throw new Error("名前は16文字以内にしてください");

      var res = await client.from("profiles").insert({ name: name }).select("id,name,created_at").single();
      if (!res.error) return res.data;

      // 同じ名前が既にある場合は、そのユーザーとしてログイン（名前で合流）
      if (res.error.code === "23505") {
        var found = await client
          .from("profiles")
          .select("id,name,created_at")
          .eq("name", name)
          .maybeSingle();
        if (!found.error && found.data) return found.data;
      }
      throw res.error;
    },

    getProgress: async function (userId, bookId) {
      var res = await client
        .from("problem_progress")
        .select("user_id,book_id,section,problem_no,count,weak,updated_at")
        .eq("user_id", userId)
        .eq("book_id", bookId);
      if (res.error) throw res.error;
      return res.data || [];
    },

    getStats: async function () {
      var res = await client.rpc("get_stats");
      if (res.error) throw res.error;
      return (res.data || []).map(function (row) {
        return {
          user_id: row.user_id,
          book_id: row.book_id,
          section: row.section,
          completed: Number(row.completed) || 0,
          weak_count: Number(row.weak_count) || 0,
          reps: Number(row.reps) || 0,
        };
      });
    },

    listLogs: async function (opts) {
      opts = opts || {};
      var query = client
        .from("study_logs")
        .select("id,user_id,book_id,section,from_no,to_no,amount,kind,created_at")
        .order("created_at", { ascending: false })
        .limit(opts.limit || 100);
      if (opts.since) query = query.gte("created_at", opts.since);
      if (opts.userId) query = query.eq("user_id", opts.userId);
      var res = await query;
      if (res.error) throw res.error;
      return res.data || [];
    },

    record: async function (payload) {
      assertRange(payload.bookId, payload.section, payload.from, payload.to, payload.delta);
      var res = await client.rpc("record_progress", {
        p_user: payload.userId,
        p_book: payload.bookId,
        p_section: payload.section,
        p_from: payload.from,
        p_to: payload.to,
        p_delta: payload.delta,
        p_kind: payload.kind || (payload.from === payload.to ? "single" : "range"),
      });
      if (res.error) throw res.error;
      return res.data;
    },

    setWeak: async function (payload) {
      var book = window.CM.BOOK_MAP[payload.bookId];
      if (!book || !book[payload.section]) throw new Error("参考書が不正です");
      if (!Number.isInteger(payload.no) || payload.no < 1 || payload.no > book[payload.section]) {
        throw new Error("問題番号が不正です");
      }
      var res = await client.rpc("set_weak", {
        p_user: payload.userId,
        p_book: payload.bookId,
        p_section: payload.section,
        p_no: payload.no,
        p_weak: !!payload.weak,
      });
      if (res.error) throw res.error;
      return true;
    },

    subscribe: function (cb) {
      if (channel) return;
      channel = client
        .channel("chartlog-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "study_logs" }, function () {
          cb("logs");
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "problem_progress" }, function () {
          cb("progress");
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, function () {
          cb("profiles");
        })
        .subscribe();
    },

    unsubscribe: function () {
      if (channel) {
        client.removeChannel(channel);
        channel = null;
      }
    },
  };

  /* ------------------------------------------------------------------ */
  /* ローカル API                                                        */
  /* ------------------------------------------------------------------ */

  var local = {
    listProfiles: async function () {
      return readLocal()
        .profiles.slice()
        .sort(function (a, b) {
          return String(a.created_at).localeCompare(String(b.created_at));
        });
    },

    createProfile: async function (rawName) {
      var name = normalizeName(rawName);
      if (!name) throw new Error("名前を入力してください");
      if (Array.from(name).length > 16) throw new Error("名前は16文字以内にしてください");

      var db = readLocal();
      var existing = db.profiles.find(function (p) {
        return p.name === name;
      });
      if (existing) return existing;

      var profile = { id: uid(), name: name, created_at: new Date().toISOString() };
      db.profiles.push(profile);
      writeLocal(db);
      return profile;
    },

    getProgress: async function (userId, bookId) {
      var db = readLocal();
      var bucket = db.progress[userId] || {};
      var prefix = bookId + ":";
      var rows = [];
      Object.keys(bucket).forEach(function (key) {
        if (key.indexOf(prefix) !== 0) return;
        var parts = key.split(":");
        if (parts.length !== 3) return;
        var row = bucket[key];
        rows.push({
          user_id: userId,
          book_id: parts[0],
          section: parts[1],
          problem_no: Number(parts[2]),
          count: Number(row.count) || 0,
          weak: !!row.weak,
          updated_at: row.updated_at || null,
        });
      });
      return rows;
    },

    getStats: async function () {
      var db = readLocal();
      var map = {};
      Object.keys(db.progress).forEach(function (userId) {
        var bucket = db.progress[userId] || {};
        Object.keys(bucket).forEach(function (key) {
          var parts = key.split(":");
          if (parts.length !== 3) return;
          var aggKey = userId + "|" + parts[0] + "|" + parts[1];
          if (!map[aggKey]) {
            map[aggKey] = {
              user_id: userId,
              book_id: parts[0],
              section: parts[1],
              completed: 0,
              weak_count: 0,
              reps: 0,
            };
          }
          var row = bucket[key];
          var count = Number(row.count) || 0;
          map[aggKey].reps += count;
          if (count > 0) map[aggKey].completed += 1;
          if (row.weak) map[aggKey].weak_count += 1;
        });
      });
      return Object.keys(map).map(function (k) {
        return map[k];
      });
    },

    listLogs: async function (opts) {
      opts = opts || {};
      var db = readLocal();
      var since = opts.since ? new Date(opts.since).getTime() : null;
      var logs = db.logs
        .filter(function (l) {
          if (opts.userId && l.user_id !== opts.userId) return false;
          if (since && new Date(l.created_at).getTime() < since) return false;
          return true;
        })
        .sort(function (a, b) {
          return new Date(b.created_at) - new Date(a.created_at);
        });
      return logs.slice(0, opts.limit || 100);
    },

    record: async function (payload) {
      var checked = assertRange(payload.bookId, payload.section, payload.from, payload.to, payload.delta);
      var db = readLocal();
      var bucket = db.progress[payload.userId] || (db.progress[payload.userId] = {});
      var now = new Date().toISOString();

      for (var no = payload.from; no <= payload.to; no++) {
        var key = localProgressKey(payload.bookId, payload.section, no);
        var current = bucket[key] || { count: 0, weak: false };
        current.count = Math.max(0, (Number(current.count) || 0) + payload.delta);
        current.updated_at = now;
        bucket[key] = current;
      }

      db.logs.push({
        id: uid(),
        user_id: payload.userId,
        book_id: payload.bookId,
        section: payload.section,
        from_no: payload.from,
        to_no: payload.to,
        amount: checked.count * payload.delta,
        kind: payload.kind || (payload.from === payload.to ? "single" : "range"),
        created_at: now,
      });
      if (db.logs.length > 4000) db.logs = db.logs.slice(-4000);
      writeLocal(db);
      return checked.count;
    },

    setWeak: async function (payload) {
      var book = window.CM.BOOK_MAP[payload.bookId];
      if (!book || !book[payload.section]) throw new Error("参考書が不正です");
      if (!Number.isInteger(payload.no) || payload.no < 1 || payload.no > book[payload.section]) {
        throw new Error("問題番号が不正です");
      }
      var db = readLocal();
      var bucket = db.progress[payload.userId] || (db.progress[payload.userId] = {});
      var key = localProgressKey(payload.bookId, payload.section, payload.no);
      var current = bucket[key] || { count: 0, weak: false };
      current.weak = !!payload.weak;
      current.updated_at = new Date().toISOString();
      bucket[key] = current;
      writeLocal(db);
      return true;
    },

    subscribe: function (cb) {
      window.addEventListener("storage", function (event) {
        if (event.key === LS_KEY) cb("storage");
      });
    },

    unsubscribe: function () {},

    clear: function () {
      try {
        localStorage.removeItem(LS_KEY);
      } catch (err) {
        /* noop */
      }
    },
  };

  var api = mode === "cloud" ? cloud : local;
  if (mode === "local") api.clear = local.clear;

  return {
    mode: mode,
    configured: configured,
    warnings: warnings,
    listProfiles: api.listProfiles,
    createProfile: api.createProfile,
    getProgress: api.getProgress,
    getStats: api.getStats,
    listLogs: api.listLogs,
    record: api.record,
    setWeak: api.setWeak,
    subscribe: api.subscribe,
    unsubscribe: api.unsubscribe,
    clearLocal: local.clear,
    config: {
      urlHost: (function () {
        try {
          return URL ? new URL(URL).host : "";
        } catch (err) {
          return "";
        }
      })(),
    },
  };
})();
