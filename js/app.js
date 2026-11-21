/* チャートログ — 青チャート進捗共有アプリ */
(function () {
  "use strict";

  var CM = window.CM;
  var Store = window.Store;
  var BOOKS = CM.BOOKS;
  var SECTIONS = CM.SECTIONS;
  var esc = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  };

  /* ------------------------------------------------------------------ */
  /* アイコン                                                            */
  /* ------------------------------------------------------------------ */

  var ICON = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.2 2.4c.3 3.2-.8 4.7-2.2 6.2-1.3 1.4-2.8 3-2.8 5.7 0 1.3.5 2.5 1.3 3.4-.1-1.7.5-3 1.7-4.2-.1 2.4.8 3.7 1.8 4.8.7.8 1.1 1.6 1.1 2.6 0 .4-.1.8-.2 1.2 2.8-1 4.6-3.7 4.6-6.8 0-3-1.5-5.4-3.1-7.2-1.3-1.5-2.5-2.8-2.2-5.7z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3.5 19.5c0-3 2.4-5 5.5-5s5.5 2 5.5 5"/><circle cx="17" cy="9" r="2.2"/><path d="M16 14.6c2.6.3 4.5 2.1 4.5 4.4"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v3.5a4 4 0 0 1-8 0V4Z"/><path d="M8 5.5H5v1.8A3.2 3.2 0 0 0 8 10.5M16 5.5h3v1.8a3.2 3.2 0 0 1-3 3.2"/><path d="M12 11.5V16M9 20h6M10.5 16h3v4h-3z"/></svg>',
    weak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l9 16H3l9-16Z"/><path d="M12 9.5v4.2M12 16.7v.1"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/></svg>'
  };

  var NAV = [
    { id: "record", label: "記録" },
    { id: "together", label: "みんな" },
    { id: "ranking", label: "ランキング" },
    { id: "mine", label: "マイ" }
  ];

  ICON.navRecord = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3.5" width="16" height="17" rx="3.5"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/></svg>';
  ICON.navTogether = ICON.users;
  ICON.navRanking = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5.5 20v-6M12 20V4M18.5 20v-9"/></svg>';
  ICON.navMine = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>';

  /* ------------------------------------------------------------------ */
  /* 状態                                                                */
  /* ------------------------------------------------------------------ */

  var state = {
    booted: false,
    loading: true,
    fatal: null,
    mode: Store.mode,
    onboardingOpen: false,
    meId: null,
    me: null,
    profiles: [],
    view: "record",
    bookId: "1",
    section: "example",
    progress: [],
    stats: [],
    statsIndex: {},
    logs: [],
    myLogs: [],
    gridMode: "record",
    weakOnly: false,
    rankPeriod: "week",
    syncError: null,
    refreshing: false
  };

  var progMaps = { example: new Map(), exercise: new Map() };
  var cellEls = new Map();
  var pressState = null;
  var sheetContext = null;
  var toastAction = null;
  var toastTimer = null;
  var toastToken = 0;
  var sheetToken = 0;
  var refreshTimer = null;
  var refreshing = false;
  var refreshQueued = false;
  var lastBgError = 0;

  var appEl = document.getElementById("app");
  var topbarEl = document.getElementById("topbar");
  var viewEl = document.getElementById("view");
  var navEl = document.getElementById("tabbar");
  var fabEl = document.getElementById("fab-root");
  var sheetRoot = document.getElementById("sheet-root");
  var toastRoot = document.getElementById("toast-root");
  var onboardRoot = document.getElementById("onboarding-root");

  /* ------------------------------------------------------------------ */
  /* 小物                                                                */
  /* ------------------------------------------------------------------ */

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function keyOf(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  function parseKey(key) {
    var parts = key.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function startOfDay(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function startOfWeek() {
    var d = startOfDay(new Date());
    var day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
  }

  function startOfMonth() {
    var d = startOfDay(new Date());
    d.setDate(1);
    return d;
  }

  function avatarClass(name) {
    var hash = 0;
    Array.from(String(name || "?")).forEach(function (ch) {
      hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
    });
    return "av-" + (hash % 6);
  }

  function avatar(name, size) {
    var initial = Array.from(String(name || "?"))[0] || "?";
    return '<span class="avatar ' + avatarClass(name) + " " + (size || "sm") + '" aria-hidden="true">' + esc(initial) + "</span>";
  }

  function relativeTime(iso) {
    var date = new Date(iso);
    var now = new Date();
    var diff = now.getTime() - date.getTime();
    if (diff < 0) diff = 0;
    if (diff < 60 * 1000) return "たった今";
    if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + "分前";
    if (keyOf(date) === keyOf(now)) return pad2(date.getHours()) + ":" + pad2(date.getMinutes());
    if (keyOf(date) === keyOf(new Date(now.getTime() - 86400000))) return "昨日";
    return date.getMonth() + 1 + "/" + date.getDate();
  }

  function dayLabel(key) {
    if (key === keyOf(new Date())) return "今日";
    if (key === keyOf(new Date(Date.now() - 86400000))) return "昨日";
    var d = parseKey(key);
    return d.getMonth() + 1 + "月" + d.getDate() + "日（" + "日月火水木金土"[d.getDay()] + "）";
  }

  function joinedLabel(iso) {
    if (!iso) return "参加中";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "参加中";
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月から参加";
  }

  function friendlyError(err) {
    var msg = (err && (err.message || err.error_description || err.details || err.hint)) || "";
    if (!msg) msg = "通信に失敗しました。もう一度お試しください。";
    if (/relation .* does not exist|Could not find the table|schema cache|PGRST205/i.test(msg)) {
      return "Supabaseのテーブルが見つかりません。supabase/schema.sql を実行してください。";
    }
    if (/function .* does not exist|Could not find the function|PGRST202/i.test(msg)) {
      return "Supabaseの関数が見つかりません。supabase/schema.sql を実行してください。";
    }
    if (/row-level security|permission denied/i.test(msg)) {
      return "データの書き込みが拒否されました。Supabaseのポリシー設定を確認してください。";
    }
    if (/duplicate key|23505/i.test(msg)) {
      return "同じ名前がすでに使われています。その名前を選んでログインしてください。";
    }
    if (/Failed to fetch|NetworkError|fetch failed|Load failed/i.test(msg)) {
      return "サーバーに接続できません。通信環境を確認してください。";
    }
    return msg;
  }

  function vibrate(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (err) {
      /* noop */
    }
  }

  /* ------------------------------------------------------------------ */
  /* 集計                                                                */
  /* ------------------------------------------------------------------ */

  function buildProgressMaps() {
    progMaps = { example: new Map(), exercise: new Map() };
    (state.progress || []).forEach(function (row) {
      var section = row.section;
      if (section !== "example" && section !== "exercise") return;
      progMaps[section].set(Number(row.problem_no), {
        count: Number(row.count) || 0,
        weak: !!row.weak
      });
    });
  }

  function getProg(section, no) {
    var found = progMaps[section] && progMaps[section].get(no);
    return found || { count: 0, weak: false };
  }

  function setProg(section, no, value) {
    var next = { count: Math.max(0, Number(value.count) || 0), weak: !!value.weak };
    progMaps[section].set(no, next);

    var row = null;
    for (var i = 0; i < state.progress.length; i++) {
      if (state.progress[i].section === section && Number(state.progress[i].problem_no) === no) {
        row = state.progress[i];
        break;
      }
    }
    var stamp = new Date().toISOString();
    if (row) {
      row.count = next.count;
      row.weak = next.weak;
      row.updated_at = stamp;
    } else {
      state.progress.push({
        user_id: state.meId,
        book_id: state.bookId,
        section: section,
        problem_no: no,
        count: next.count,
        weak: next.weak,
        updated_at: stamp
      });
    }
  }

  function countDone(section) {
    var n = 0;
    progMaps[section].forEach(function (item) {
      if (item.count > 0) n++;
    });
    return n;
  }

  function buildStatsIndex() {
    var index = {};
    (state.stats || []).forEach(function (row) {
      var bucket = index[row.user_id] || (index[row.user_id] = {});
      var book = bucket[row.book_id] || (bucket[row.book_id] = {
        completed: 0, weak: 0, reps: 0,
        example: { completed: 0, reps: 0 },
        exercise: { completed: 0, reps: 0 }
      });
      book.completed += Number(row.completed) || 0;
      book.weak += Number(row.weak_count) || 0;
      book.reps += Number(row.reps) || 0;
      if (book[row.section]) {
        book[row.section].completed += Number(row.completed) || 0;
        book[row.section].reps += Number(row.reps) || 0;
      }
    });
    return index;
  }

  function statsFor(userId, bookId) {
    var user = state.statsIndex[userId];
    if (!user) return { completed: 0, weak: 0, reps: 0, example: { completed: 0, reps: 0 }, exercise: { completed: 0, reps: 0 } };
    return user[bookId] || { completed: 0, weak: 0, reps: 0, example: { completed: 0, reps: 0 }, exercise: { completed: 0, reps: 0 } };
  }

  function totalsFor(userId) {
    var user = state.statsIndex[userId] || {};
    var totals = { completed: 0, weak: 0, reps: 0 };
    Object.keys(user).forEach(function (bookId) {
      totals.completed += user[bookId].completed;
      totals.weak += user[bookId].weak;
      totals.reps += user[bookId].reps;
    });
    totals.percent = Math.min(100, Math.round((totals.completed / CM.GRAND_TOTAL) * 100));
    return totals;
  }

  function percentOf(userId, bookId) {
    var book = CM.bookById(bookId);
    var done = statsFor(userId, bookId).completed;
    return Math.min(100, Math.round((done / CM.bookTotal(book)) * 100));
  }

  function liveCompleted() {
    return countDone("example") + countDone("exercise");
  }

  function livePercent() {
    var book = CM.bookById(state.bookId);
    return Math.min(100, Math.round((liveCompleted() / CM.bookTotal(book)) * 100));
  }

  function todayCount() {
    var key = keyOf(new Date());
    var n = 0;
    state.myLogs.forEach(function (log) {
      if (keyOf(new Date(log.created_at)) === key) n += Number(log.amount) || 0;
    });
    return Math.max(0, n);
  }

  function todayCountAll() {
    var key = keyOf(new Date());
    var n = 0;
    state.logs.forEach(function (log) {
      if (keyOf(new Date(log.created_at)) === key) n += Number(log.amount) || 0;
    });
    return Math.max(0, n);
  }

  function weekData() {
    var base = startOfDay(new Date());
    var arr = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(base);
      d.setDate(d.getDate() - i);
      arr.push({
        date: d,
        key: keyOf(d),
        label: "日月火水木金土"[d.getDay()],
        count: 0,
        today: i === 0
      });
    }
    var map = new Map();
    arr.forEach(function (item) { map.set(item.key, item); });
    state.myLogs.forEach(function (log) {
      var item = map.get(keyOf(new Date(log.created_at)));
      if (item) item.count += Number(log.amount) || 0;
    });
    arr.forEach(function (item) { item.count = Math.max(0, item.count); });
    return arr;
  }

  function streakDays() {
    var days = new Set();
    state.myLogs.forEach(function (log) {
      if (Number(log.amount) > 0) days.add(keyOf(new Date(log.created_at)));
    });
    var cursor = startOfDay(new Date());
    if (!days.has(keyOf(cursor))) cursor.setDate(cursor.getDate() - 1);
    var streak = 0;
    while (days.has(keyOf(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function heatStyle(pct) {
    if (!pct) return "background:#F4F1E9;color:#A8A296";
    var t = Math.min(1, pct / 100);
    var alpha = 0.12 + 0.78 * t;
    return "background:rgba(42,91,215," + alpha.toFixed(3) + ");color:" + (alpha > 0.55 ? "#FFFFFF" : "#173C93");
  }

  /* ------------------------------------------------------------------ */
  /* データ読み込み                                                       */
  /* ------------------------------------------------------------------ */

  function sinceStart() {
    var week = startOfWeek().getTime();
    var month = startOfMonth().getTime();
    return new Date(Math.min(week, month)).toISOString();
  }

  async function loadAll() {
    if (!state.meId) return;
    state.loading = true;
    state.fatal = null;
    state.syncError = null;
    render();

    var meId = state.meId;
    try {
      var results = await Promise.all([
        Store.getProgress(meId, state.bookId),
        Store.getStats(),
        Store.listLogs({ since: sinceStart(), limit: 3000 }),
        Store.listLogs({ userId: meId, limit: 400 })
      ]);
      if (state.meId !== meId) return;
      state.progress = results[0] || [];
      state.stats = results[1] || [];
      state.logs = results[2] || [];
      state.myLogs = results[3] || [];
      state.loading = false;
      state.fatal = null;
      render();
    } catch (err) {
      console.error(err);
      if (state.meId !== meId) return;
      state.loading = false;
      state.fatal = err;
      render();
    }
  }

  async function reloadBook() {
    if (!state.meId) return;
    var bookId = state.bookId;
    try {
      var rows = await Store.getProgress(state.meId, bookId);
      if (state.bookId !== bookId) return;
      state.progress = rows || [];
      render();
    } catch (err) {
      toast(friendlyError(err));
    }
  }

  function scheduleLiveRefresh(delay) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshLive, delay == null ? 300 : delay);
  }

  async function refreshLive() {
    if (!state.meId) return;
    if (refreshing) {
      refreshQueued = true;
      return;
    }
    refreshing = true;
    state.refreshing = true;
    try {
      var meId = state.meId;
      var results = await Promise.all([
        Store.getProgress(meId, state.bookId),
        Store.getStats(),
        Store.listLogs({ since: sinceStart(), limit: 3000 }),
        Store.listLogs({ userId: meId, limit: 400 })
      ]);
      if (state.meId !== meId) return;
      state.progress = results[0] || [];
      state.stats = results[1] || [];
      state.logs = results[2] || [];
      state.myLogs = results[3] || [];
      state.syncError = null;
      render();
    } catch (err) {
      console.warn("[sync]", err);
      state.syncError = err;
      if (Date.now() - lastBgError > 15000) {
        lastBgError = Date.now();
        toast(friendlyError(err));
      }
    } finally {
      refreshing = false;
      state.refreshing = false;
      if (refreshQueued) {
        refreshQueued = false;
        scheduleLiveRefresh(250);
      }
    }
  }

  async function refreshProfiles() {
    try {
      var profiles = await Store.listProfiles();
      state.profiles = profiles || [];
      state.me = state.profiles.find(function (p) { return p.id === state.meId; }) || null;
      if (!state.me) {
        state.meId = null;
        try { localStorage.removeItem("chartlog.me"); } catch (err) { /* noop */ }
        openOnboarding();
      }
      render();
    } catch (err) {
      console.warn("[profiles]", err);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 画面の骨格                                                          */
  /* ------------------------------------------------------------------ */

  function renderTopbar() {
    var me = state.me;
    var modePill = state.mode === "cloud"
      ? '<span class="live-pill"><i></i>LIVE</span>'
      : '<span class="mode-pill">LOCAL</span>';

    topbarEl.innerHTML =
      '<button class="brand" data-action="view" data-view="record" aria-label="記録画面へ">' +
        '<span class="brand-mark">チ</span>' +
        '<span class="brand-text"><b>チャートログ</b><small>青チャート進捗ノート</small></span>' +
      "</button>" +
      '<div class="topbar-right">' +
        modePill +
        (me
          ? '<button class="me-chip" data-action="open-profiles" aria-label="ユーザーを切り替え">' +
              avatar(me.name, "sm") +
              '<span class="me-name">' + esc(me.name) + "</span>" +
              '<span class="me-chev">' + ICON.chevron + "</span>" +
            "</button>"
          : "") +
      "</div>";
  }

  function renderNav() {
    var icons = {
      record: ICON.navRecord,
      together: ICON.navTogether,
      ranking: ICON.navRanking,
      mine: ICON.navMine
    };
    navEl.innerHTML = NAV.map(function (item) {
      return (
        '<button class="tab ' + (state.view === item.id ? "on" : "") + '" data-action="view" data-view="' + item.id + '"' +
          (state.view === item.id ? ' aria-current="page"' : "") + ">" +
          '<span class="tab-ico">' + icons[item.id] + "</span>" +
          '<span class="tab-label">' + item.label + "</span>" +
        "</button>"
      );
    }).join("");
  }

  function renderFab() {
    fabEl.innerHTML = "";
  }

  function render() {
    if (pressState) cancelPress();
    state.statsIndex = buildStatsIndex();
    buildProgressMaps();
    renderTopbar();
    renderNav();
    renderFab();

    if (state.fatal) {
      viewEl.innerHTML = renderFatal();
      return;
    }
    if (state.loading) {
      viewEl.innerHTML = renderSkeleton();
      return;
    }
    if (!state.me) {
      viewEl.innerHTML = renderGuest();
      return;
    }

    if (state.view === "record") viewEl.innerHTML = renderRecord();
    else if (state.view === "together") viewEl.innerHTML = renderTogether();
    else if (state.view === "ranking") viewEl.innerHTML = renderRanking();
    else viewEl.innerHTML = renderMine();

    if (state.syncError) {
      var banner = document.createElement("div");
      banner.className = "banner-error";
      banner.innerHTML = '<span>同期に失敗しました</span><button data-action="retry">再試行</button>';
      viewEl.prepend(banner);
    }

    cellEls = new Map();
    viewEl.querySelectorAll(".pcell").forEach(function (el) {
      cellEls.set(state.section + ":" + el.dataset.no, el);
    });
  }

  function setView(view) {
    if (!view || view === state.view) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    state.view = view;
    closeSheet();
    render();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderSkeleton() {
    return (
      '<div class="skeleton-view" aria-busy="true" aria-label="読み込み中">' +
        '<div class="sk sk-hero"></div>' +
        '<div class="sk-chips">' + '<div class="sk sk-chip"></div>'.repeat(3) + "</div>" +
        '<div class="sk sk-card"></div>' +
        '<div class="sk sk-card tall"></div>' +
      "</div>"
    );
  }

  function renderGuest() {
    return (
      '<section class="guest">' +
        '<div class="guest-mark">チ</div>' +
        "<h1>チャートログ</h1>" +
        "<p>青チャートの進捗を、みんなで。</p>" +
        '<button class="btn-primary btn-lg" data-action="open-onboarding">はじめる</button>' +
      "</section>"
    );
  }

  function renderFatal() {
    return (
      '<section class="fatal card">' +
        '<span class="fatal-ico">!</span>' +
        "<h2>データを読み込めませんでした</h2>" +
        "<p>" + esc(friendlyError(state.fatal)) + "</p>" +
        '<button class="btn-primary" data-action="retry">再試行</button>' +
        '<button class="btn-ghost" data-action="open-setup">接続ガイドを見る</button>' +
        (state.meId ? '<button class="link-btn" data-action="forget-me">別のユーザーを選ぶ</button>' : "") +
      "</section>"
    );
  }

  /* ------------------------------------------------------------------ */
  /* 記録画面                                                            */
  /* ------------------------------------------------------------------ */

  function renderRecord() {
    var me = state.me;
    if (!me) return renderGuest();
    var book = CM.bookById(state.bookId);
    var section = state.section;
    var label = SECTIONS[section].label;
    var secTotal = CM.sectionTotal(book, section);
    var done = countDone(section);
    var exampleDone = countDone("example");
    var exerciseDone = countDone("exercise");
    var totalDone = exampleDone + exerciseDone;
    var total = CM.bookTotal(book);
    var pct = Math.min(100, Math.round((totalDone / total) * 100));
    var secPct = Math.min(100, Math.round((done / secTotal) * 100));

    var cells = [];
    for (var no = 1; no <= secTotal; no++) {
      var progress = getProg(section, no);
      if (state.weakOnly && !progress.weak) continue;
      cells.push(cellHTML(no, progress, label));
    }

    var gridContent = cells.length
      ? cells.join("")
      : '<div class="empty-inline">' +
          (state.weakOnly
            ? "苦手チェックした問題はまだありません。<br>「苦手」モードで問題をタップすると追加できます。"
            : "表示できる問題がありません。") +
        "</div>";

    return (
      heroHTML() +
      '<div class="book-scroller" aria-label="参考書を選択">' +
        BOOKS.map(function (b) {
          var selected = b.id === state.bookId;
          var chipPct = selected ? livePercent() : percentOf(me.id, b.id);
          return (
            '<button class="book-chip ' + (selected ? "on" : "") + '" data-action="book" data-book="' + b.id + '" aria-pressed="' + selected + '">' +
              '<span class="bc-top">' +
                '<span class="bc-num" style="background:' + b.soft + ";color:" + b.color + '">' + b.numeral + "</span>" +
                '<span class="bc-pct" data-book-pct="' + b.id + '">' + chipPct + "%</span>" +
              "</span>" +
              '<span class="bc-name">' + esc(b.name) + "</span>" +
              '<span class="bc-track"><i data-book-bar="' + b.id + '" style="width:' + chipPct + "%;background:" + b.color + '"></i></span>' +
            "</button>"
          );
        }).join("") +
      "</div>" +

      '<section class="card record-card">' +
        '<div class="rc-head">' +
          '<div class="rc-book">' +
            '<span class="rc-badge" style="background:' + book.soft + ";color:" + book.color + '">' + book.numeral + "</span>" +
            "<div><h2>" + esc(book.name) + "</h2>" +
              '<p id="rcSub">' + totalDone + " / " + total + "問 完了</p>" +
            "</div>" +
          "</div>" +
          '<div class="rc-percent" id="rcPct">' + pct + "<span>%</span></div>" +
        "</div>" +

        '<div class="seg" role="tablist" aria-label="例題とEXの切り替え">' +
          '<button class="seg-btn ' + (section === "example" ? "on" : "") + '" data-action="section" data-section="example" role="tab" aria-selected="' + (section === "example") + '">' +
            "<span>例題</span><em id=\"segCountExample\">" + exampleDone + "/" + book.example + "</em>" +
          "</button>" +
          '<button class="seg-btn ' + (section === "exercise" ? "on" : "") + '" data-action="section" data-section="exercise" role="tab" aria-selected="' + (section === "exercise") + '">' +
            "<span>EX</span><em id=\"segCountExercise\">" + exerciseDone + "/" + book.exercise + "</em>" +
          "</button>" +
        "</div>" +

        '<button class="range-btn" data-action="open-range">' +
          '<span class="range-btn-ico">' + ICON.plus + "</span>" +
          '<span class="range-btn-body"><b>範囲で記録</b><small>「12〜30」をまとめて +1</small></span>' +
          '<span class="range-btn-chev">' + ICON.chevron + "</span>" +
        "</button>" +

        '<div class="rc-toolbar">' +
          '<div class="mini-seg" role="group" aria-label="タップしたときの動作">' +
            '<button class="' + (state.gridMode === "record" ? "on" : "") + '" data-action="grid-mode" data-mode="record" aria-pressed="' + (state.gridMode === "record") + '">＋1 記録</button>' +
            '<button class="' + (state.gridMode === "weak" ? "on" : "") + '" data-action="grid-mode" data-mode="weak" aria-pressed="' + (state.gridMode === "weak") + '">苦手</button>' +
          "</div>" +
          '<button class="ghost-toggle ' + (state.weakOnly ? "on" : "") + '" data-action="weak-filter" aria-pressed="' + state.weakOnly + '">' +
            '<span class="gt-dot"></span>苦手のみ' +
          "</button>" +
        "</div>" +

        '<div class="rc-meter">' +
          '<div class="rc-meter-bar"><i id="segBar" style="width:' + secPct + '%"></i></div>' +
          '<span id="segDone">' + done + " / " + secTotal + "</span>" +
        "</div>" +

        '<div class="grid" id="grid" data-section="' + section + '">' + gridContent + "</div>" +
        '<p class="grid-hint">' +
          (state.gridMode === "record"
            ? "タップで +1 ・ 長押しで −1"
            : "タップで苦手フラグをオン / オフ") +
        "</p>" +
      "</section>" +

      '<p class="record-foot">' + esc(book.name) + " ・ " + label + " 全" + secTotal + "問</p>"
    );
  }

  function heroHTML() {
    var today = todayCount();
    var reps = totalsFor(state.meId).reps;
    var streak = streakDays();
    var week = weekData();
    var max = 1;
    week.forEach(function (d) { if (d.count > max) max = d.count; });
    var bars = week.map(function (d) {
      var height = d.count === 0 ? 7 : Math.max(14, Math.round((d.count / max) * 100));
      return (
        '<div class="wk ' + (d.today ? "today" : "") + (d.count === 0 ? " zero" : "") + '" title="' + d.label + " " + d.count + '問">' +
          '<span class="wk-bar"><i style="height:' + height + '%"></i></span>' +
          '<span class="wk-day">' + d.label + "</span>" +
        "</div>"
      );
    }).join("");
    var now = new Date();

    return (
      '<section class="hero">' +
        '<span class="hero-orb orb-a"></span><span class="hero-orb orb-b"></span>' +
        '<div class="hero-top">' +
          '<span class="hero-kicker">TODAY ・ ' + (now.getMonth() + 1) + "/" + now.getDate() + " " + "日月火水木金土"[now.getDay()] + "</span>" +
          '<span class="streak" id="heroStreak">' + ICON.flame + "<b>" + streak + "</b>日連続</span>" +
        "</div>" +
        '<div class="hero-main">' +
          '<div class="hero-count"><span id="heroToday">' + today + '</span><span class="hero-unit">問</span></div>' +
          '<div class="hero-total"><span>累計演習</span><b id="heroReps">' + reps + "<small>回</small></b></div>" +
        "</div>" +
        '<div class="week-chart" id="weekChart">' + bars + "</div>" +
      "</section>"
    );
  }

  function cellHTML(no, progress, label) {
    var count = progress.count;
    var weak = progress.weak;
    var level = count >= 3 ? 3 : count;
    var caption = count > 1 ? '<span class="pc-cap">×' + count + "</span>" : "";
    var dot = weak ? '<span class="pc-dot" aria-hidden="true"></span>' : "";
    return (
      '<button type="button" class="pcell" data-no="' + no + '" data-level="' + level + '" data-weak="' + (weak ? 1 : 0) + '"' +
        ' aria-pressed="' + (count > 0) + '"' +
        ' aria-label="' + esc(label + no + "番 " + count + "回" + (weak ? " 苦手" : "")) + '">' +
        '<span class="pc-num">' + no + "</span>" + caption + dot +
      "</button>"
    );
  }

  function applyCell(el, no, progress, label) {
    var count = progress.count;
    var weak = progress.weak;
    el.dataset.level = count >= 3 ? 3 : count;
    el.dataset.weak = weak ? "1" : "0";
    el.setAttribute("aria-pressed", count > 0 ? "true" : "false");
    el.setAttribute("aria-label", label + no + "番 " + count + "回" + (weak ? " 苦手" : ""));
    el.innerHTML =
      '<span class="pc-num">' + no + "</span>" +
      (count > 1 ? '<span class="pc-cap">×' + count + "</span>" : "") +
      (weak ? '<span class="pc-dot" aria-hidden="true"></span>' : "");
  }

  function syncRecordSummary() {
    if (state.view !== "record" || !state.me) return;
    var book = CM.bookById(state.bookId);
    var section = state.section;
    var total = CM.bookTotal(book);
    var totalDone = liveCompleted();
    var pct = Math.min(100, Math.round((totalDone / total) * 100));
    var secTotal = CM.sectionTotal(book, section);
    var done = countDone(section);
    var secPct = Math.min(100, Math.round((done / secTotal) * 100));

    var rcPct = document.getElementById("rcPct");
    if (rcPct) rcPct.innerHTML = pct + "<span>%</span>";
    var rcSub = document.getElementById("rcSub");
    if (rcSub) rcSub.textContent = totalDone + " / " + total + "問 完了";
    var exLabel = document.getElementById("segCountExample");
    if (exLabel) exLabel.textContent = countDone("example") + "/" + book.example;
    var exEx = document.getElementById("segCountExercise");
    if (exEx) exEx.textContent = countDone("exercise") + "/" + book.exercise;
    var bar = document.getElementById("segBar");
    if (bar) bar.style.width = secPct + "%";
    var segDone = document.getElementById("segDone");
    if (segDone) segDone.textContent = done + " / " + secTotal;

    var chipPct = document.querySelector('[data-book-pct="' + book.id + '"]');
    if (chipPct) chipPct.textContent = pct + "%";
    var chipBar = document.querySelector('[data-book-bar="' + book.id + '"]');
    if (chipBar) chipBar.style.width = pct + "%";
  }

  function refreshHero() {
    if (state.view !== "record") return;
    var todayEl = document.getElementById("heroToday");
    if (!todayEl) return;
    todayEl.textContent = todayCount();
    var repsEl = document.getElementById("heroReps");
    if (repsEl) repsEl.innerHTML = totalsFor(state.meId).reps + "<small>回</small>";
    var streakEl = document.getElementById("heroStreak");
    if (streakEl) streakEl.innerHTML = ICON.flame + "<b>" + streakDays() + "</b>日連続";

    var weekEl = document.getElementById("weekChart");
    if (!weekEl) return;
    var week = weekData();
    var max = 1;
    week.forEach(function (d) { if (d.count > max) max = d.count; });
    weekEl.innerHTML = week.map(function (d) {
      var height = d.count === 0 ? 7 : Math.max(14, Math.round((d.count / max) * 100));
      return (
        '<div class="wk ' + (d.today ? "today" : "") + (d.count === 0 ? " zero" : "") + '" title="' + d.label + " " + d.count + '問">' +
          '<span class="wk-bar"><i style="height:' + height + '%"></i></span>' +
          '<span class="wk-day">' + d.label + "</span>" +
        "</div>"
      );
    }).join("");
  }

  function flashCell(no, delta) {
    var el = cellEls.get(state.section + ":" + no);
    if (!el) return;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    var float = document.createElement("span");
    float.className = "pc-float " + (delta > 0 ? "up" : "down");
    float.textContent = delta > 0 ? "+1" : "−1";
    el.appendChild(float);
    setTimeout(function () {
      if (float.parentNode) float.parentNode.removeChild(float);
    }, 720);
  }

  function pushOptimisticLog(payload) {
    var log = {
      id: "tmp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      user_id: state.meId,
      book_id: payload.bookId,
      section: payload.section,
      from_no: payload.from,
      to_no: payload.to,
      amount: (payload.to - payload.from + 1) * payload.delta,
      kind: payload.kind,
      created_at: new Date().toISOString(),
      pending: true
    };
    state.logs.unshift(log);
    state.myLogs.unshift(log);
    return log.id;
  }

  function removeOptimisticLog(id) {
    state.logs = state.logs.filter(function (log) { return log.id !== id; });
    state.myLogs = state.myLogs.filter(function (log) { return log.id !== id; });
  }

  function bump(no, delta) {
    if (!state.me || state.loading) return;
    var section = state.section;
    var bookId = state.bookId;
    var current = getProg(section, no);
    var next = Math.max(0, current.count + delta);
    if (next === current.count) {
      if (delta < 0) toast("これ以上は戻せません");
      return;
    }
    var previous = { count: current.count, weak: current.weak };
    setProg(section, no, { count: next, weak: current.weak });
    var tempId = pushOptimisticLog({
      bookId: bookId, section: section, from: no, to: no, delta: delta,
      kind: delta > 0 ? "single" : "undo"
    });
    var el = cellEls.get(section + ":" + no);
    if (el) applyCell(el, no, getProg(section, no), SECTIONS[section].label);
    flashCell(no, delta);
    refreshHero();
    syncRecordSummary();
    vibrate(delta > 0 ? 8 : 12);

    Store.record({
      userId: state.meId, bookId: bookId, section: section,
      from: no, to: no, delta: delta, kind: delta > 0 ? "single" : "undo"
    }).then(function () {
      scheduleLiveRefresh(delta > 0 ? 900 : 400);
    }).catch(function (err) {
      if (state.bookId === bookId) {
        setProg(section, no, previous);
        var cell = cellEls.get(section + ":" + no);
        if (cell) applyCell(cell, no, getProg(section, no), SECTIONS[section].label);
      }
      removeOptimisticLog(tempId);
      refreshHero();
      syncRecordSummary();
      toast(friendlyError(err));
    });
  }

  function toggleWeak(no) {
    if (!state.me || state.loading) return;
    var section = state.section;
    var bookId = state.bookId;
    var current = getProg(section, no);
    var next = !current.weak;
    setProg(section, no, { count: current.count, weak: next });
    var el = cellEls.get(section + ":" + no);
    if (el) {
      applyCell(el, no, getProg(section, no), SECTIONS[section].label);
      el.classList.remove("pop");
      void el.offsetWidth;
      el.classList.add("pop");
    }
    vibrate(8);

    if (state.weakOnly && !next && el) {
      el.classList.add("leaving");
      setTimeout(function () {
        if (state.view === "record") render();
      }, 220);
    }

    Store.setWeak({
      userId: state.meId, bookId: bookId, section: section, no: no, weak: next
    }).then(function () {
      scheduleLiveRefresh(700);
    }).catch(function (err) {
      if (state.bookId === bookId) {
        setProg(section, no, current);
        var cell = cellEls.get(section + ":" + no);
        if (cell) applyCell(cell, no, getProg(section, no), SECTIONS[section].label);
      }
      toast(friendlyError(err));
    });
  }

  function handleCell(no, delta) {
    if (!state.me) return;
    if (state.gridMode === "weak") {
      toggleWeak(no);
      return;
    }
    bump(no, delta);
  }

  function firstIncomplete(section) {
    var book = CM.bookById(state.bookId);
    var total = CM.sectionTotal(book, section);
    for (var no = 1; no <= total; no++) {
      if (getProg(section, no).count === 0) return no;
    }
    return null;
  }

  function lastLogFor(bookId, section) {
    for (var i = 0; i < state.myLogs.length; i++) {
      var log = state.myLogs[i];
      if (log.book_id === bookId && log.section === section && Number(log.amount) > 0) return log;
    }
    return null;
  }

  function rangeDefaults(bookId, section) {
    var book = CM.bookById(bookId);
    var total = CM.sectionTotal(book, section);
    var last = lastLogFor(bookId, section);
    var first = firstIncomplete(section);
    var from;
    if (last && Number(last.to_no) < total) from = Number(last.to_no) + 1;
    else from = first || 1;
    from = Math.min(Math.max(1, from), total);
    return { from: from, to: Math.min(total, from + 9), total: total, last: last };
  }

  function openRangeSheet() {
    if (!state.me || state.loading) return;
    var book = CM.bookById(state.bookId);
    var section = state.section;
    var defaults = rangeDefaults(state.bookId, section);
    sheetContext = { bookId: state.bookId, section: section };

    openSheet(
      '<button class="sheet-x" data-action="close-sheet" aria-label="閉じる">' + ICON.close + "</button>" +
      '<div class="sheet-head">' +
        '<span class="sheet-kicker">' + esc(book.name) + " ・ " + SECTIONS[section].label + "</span>" +
        "<h3>範囲で記録</h3>" +
        "<p>解いた問題をまとめて記録します。</p>" +
      "</div>" +
      '<div class="range-inputs">' +
        '<label class="range-field"><span>から</span>' +
          '<input id="rangeFrom" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="' + defaults.from + '" aria-label="開始番号">' +
        "</label>" +
        '<span class="range-tilde">〜</span>' +
        '<label class="range-field"><span>まで</span>' +
          '<input id="rangeTo" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="' + defaults.to + '" aria-label="終了番号">' +
        "</label>" +
      "</div>" +
      '<div class="quick-row">' +
        '<button data-action="range-quick" data-quick="continue">続きから10問</button>' +
        '<button data-action="range-quick" data-quick="last">前回のあと</button>' +
        '<button data-action="range-quick" data-quick="first">1〜10</button>' +
      "</div>" +
      '<div class="range-preview" id="rangePreview"></div>' +
      '<p class="form-error" id="rangeError" role="alert"></p>' +
      '<button class="btn-primary btn-lg btn-block" data-action="range-submit">記録する</button>' +
      '<p class="sheet-note">1問ずつの記録は問題番号をタップ。取り消しは長押しで −1。</p>'
    );
    updateRangePreview();
  }

  function readRangeInputs() {
    var fromEl = document.getElementById("rangeFrom");
    var toEl = document.getElementById("rangeTo");
    if (!fromEl || !toEl || !sheetContext) return null;
    return {
      from: parseInt(fromEl.value, 10),
      to: parseInt(toEl.value, 10)
    };
  }

  function updateRangePreview() {
    if (!sheetContext) return;
    var preview = document.getElementById("rangePreview");
    var errorEl = document.getElementById("rangeError");
    if (!preview) return;
    var values = readRangeInputs();
    var book = CM.bookById(sheetContext.bookId);
    var total = CM.sectionTotal(book, sheetContext.section);
    if (errorEl) errorEl.textContent = "";
    if (!values || !Number.isInteger(values.from) || !Number.isInteger(values.to) ||
        values.from < 1 || values.to > total || values.from > values.to) {
      preview.className = "range-preview bad";
      preview.textContent = "1〜" + total + " の範囲で入力してください";
      return;
    }
    var count = values.to - values.from + 1;
    preview.className = "range-preview";
    preview.innerHTML =
      "<span>" + SECTIONS[sheetContext.section].label + " " + values.from + "〜" + values.to + "</span>" +
      "<b>" + count + "問 <small>を1周として記録</small></b>";
  }

  function handleRangeQuick(quick) {
    if (!sheetContext) return;
    var book = CM.bookById(sheetContext.bookId);
    var total = CM.sectionTotal(book, sheetContext.section);
    var from;
    if (quick === "first") {
      from = 1;
    } else if (quick === "last") {
      var last = lastLogFor(sheetContext.bookId, sheetContext.section);
      from = last ? Number(last.to_no) + 1 : (firstIncomplete(sheetContext.section) || 1);
    } else {
      from = firstIncomplete(sheetContext.section) || 1;
    }
    from = Math.min(Math.max(1, from), total);
    var to = Math.min(total, from + 9);
    var fromEl = document.getElementById("rangeFrom");
    var toEl = document.getElementById("rangeTo");
    if (fromEl) fromEl.value = from;
    if (toEl) toEl.value = to;
    updateRangePreview();
  }

  function submitRangeSheet() {
    if (!sheetContext) return;
    var context = sheetContext;
    var values = readRangeInputs();
    var book = CM.bookById(context.bookId);
    var total = CM.sectionTotal(book, context.section);
    var errorEl = document.getElementById("rangeError");
    if (!values || !Number.isInteger(values.from) || !Number.isInteger(values.to) ||
        values.from < 1 || values.to > total || values.from > values.to) {
      if (errorEl) errorEl.textContent = "1〜" + total + " の範囲で入力してください";
      return;
    }
    closeSheet();
    recordRange(context.bookId, context.section, values.from, values.to);
  }

  function updateCellsRange(section, from, to) {
    cellEls.forEach(function (el, key) {
      var parts = key.split(":");
      if (parts[0] !== section) return;
      var no = Number(parts[1]);
      if (no < from || no > to) return;
      applyCell(el, no, getProg(section, no), SECTIONS[section].label);
    });
  }

  function recordRange(bookId, section, from, to) {
    if (!state.me) return;
    var isCurrent = state.bookId === bookId && state.section === section;
    var count = to - from + 1;
    var label = SECTIONS[section].label;
    var previous = [];

    var tempId = pushOptimisticLog({
      bookId: bookId, section: section, from: from, to: to, delta: 1,
      kind: from === to ? "single" : "range"
    });

    if (isCurrent) {
      for (var no = from; no <= to; no++) {
        previous.push({ no: no, value: getProg(section, no) });
        var current = getProg(section, no);
        setProg(section, no, { count: current.count + 1, weak: current.weak });
      }
      updateCellsRange(section, from, to);
      refreshHero();
      syncRecordSummary();
      vibrate(18);
    }

    Store.record({
      userId: state.meId, bookId: bookId, section: section,
      from: from, to: to, delta: 1, kind: from === to ? "single" : "range"
    }).then(function () {
      var message = from === to
        ? label + " " + from + "番を記録しました"
        : label + " " + from + "〜" + to + " を記録（" + count + "問）";
      toast(message, {
        action: {
          label: "元に戻す",
          fn: function () { undoRange(bookId, section, from, to); }
        }
      });
      scheduleLiveRefresh(350);
    }).catch(function (err) {
      if (isCurrent) {
        previous.forEach(function (item) {
          setProg(section, item.no, item.value);
        });
        updateCellsRange(section, from, to);
        refreshHero();
        syncRecordSummary();
      }
      removeOptimisticLog(tempId);
      toast(friendlyError(err));
    });
  }

  function undoRange(bookId, section, from, to) {
    if (!state.me) return;
    var isCurrent = state.bookId === bookId && state.section === section;
    var previous = [];
    var tempId = pushOptimisticLog({
      bookId: bookId, section: section, from: from, to: to, delta: -1, kind: "undo"
    });
    if (isCurrent) {
      for (var no = from; no <= to; no++) {
        var current = getProg(section, no);
        previous.push({ no: no, value: { count: current.count, weak: current.weak } });
        setProg(section, no, { count: Math.max(0, current.count - 1), weak: current.weak });
      }
      updateCellsRange(section, from, to);
      refreshHero();
      syncRecordSummary();
    }

    Store.record({
      userId: state.meId, bookId: bookId, section: section,
      from: from, to: to, delta: -1, kind: "undo"
    }).then(function () {
      toast("記録を取り消しました");
      scheduleLiveRefresh(300);
    }).catch(function (err) {
      if (isCurrent) {
        previous.forEach(function (item) {
          setProg(section, item.no, item.value);
        });
        updateCellsRange(section, from, to);
        refreshHero();
        syncRecordSummary();
      }
      removeOptimisticLog(tempId);
      toast(friendlyError(err));
    });
  }

  function updateCellMap() {
    cellEls = new Map();
    viewEl.querySelectorAll(".pcell").forEach(function (el) {
      cellEls.set(el.closest(".grid").dataset.section + ":" + el.dataset.no, el);
    });
  }

  /* ------------------------------------------------------------------ */
  /* みんなの進捗                                                        */
  /* ------------------------------------------------------------------ */

  function profileName(userId) {
    var found = state.profiles.find(function (p) { return p.id === userId; });
    return found ? found.name : "メンバー";
  }

  function renderTogether() {
    var members = state.profiles.map(function (p) {
      return { profile: p, totals: totalsFor(p.id) };
    }).sort(function (a, b) {
      return b.totals.percent - a.totals.percent || a.profile.name.localeCompare(b.profile.name, "ja");
    });

    var completedAll = 0;
    state.stats.forEach(function (row) { completedAll += Number(row.completed) || 0; });

    var headCells = BOOKS.map(function (b) {
      return '<span class="mx-cell mx-book" title="' + esc(b.name) + '">' + b.numeral + "</span>";
    }).join("");

    var rows = members.map(function (member) {
      var stats = state.statsIndex[member.profile.id] || {};
      var cells = BOOKS.map(function (b) {
        var completed = stats[b.id] ? stats[b.id].completed : 0;
        var pct = Math.min(100, Math.round((completed / CM.bookTotal(b)) * 100));
        return '<span class="mx-cell" style="' + heatStyle(pct) + '">' + (pct > 0 ? pct : "–") + "</span>";
      }).join("");
      return (
        '<div class="mx-row ' + (member.profile.id === state.meId ? "me" : "") + '">' +
          '<span class="mx-name">' + avatar(member.profile.name, "xs") + "<b>" + esc(member.profile.name) + "</b></span>" +
          cells +
          '<span class="mx-cell mx-total" style="' + heatStyle(member.totals.percent) + '">' + (member.totals.percent > 0 ? member.totals.percent : "–") + "</span>" +
        "</div>"
      );
    }).join("");

    return (
      '<section class="page-head">' +
        '<div><p class="kicker">TOGETHER</p><h1>みんなの進捗</h1></div>' +
        (state.mode === "cloud"
          ? '<span class="live-pill"><i></i>LIVE</span>'
          : '<span class="mode-pill">LOCAL</span>') +
      "</section>" +

      '<div class="glance card">' +
        '<div class="glance-item"><span>今日の演習</span><b>' + todayCountAll() + "<small>問</small></b></div>" +
        '<div class="glance-item"><span>完了問題</span><b>' + completedAll + "<small>問</small></b></div>" +
        '<div class="glance-item"><span>メンバー</span><b>' + state.profiles.length + "<small>人</small></b></div>" +
      "</div>" +

      '<section class="card">' +
        '<div class="card-head">' +
          "<div><h2>参考書別 達成率</h2><p>1回以上完了した問題の割合（％）</p></div>" +
        "</div>" +
        '<div class="matrix-wrap">' +
          '<div class="matrix">' +
            '<div class="mx-row mx-head"><span class="mx-name">メンバー</span>' + headCells + '<span class="mx-cell mx-total">総合</span></div>' +
            rows +
          "</div>" +
        "</div>" +
        '<p class="matrix-legend">' +
          '<span class="legend-low">0%</span><span class="legend-bar"></span><span class="legend-high">100%</span>' +
          '<span class="legend-note">達成率が高いほど濃い色</span>' +
        "</p>" +
      "</section>" +

      '<section class="card timeline-card">' +
        '<div class="card-head">' +
          "<div><h2>タイムライン</h2><p>みんなの記録がここに流れます</p></div>" +
          '<button class="icon-btn" data-action="refresh" aria-label="更新">' + ICON.refresh + "</button>" +
        "</div>" +
        timelineHTML() +
      "</section>"
    );
  }

  function timelineHTML() {
    var logs = state.logs.slice(0, 50);
    if (!logs.length) {
      return (
        '<div class="empty-state">' +
          '<span class="empty-ico">' + ICON.spark + "</span>" +
          "<b>まだ記録がありません</b>" +
          "<p>問題をタップして、最初の1問を積み上げよう。</p>" +
        "</div>"
      );
    }

    var html = "";
    var lastKey = null;
    logs.forEach(function (log) {
      var key = keyOf(new Date(log.created_at));
      if (key !== lastKey) {
        html += '<div class="tl-day">' + dayLabel(key) + "</div>";
        lastKey = key;
      }
      var name = profileName(log.user_id);
      var book = CM.bookById(log.book_id);
      var section = SECTIONS[log.section] || SECTIONS.example;
      var amount = Number(log.amount) || 0;
      var negative = amount < 0;
      var range = Number(log.from_no) === Number(log.to_no)
        ? Number(log.from_no) + "番"
        : log.from_no + "〜" + log.to_no;

      html +=
        '<div class="tl-item ' + (negative ? "undo" : "") + '">' +
          avatar(name, "sm") +
          '<div class="tl-body">' +
            '<div class="tl-top"><b>' + esc(name) + "</b><time>" + relativeTime(log.created_at) + "</time></div>" +
            '<p class="tl-desc">' +
              '<span class="tl-book"><i style="background:' + book.color + '"></i>' + esc(book.name) + "</span>" +
              ' <span class="tl-sec">' + section.label + "</span> <b>" + range + "</b>" +
              (negative ? " の記録を取り消し" : " を記録") +
            "</p>" +
            '<div class="tl-tags">' +
              '<span class="tl-tag ' + (negative ? "minus" : "") + '">' + (negative ? "−" : "+") + Math.abs(amount) + "問</span>" +
              (log.pending ? '<span class="tl-tag pending">送信中</span>' : "") +
            "</div>" +
          "</div>" +
        "</div>";
    });
    return '<div class="timeline">' + html + "</div>";
  }

  /* ------------------------------------------------------------------ */
  /* ランキング                                                          */
  /* ------------------------------------------------------------------ */

  function buildRanking(period) {
    var start = period === "week" ? startOfWeek() : startOfMonth();
    var sums = new Map();
    state.profiles.forEach(function (p) { sums.set(p.id, 0); });
    state.logs.forEach(function (log) {
      var at = new Date(log.created_at);
      if (at < start) return;
      if (!sums.has(log.user_id)) return;
      sums.set(log.user_id, sums.get(log.user_id) + (Number(log.amount) || 0));
    });
    var rows = state.profiles.map(function (p) {
      return { id: p.id, name: p.name, count: Math.max(0, sums.get(p.id) || 0) };
    });
    rows.sort(function (a, b) {
      return b.count - a.count || a.name.localeCompare(b.name, "ja");
    });
    rows.forEach(function (row, index) { row.rank = index + 1; });
    return rows;
  }

  function periodLabel(period) {
    if (period === "week") {
      var start = startOfWeek();
      var end = new Date(start);
      end.setDate(end.getDate() + 6);
      return "今週 " + (start.getMonth() + 1) + "/" + start.getDate() + " 〜 " + (end.getMonth() + 1) + "/" + end.getDate();
    }
    var now = new Date();
    return now.getFullYear() + "年" + (now.getMonth() + 1) + "月";
  }

  function renderRanking() {
    var ranks = buildRanking(state.rankPeriod);
    var top = ranks.slice(0, 3);
    var ordered = top.length === 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : top;
    var maxCount = ranks.length ? ranks[0].count : 0;
    var periodName = state.rankPeriod === "week" ? "週間" : "月間";

    var podium = ordered.length
      ? '<div class="podium count-' + ordered.length + '">' +
          ordered.map(function (row) {
            return (
              '<div class="podium-card p' + row.rank + '">' +
                '<span class="podium-medal">' + row.rank + "</span>" +
                avatar(row.name, "lg") +
                '<span class="podium-name">' + esc(row.name) + "</span>" +
                '<span class="podium-count">' + row.count + "<small>問</small></span>" +
              "</div>"
            );
          }).join("") +
        "</div>"
      : "";

    var list = ranks.map(function (row) {
      var width = maxCount > 0 ? Math.max(row.count > 0 ? 6 : 0, Math.round((row.count / maxCount) * 100)) : 0;
      var isMe = row.id === state.meId;
      return (
        '<div class="rank-row ' + (isMe ? "me" : "") + '">' +
          '<span class="rank-no r' + (row.rank <= 3 ? row.rank : "n") + '">' + row.rank + "</span>" +
          avatar(row.name, "sm") +
          '<div class="rank-main">' +
            '<div class="rank-top"><b>' + esc(row.name) + "</b>" + (isMe ? '<span class="you">YOU</span>' : "") + "</div>" +
            '<div class="rank-bar"><i style="width:' + width + '%"></i></div>' +
          "</div>" +
          '<span class="rank-count">' + row.count + "<small>問</small></span>" +
        "</div>"
      );
    }).join("");

    return (
      '<section class="page-head">' +
        '<div><p class="kicker">RANKING</p><h1>' + periodName + "ランキング</h1></div>" +
        '<span class="period-chip">' + periodLabel(state.rankPeriod) + "</span>" +
      "</section>" +

      '<div class="seg seg-wide" role="tablist" aria-label="集計期間">' +
        '<button class="seg-btn ' + (state.rankPeriod === "week" ? "on" : "") + '" data-action="rank-period" data-period="week" role="tab" aria-selected="' + (state.rankPeriod === "week") + '">週間</button>' +
        '<button class="seg-btn ' + (state.rankPeriod === "month" ? "on" : "") + '" data-action="rank-period" data-period="month" role="tab" aria-selected="' + (state.rankPeriod === "month") + '">月間</button>' +
      "</div>" +

      podium +

      '<section class="card rank-card">' +
        '<div class="card-head"><div><h2>全員のランキング</h2><p>期間内に解いた問題数（延べ）</p></div></div>' +
        (ranks.length ? '<div class="rank-list">' + list + "</div>" : '<div class="empty-state"><b>メンバーがいません</b></div>') +
      "</section>" +

      '<p class="footnote">※ 同じ問題を複数回解いた分もカウントされます。記録を取り消すと数値も減ります。</p>'
    );
  }

  /* ------------------------------------------------------------------ */
  /* マイページ                                                          */
  /* ------------------------------------------------------------------ */

  function renderMine() {
    var me = state.me;
    if (!me) return renderGuest();
    var totals = totalsFor(me.id);
    var streak = streakDays();
    var isCloud = state.mode === "cloud";

    var bookRows = BOOKS.map(function (book) {
      var stats = statsFor(me.id, book.id);
      var percent = Math.min(100, Math.round((stats.completed / CM.bookTotal(book)) * 100));
      return (
        '<div class="bp-row">' +
          '<span class="bp-num" style="background:' + book.soft + ";color:" + book.color + '">' + book.numeral + "</span>" +
          '<div class="bp-main">' +
            '<div class="bp-top"><b>' + esc(book.name) + "</b><span>" + percent + "%</span></div>" +
            '<div class="bp-bar"><i style="width:' + percent + "%;background:" + book.color + '"></i></div>' +
            '<div class="bp-sub">例 ' + stats.example.completed + "/" + book.example + " ・ EX " + stats.exercise.completed + "/" + book.exercise + "</div>" +
          "</div>" +
        "</div>"
      );
    }).join("");

    return (
      '<section class="page-head">' +
        '<div><p class="kicker">MY PAGE</p><h1>マイページ</h1></div>' +
        '<button class="me-chip" data-action="open-profiles">' + avatar(me.name, "sm") + '<span class="me-name">切替</span></button>' +
      "</section>" +

      '<section class="me-hero">' +
        '<span class="me-orb a"></span><span class="me-orb b"></span>' +
        '<div class="me-hero-top">' +
          avatar(me.name, "xl") +
          "<div>" +
            '<span class="me-label">MY RECORD</span>' +
            "<h2>" + esc(me.name) + "</h2>" +
            "<p>" + joinedLabel(me.created_at) + "</p>" +
          "</div>" +
        "</div>" +
        '<div class="me-stats">' +
          "<div><b>" + totals.completed + "</b><span>完了問題</span></div>" +
          "<div><b>" + totals.reps + "</b><span>延べ演習</span></div>" +
          "<div><b>" + totals.weak + "</b><span>苦手</span></div>" +
          "<div><b>" + streak + "</b><span>連続日数</span></div>" +
        "</div>" +
      "</section>" +

      '<section class="card">' +
        '<div class="card-head"><div><h2>参考書の進み具合</h2><p>1回以上完了した問題数</p></div></div>' +
        '<div class="book-progress">' + bookRows + "</div>" +
      "</section>" +

      '<section class="card weak-card">' +
        '<div class="weak-copy">' +
          '<span class="weak-ico">' + ICON.weak + "</span>" +
          "<div><h2>苦手問題 " + totals.weak + "問</h2>" +
            "<p>" + (totals.weak > 0 ? "要復習リストを見て、まとめて解き直そう。" : "「苦手」モードで問題をタップすると、ここにたまります。") + "</p>" +
          "</div>" +
        "</div>" +
        '<button class="btn-soft btn-block" data-action="go-weak">' + (totals.weak > 0 ? "復習リストを開く" : "苦手をチェックする") + "</button>" +
      "</section>" +

      '<section class="card invite-card">' +
        '<div class="card-head"><div><h2>友達と共有</h2><p>' + (isCloud ? "URLを送るだけで参加できます" : "Supabaseを設定すると共有できます") + "</p></div></div>" +
        '<p class="invite-text">' +
          (isCloud
            ? "同じURLを開いて名前を選ぶだけ。パスワードなしで、みんなの進捗がリアルタイムに同期されます。"
            : "いまはこの端末だけに保存されています。config.js にSupabaseの接続情報を入れると、友達とリアルタイム共有できます。") +
        "</p>" +
        '<div class="invite-actions">' +
          '<button class="btn-soft" data-action="copy-url">URLをコピー</button>' +
          (isCloud ? "" : '<button class="btn-ghost" data-action="open-setup">接続ガイド</button>') +
        "</div>" +
      "</section>" +

      '<section class="card settings">' +
        '<div class="set-row"><span>接続モード</span><b class="mode-badge ' + (isCloud ? "cloud" : "local") + '">' + (isCloud ? "クラウド同期" : "ローカル保存") + "</b></div>" +
        '<button class="set-row as-btn" data-action="open-profiles"><span>ユーザーの切り替え・追加</span><i>' + ICON.chevron + "</i></button>" +
        '<button class="set-row as-btn" data-action="open-setup"><span>Supabase 接続ガイド</span><i>' + ICON.chevron + "</i></button>" +
        (isCloud ? "" : '<button class="set-row as-btn danger" data-action="clear-local"><span>ローカルデータを削除</span><i>' + ICON.chevron + "</i></button>") +
      "</section>" +

      '<p class="app-foot">チャートログ v1.0 ・ 青チャート進捗ノート</p>'
    );
  }

  /* ------------------------------------------------------------------ */
  /* シート / トースト                                                   */
  /* ------------------------------------------------------------------ */

  function openSheet(html) {
    sheetToken++;
    sheetRoot.innerHTML =
      '<div class="sheet-backdrop"><div class="sheet" role="dialog" aria-modal="true">' +
        '<div class="sheet-grabber" aria-hidden="true"></div>' + html +
      "</div></div>";
    document.body.classList.add("sheet-open");
    var backdrop = sheetRoot.querySelector(".sheet-backdrop");
    requestAnimationFrame(function () { backdrop.classList.add("in"); });
  }

  function closeSheet() {
    var backdrop = sheetRoot.querySelector(".sheet-backdrop");
    sheetContext = null;
    if (!backdrop) return;
    sheetToken++;
    backdrop.classList.remove("in");
    document.body.classList.remove("sheet-open");
    setTimeout(function () {
      if (backdrop && backdrop.parentNode) sheetRoot.innerHTML = "";
    }, 220);
  }

  function toast(message, options) {
    options = options || {};
    var token = ++toastToken;
    clearTimeout(toastTimer);
    toastAction = options.action || null;
    toastRoot.innerHTML =
      '<div class="toast">' +
        '<span class="toast-msg">' + esc(message) + "</span>" +
        (options.action ? '<button class="toast-btn" data-toast-action>' + esc(options.action.label) + "</button>" : "") +
      "</div>";
    var el = toastRoot.querySelector(".toast");
    requestAnimationFrame(function () { el.classList.add("in"); });
    toastTimer = setTimeout(function () {
      if (token === toastToken) hideToast();
    }, options.duration || 3600);
  }

  function hideToast() {
    var token = ++toastToken;
    var el = toastRoot.querySelector(".toast");
    if (el) el.classList.remove("in");
    setTimeout(function () {
      if (token === toastToken) toastRoot.innerHTML = "";
    }, 220);
  }

  function runToastAction() {
    var action = toastAction;
    toastAction = null;
    hideToast();
    if (action && typeof action.fn === "function") {
      Promise.resolve(action.fn()).catch(function (err) { toast(friendlyError(err)); });
    }
  }

  /* ------------------------------------------------------------------ */
  /* オンボーディング / プロフィール                                     */
  /* ------------------------------------------------------------------ */

  function profilePickRows(selectedId) {
    return state.profiles.map(function (profile) {
      var totals = totalsFor(profile.id);
      var sub = totals.reps > 0
        ? totals.completed + "問完了 ・ " + totals.percent + "%"
        : "タップしてスタート";
      return (
        '<button class="profile-row ' + (profile.id === selectedId ? "on" : "") + '" data-action="pick-profile" data-id="' + profile.id + '">' +
          avatar(profile.name, "md") +
          '<span class="pr-body"><b>' + esc(profile.name) + "</b><span>" + sub + "</span></span>" +
          (profile.id === selectedId
            ? '<span class="pr-check">' + ICON.check + "</span>"
            : '<span class="pr-chev">' + ICON.chevron + "</span>") +
        "</button>"
      );
    }).join("");
  }

  function openOnboarding() {
    state.onboardingOpen = true;
    var rows = profilePickRows(null);
    var modeNote = state.mode === "cloud"
      ? '<span class="dot-live"></span>友達とリアルタイム共有中'
      : '<span class="dot-local"></span>ローカル保存モード（この端末だけ）';

    onboardRoot.innerHTML =
      '<div class="onboard">' +
        '<div class="onboard-deco a"></div><div class="onboard-deco b"></div>' +
        '<div class="onboard-inner">' +
          '<div class="onboard-brand"><span class="brand-mark xl">チ</span><span>チャートログ</span></div>' +
          '<p class="onboard-kicker">AO CHART PROGRESS</p>' +
          '<h1>青チャートの進捗を、<br><em>みんなで</em>積み上げる。</h1>' +
          '<p class="onboard-lead">範囲で記録・苦手チェック・週間ランキング。<br>名前を選ぶだけで、すぐに始められます。</p>' +
          '<div class="onboard-card">' +
            '<p class="onboard-label">' + (state.profiles.length ? "だれとして記録しますか？" : "まずは名前を決めよう") + "</p>" +
            (state.profiles.length
              ? '<div class="profile-pick onboard-pick">' + rows + "</div>" +
                '<div class="divider"><span>または新しく追加</span></div>'
              : "") +
            '<form id="onboardForm" class="name-form" autocomplete="off">' +
              '<input name="name" maxlength="16" placeholder="名前を入力（例：あかり）" aria-label="名前" />' +
              '<button class="btn-primary" type="submit">はじめる</button>' +
            "</form>" +
            '<p class="form-error" id="onboardError" role="alert"></p>' +
            '<p class="onboard-note">パスワードはありません。同じ名前を選ぶと同じユーザーとして記録できます。</p>' +
          "</div>" +
          '<p class="onboard-mode">' + modeNote +
            ' <button class="inline-link" data-action="open-setup">接続ガイド</button>' +
          "</p>" +
        "</div>" +
      "</div>";

    document.body.classList.add("onboarding-open");
    requestAnimationFrame(function () { onboardRoot.classList.add("shown"); });
  }

  function closeOnboarding() {
    state.onboardingOpen = false;
    onboardRoot.classList.remove("shown");
    document.body.classList.remove("onboarding-open");
    setTimeout(function () {
      if (!state.onboardingOpen) onboardRoot.innerHTML = "";
    }, 260);
  }

  function openProfileSheet() {
    openSheet(
      '<button class="sheet-x" data-action="close-sheet" aria-label="閉じる">' + ICON.close + "</button>" +
      '<div class="sheet-head">' +
        '<span class="sheet-kicker">MEMBERS</span>' +
        "<h3>ユーザー</h3>" +
        "<p>名前を選ぶと、そのユーザーとして記録できます。</p>" +
      "</div>" +
      '<div class="profile-pick">' + profilePickRows(state.meId) + "</div>" +
      '<div class="divider"><span>新しく追加</span></div>' +
      '<form id="sheetProfileForm" class="name-form" autocomplete="off">' +
        '<input name="name" maxlength="16" placeholder="新しい名前" aria-label="新しい名前" />' +
        '<button class="btn-primary" type="submit">追加</button>' +
      "</form>" +
      '<p class="form-error" id="sheetProfileError" role="alert"></p>' +
      '<p class="sheet-note">同じ名前を入力すると、既存のユーザーに合流します。</p>'
    );
  }

  function openSetupSheet() {
    var isCloud = state.mode === "cloud";
    openSheet(
      '<button class="sheet-x" data-action="close-sheet" aria-label="閉じる">' + ICON.close + "</button>" +
      '<div class="sheet-head">' +
        '<span class="sheet-kicker">CONNECTION</span>' +
        "<h3>Supabase 接続ガイド</h3>" +
        "<p>友達とリアルタイムで共有するための設定です。</p>" +
      "</div>" +
      '<div class="status-banner ' + (isCloud ? "ok" : "warn") + '">' +
        '<span class="sb-dot"></span>' +
        "<div><b>" + (isCloud ? "クラウド同期モード" : "ローカル保存モード") + "</b>" +
          "<p>" + (isCloud
            ? "離れた端末ともリアルタイムに同期されています。"
            : "データはこの端末だけに保存されています。") + "</p></div>" +
      "</div>" +
      '<ol class="setup-steps">' +
        '<li><span>1</span><div><b>Supabaseで無料プロジェクトを作成</b><p>supabase.com にログインして「New project」。</p></div></li>' +
        '<li><span>2</span><div><b>SQL Editor で schema.sql を実行</b><p>プロジェクト内の <code>supabase/schema.sql</code> を貼り付けて Run。</p></div></li>' +
        '<li><span>3</span><div><b>config.js に接続情報を設定</b><p>Project Settings → API の URL と anon key を貼り付け。</p></div></li>' +
        '<li><span>4</span><div><b>ページを再読み込み</b><p>右上が LIVE になれば共有スタートです。</p></div></li>' +
      "</ol>" +
      '<div class="code-block"><span>config.js</span><pre>window.APP_CONFIG = {\n  SUPABASE_URL: "https://xxxx.supabase.co",\n  SUPABASE_ANON_KEY: "eyJhbGciOi..."\n};</pre></div>' +
      '<p class="sheet-note">anon key は公開前提のキーです。service_role key は絶対に使わないでください。</p>' +
      '<a class="btn-ghost btn-block" href="README.md" target="_blank" rel="noopener">README を開く</a>'
    );
  }

  function handleNewProfile(form, errorId) {
    var input = form.querySelector('input[name="name"]');
    var errorEl = document.getElementById(errorId);
    var button = form.querySelector('button[type="submit"]');
    var raw = input ? input.value : "";
    var name = raw.trim().replace(/\s+/g, " ");
    if (errorEl) errorEl.textContent = "";
    if (!name) {
      if (errorEl) errorEl.textContent = "名前を入力してください";
      if (input) input.focus();
      return;
    }
    if (Array.from(name).length > 16) {
      if (errorEl) errorEl.textContent = "名前は16文字以内にしてください";
      if (input) input.focus();
      return;
    }
    if (button) {
      button.disabled = true;
      button.classList.add("busy");
    }
    Store.createProfile(name)
      .then(function (profile) {
        return Store.listProfiles().then(function (profiles) {
          state.profiles = profiles || [];
          return selectProfile(profile.id);
        });
      })
      .then(function () {
        toast(name + " でスタート");
      })
      .catch(function (err) {
        if (errorEl) errorEl.textContent = friendlyError(err);
      })
      .finally(function () {
        if (button) {
          button.disabled = false;
          button.classList.remove("busy");
        }
      });
  }

  async function selectProfile(id) {
    var profile;
    try {
      profile = state.profiles.find(function (p) { return p.id === id; });
      if (!profile) {
        state.profiles = await Store.listProfiles();
        profile = state.profiles.find(function (p) { return p.id === id; });
      }
    } catch (err) {
      toast(friendlyError(err));
      return;
    }
    if (!profile) return;

    state.meId = profile.id;
    state.me = profile;
    state.view = "record";
    state.bookId = state.bookId || "1";
    try {
      localStorage.setItem("chartlog.me", profile.id);
    } catch (err) {
      /* noop */
    }
    closeOnboarding();
    closeSheet();
    state.loading = true;
    state.fatal = null;
    render();
    await loadAll();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function readSavedMe() {
    try {
      return localStorage.getItem("chartlog.me") || null;
    } catch (err) {
      return null;
    }
  }

  function forgetMe() {
    try {
      localStorage.removeItem("chartlog.me");
    } catch (err) {
      /* noop */
    }
    state.meId = null;
    state.me = null;
    state.fatal = null;
    state.loading = false;
    render();
    openOnboarding();
  }

  function clearLocalData() {
    var ok = window.confirm("この端末のローカルデータ（ユーザー・進捗・苦手）をすべて削除します。元に戻せません。よろしいですか？");
    if (!ok) return;
    Store.clearLocal();
    try {
      localStorage.removeItem("chartlog.me");
    } catch (err) {
      /* noop */
    }
    window.location.reload();
  }

  function copyUrl() {
    var url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(function () { toast("URLをコピーしました"); })
        .catch(function () { toast(url, { duration: 6000 }); });
    } else {
      toast(url, { duration: 6000 });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 操作                                                                */
  /* ------------------------------------------------------------------ */

  function selectBook(bookId) {
    if (!CM.BOOK_MAP[bookId] || bookId === state.bookId) return;
    state.bookId = bookId;
    state.weakOnly = false;
    render();
    reloadBook();
  }

  function selectSection(section) {
    if (!SECTIONS[section] || section === state.section) return;
    state.section = section;
    render();
  }

  function setGridMode(mode) {
    if (mode !== "record" && mode !== "weak") return;
    if (state.gridMode === mode) return;
    state.gridMode = mode;
    render();
  }

  function toggleWeakFilter() {
    state.weakOnly = !state.weakOnly;
    render();
  }

  function retryLoad() {
    state.fatal = null;
    state.syncError = null;
    if (state.me && state.meId) loadAll();
    else boot();
  }

  function handleAction(action, el) {
    if (!action) return;
    if (action === "view") return setView(el.dataset.view);
    if (action === "book") return selectBook(el.dataset.book);
    if (action === "section") return selectSection(el.dataset.section);
    if (action === "grid-mode") return setGridMode(el.dataset.mode);
    if (action === "weak-filter") return toggleWeakFilter();
    if (action === "open-range") return openRangeSheet();
    if (action === "range-quick") return handleRangeQuick(el.dataset.quick);
    if (action === "range-submit") return submitRangeSheet();
    if (action === "rank-period") {
      state.rankPeriod = el.dataset.period === "month" ? "month" : "week";
      render();
      return;
    }
    if (action === "refresh") {
      refreshLive();
      return;
    }
    if (action === "open-profiles") return openProfileSheet();
    if (action === "pick-profile") return selectProfile(el.dataset.id);
    if (action === "open-setup") return openSetupSheet();
    if (action === "open-onboarding") return openOnboarding();
    if (action === "go-weak") {
      state.view = "record";
      state.weakOnly = true;
      state.gridMode = "record";
      render();
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    if (action === "copy-url") return copyUrl();
    if (action === "clear-local") return clearLocalData();
    if (action === "retry") return retryLoad();
    if (action === "forget-me") return forgetMe();
    if (action === "close-sheet") return closeSheet();
  }

  function cancelPress() {
    if (!pressState) return;
    clearTimeout(pressState.timer);
    if (pressState.cell) pressState.cell.classList.remove("pressing");
    pressState = null;
  }

  /* ------------------------------------------------------------------ */
  /* 起動                                                                */
  /* ------------------------------------------------------------------ */

  async function boot() {
    state.loading = true;
    state.meId = readSavedMe();
    render();

    try {
      state.profiles = (await Store.listProfiles()) || [];
      var me = state.profiles.find(function (p) { return p.id === state.meId; });
      Store.subscribe(function (kind) {
        if (kind === "profiles" || kind === "storage") refreshProfiles();
        if (kind !== "profiles") scheduleLiveRefresh(300);
      });

      if (me) {
        state.me = me;
        state.meId = me.id;
        await loadAll();
      } else {
        state.me = null;
        state.meId = null;
        state.loading = false;
        render();
        openOnboarding();
      }
      state.booted = true;
    } catch (err) {
      console.error(err);
      state.loading = false;
      state.fatal = err;
      state.booted = true;
      render();
    }
  }

  /* ------------------------------------------------------------------ */
  /* イベント                                                            */
  /* ------------------------------------------------------------------ */

  document.addEventListener("click", function (event) {
    var backdrop = event.target.closest(".sheet-backdrop");
    if (backdrop && event.target === backdrop) {
      closeSheet();
      return;
    }

    var toastBtn = event.target.closest("[data-toast-action]");
    if (toastBtn) {
      runToastAction();
      return;
    }

    var actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    handleAction(actionEl.dataset.action, actionEl);
  });

  document.addEventListener("submit", function (event) {
    if (event.target.id === "onboardForm") {
      event.preventDefault();
      handleNewProfile(event.target, "onboardError");
    } else if (event.target.id === "sheetProfileForm") {
      event.preventDefault();
      handleNewProfile(event.target, "sheetProfileError");
    }
  });

  sheetRoot.addEventListener("input", function (event) {
    if (event.target && (event.target.id === "rangeFrom" || event.target.id === "rangeTo")) {
      updateRangePreview();
    }
  });

  sheetRoot.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && event.target &&
        (event.target.id === "rangeFrom" || event.target.id === "rangeTo")) {
      event.preventDefault();
      submitRangeSheet();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeSheet();
  });

  viewEl.addEventListener("pointerdown", function (event) {
    if (!event.isPrimary) return;
    var cell = event.target.closest(".pcell");
    if (!cell) return;
    if (typeof event.button === "number" && event.button !== 0) return;
    var no = Number(cell.dataset.no);
    if (!no) return;

    pressState = {
      no: no,
      cell: cell,
      x: event.clientX,
      y: event.clientY,
      timer: 0
    };
    try {
      cell.setPointerCapture(event.pointerId);
    } catch (err) {
      /* noop */
    }
    cell.classList.add("pressing");
    pressState.timer = setTimeout(function () {
      if (!pressState) return;
      var pending = pressState;
      pressState = null;
      pending.cell.classList.remove("pressing");
      handleCell(pending.no, -1);
    }, 470);
  });

  viewEl.addEventListener("pointermove", function (event) {
    if (!pressState) return;
    if (Math.abs(event.clientX - pressState.x) > 14 || Math.abs(event.clientY - pressState.y) > 14) {
      cancelPress();
    }
  });

  viewEl.addEventListener("pointerup", function () {
    if (!pressState) return;
    var pending = pressState;
    pressState = null;
    clearTimeout(pending.timer);
    pending.cell.classList.remove("pressing");
    handleCell(pending.no, 1);
  });

  viewEl.addEventListener("pointercancel", cancelPress);

  viewEl.addEventListener("contextmenu", function (event) {
    if (event.target.closest(".pcell")) event.preventDefault();
  });

  window.addEventListener("online", function () {
    toast("オンラインに戻りました");
    scheduleLiveRefresh(120);
  });

  window.addEventListener("offline", function () {
    toast("オフラインです。復帰後に自動で同期します。", { duration: 4600 });
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && state.meId) scheduleLiveRefresh(180);
  });

  boot();
})();
