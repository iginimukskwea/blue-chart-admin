-- ============================================================
-- チャートログ / Supabase スキーマ
-- Supabase ダッシュボード → SQL Editor に丸ごと貼り付けて Run
-- （何度実行してもOKなように書いてあります）
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 参考書のマスタ（問題数の上限チェック用）
-- ------------------------------------------------------------
create table if not exists public.book_sections (
  book_id text not null,
  section text not null check (section in ('example', 'exercise')),
  total   int  not null check (total > 0),
  primary key (book_id, section)
);

insert into public.book_sections (book_id, section, total) values
  ('1', 'example', 194), ('1', 'exercise', 135),
  ('A', 'example', 158), ('A', 'exercise', 107),
  ('2', 'example', 262), ('2', 'exercise', 159),
  ('B', 'example',  94), ('B', 'exercise',  63),
  ('3', 'example', 215), ('3', 'exercise', 176),
  ('C', 'example', 179), ('C', 'exercise', 121)
on conflict (book_id, section) do update set total = excluded.total;

-- ------------------------------------------------------------
-- ユーザー（パスワードなし・名前だけ）
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now(),
  constraint profiles_name_length check (char_length(btrim(name)) between 1 and 20)
);

-- ------------------------------------------------------------
-- 問題ごとの進捗（周回数・苦手フラグ）
-- ------------------------------------------------------------
create table if not exists public.problem_progress (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    text not null,
  section    text not null check (section in ('example', 'exercise')),
  problem_no int  not null check (problem_no > 0),
  count      int  not null default 0 check (count >= 0),
  weak       boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id, section, problem_no)
);

create index if not exists problem_progress_user_book_idx
  on public.problem_progress (user_id, book_id);

-- ------------------------------------------------------------
-- 記録ログ（タイムライン・ランキングの元データ）
-- ------------------------------------------------------------
create table if not exists public.study_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    text not null,
  section    text not null check (section in ('example', 'exercise')),
  from_no    int  not null check (from_no > 0),
  to_no      int  not null check (to_no >= from_no),
  amount     int  not null,                 -- 記録: +問題数 / 取り消し: -問題数
  kind       text not null default 'range' check (kind in ('range', 'single', 'undo', 'adjust')),
  created_at timestamptz not null default now()
);

create index if not exists study_logs_created_at_idx
  on public.study_logs (created_at desc);
create index if not exists study_logs_user_created_idx
  on public.study_logs (user_id, created_at desc);

-- ------------------------------------------------------------
-- RLS（読み取りは全員OK、書き込みは下の関数経由のみ）
-- ------------------------------------------------------------
alter table public.book_sections     enable row level security;
alter table public.profiles          enable row level security;
alter table public.problem_progress  enable row level security;
alter table public.study_logs        enable row level security;

drop policy if exists "book_sections_read" on public.book_sections;
create policy "book_sections_read" on public.book_sections
  for select to anon, authenticated using (true);

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select to anon, authenticated using (true);

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert to anon, authenticated
  with check (char_length(btrim(name)) between 1 and 20);

drop policy if exists "progress_read" on public.problem_progress;
create policy "progress_read" on public.problem_progress
  for select to anon, authenticated using (true);

drop policy if exists "logs_read" on public.study_logs;
create policy "logs_read" on public.study_logs
  for select to anon, authenticated using (true);

-- ------------------------------------------------------------
-- 範囲記録 / 取り消し
--   例: 例題 12〜30 を +1 する → 30-12+1 = 19 問分を加算しログを1行残す
-- ------------------------------------------------------------
create or replace function public.record_progress(
  p_user    uuid,
  p_book    text,
  p_section text,
  p_from    int,
  p_to      int,
  p_delta   int,
  p_kind    text default 'range'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_count int;
  v_kind  text := coalesce(nullif(p_kind, ''), 'range');
begin
  if p_delta not in (-1, 1) then
    raise exception 'invalid delta';
  end if;
  if v_kind not in ('range', 'single', 'undo', 'adjust') then
    raise exception 'invalid kind';
  end if;

  select bs.total into v_total
  from public.book_sections bs
  where bs.book_id = p_book and bs.section = p_section;

  if v_total is null then
    raise exception 'unknown book/section';
  end if;
  if p_from < 1 or p_to < p_from or p_to > v_total then
    raise exception 'invalid range';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'unknown user';
  end if;

  v_count := p_to - p_from + 1;

  insert into public.problem_progress as pp
    (user_id, book_id, section, problem_no, count, updated_at)
  select p_user, p_book, p_section, n,
         case when p_delta > 0 then 1 else 0 end,
         now()
  from generate_series(p_from, p_to) as n
  on conflict (user_id, book_id, section, problem_no)
  do update set
    count = greatest(pp.count + p_delta, 0),
    updated_at = now();

  insert into public.study_logs
    (user_id, book_id, section, from_no, to_no, amount, kind)
  values
    (p_user, p_book, p_section, p_from, p_to, p_delta * v_count, v_kind);

  return v_count;
end;
$$;

-- ------------------------------------------------------------
-- 苦手フラグのオン / オフ
-- ------------------------------------------------------------
create or replace function public.set_weak(
  p_user    uuid,
  p_book    text,
  p_section text,
  p_no      int,
  p_weak    boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
begin
  select bs.total into v_total
  from public.book_sections bs
  where bs.book_id = p_book and bs.section = p_section;

  if v_total is null then
    raise exception 'unknown book/section';
  end if;
  if p_no is null or p_no < 1 or p_no > v_total then
    raise exception 'invalid problem number';
  end if;

  insert into public.problem_progress as pp
    (user_id, book_id, section, problem_no, count, weak, updated_at)
  values
    (p_user, p_book, p_section, p_no, 0, coalesce(p_weak, false), now())
  on conflict (user_id, book_id, section, problem_no)
  do update set
    weak = coalesce(p_weak, false),
    updated_at = now();
end;
$$;

-- ------------------------------------------------------------
-- 参考書別の集計（達成率・苦手数・延べ演習数）
-- ------------------------------------------------------------
create or replace function public.get_stats()
returns table (
  user_id    uuid,
  book_id    text,
  section    text,
  completed  int,
  weak_count int,
  reps       int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pp.user_id,
    pp.book_id,
    pp.section,
    count(*) filter (where pp.count > 0)::int as completed,
    count(*) filter (where pp.weak)::int      as weak_count,
    coalesce(sum(pp.count), 0)::int           as reps
  from public.problem_progress pp
  group by pp.user_id, pp.book_id, pp.section;
$$;

-- ------------------------------------------------------------
-- 実行権限
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.book_sections, public.profiles,
  public.problem_progress, public.study_logs to anon, authenticated;
grant insert on public.profiles to anon, authenticated;

grant execute on function public.record_progress(uuid, text, text, int, int, int, text) to anon, authenticated;
grant execute on function public.set_weak(uuid, text, text, int, boolean) to anon, authenticated;
grant execute on function public.get_stats() to anon, authenticated;

-- ------------------------------------------------------------
-- Realtime（リアルタイム共有）
-- ------------------------------------------------------------
alter table public.profiles         replica identity full;
alter table public.problem_progress replica identity full;
alter table public.study_logs       replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'study_logs'
  ) then
    alter publication supabase_realtime add table public.study_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'problem_progress'
  ) then
    alter publication supabase_realtime add table public.problem_progress;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
