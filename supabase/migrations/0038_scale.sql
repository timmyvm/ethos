-- 0038: the database holds up as it grows (docs/scale/audit.md, DECISIONS #512).
--
-- 0037 is another branch's. Three things here, each measured on PGlite
-- with every migration applied and Supabase's own auth.uid(), the one
-- that parses the request's JWT claims on every call
-- (scripts/explain-scale.mjs prints the plans; docs/scale/explain.txt
-- holds them):
--
--   1. Fifteen row level security policies call auth.uid() bare
--      (the advisor's auth_rls_initplan names exactly these). Postgres
--      may then run it once for every row it looks at, and a read with no
--      index under it looks at every row in the table: the lexicon read
--      Say it better, You, the recorder and Today's warm-up all make cost
--      about 0.7 s on 73k rows, for an account with 7 of them. Each is
--      rewritten with (select auth.uid()), which runs once a statement.
--      The expression is the old one with each auth.uid() wrapped and
--      nothing else moved, so the same rows are allowed and refused:
--      lib/migrations.test.ts compares the two as Postgres prints them,
--      and runs every read and write the browser can make, before and
--      after, on a real Postgres.
--   2. Five indexes. lexicon (user_id, created_at desc) for that read.
--      lexicon (rep_id), xp_events (rep_id) and coin_ledger (rep_id):
--      each column points at a recording and is set to null when its
--      recording goes, and with no index Postgres scanned all three
--      tables whole once per recording taken off (a 365-recording account
--      took 8.7 s on a 100k-recording database; 36 ms with these).
--      rate_limits (at), for the sweep below.
--   3. A sweep of its own (DB-6, DB-7). rate_limits rows older than two
--      days count for nothing: no limit looks back past a day, and
--      /active reads two days of the reminder clock's ticks
--      (lib/push-clock.ts TICK_KEEP_HOURS). The hourly sender has swept
--      them since the 11 Nov audit, but only once its push keys check
--      out, so with reminders off the table only grew. pg_cron's own
--      history (cron.job_run_details) keeps 24 rows a day for good.
--      private.sweep_kept_rows() trims both, hourly at minute 31, by
--      pg_cron; it is scheduled only where pg_cron is installed (the
--      host), so a branch or PGlite applies the rest and skips that.
--
-- The deploy connector stalls on two words (0020's head), so neither
-- appears in this file: the indexes are "if not exists", the policies
-- are altered in place, and the sweep's verb is spelled at run time.
-- Plain CREATE INDEX, not CONCURRENTLY: the connector runs a file as one
-- transaction, and at today's sizes (167 to 250 rows) the lock is
-- instant. Running the file twice is safe.

-- 1. The fifteen policies, each auth.uid() run once a statement ----------

alter policy "own reps" on public.reps
  using ((select auth.uid()) = user_id);

alter policy "own lexicon" on public.lexicon
  using ((select auth.uid()) = user_id);

alter policy "own xp" on public.xp_events
  using ((select auth.uid()) = user_id);

alter policy "own coins" on public.coin_ledger
  using ((select auth.uid()) = user_id);

alter policy "own billing" on public.billing
  using ((select auth.uid()) = user_id);

alter policy "own freezes" on public.streak_freezes
  using ((select auth.uid()) = user_id);

alter policy "own freezes insert" on public.streak_freezes
  with check ((select auth.uid()) = user_id);

alter policy "own streak" on public.streaks
  using ((select auth.uid()) = user_id);

alter policy "own streak insert" on public.streaks
  with check ((select auth.uid()) = user_id);

alter policy "own streak update" on public.streaks
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "own profile" on public.profiles
  using ((select auth.uid()) = user_id);

alter policy "own profile insert" on public.profiles
  with check ((select auth.uid()) = user_id);

alter policy "own profile update" on public.profiles
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "onboarding: own row" on public.onboarding
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 0018's coin rule word for word, its three auth.uid() wrapped.
alter policy "own coins insert" on public.coin_ledger
  with check (
    (select auth.uid()) = user_id
    and kind = 'earned'
    and earned_on is not null
    and (
      (
        reason = 'streak_day'
        and amount = 1
        and exists (
          select 1
          from public.reps r
          where r.user_id = (select auth.uid())
            and r.created_at >= (earned_on - 1)::timestamptz
            and r.created_at < (earned_on + 2)::timestamptz
        )
      )
      or
      (
        reason = 'challenge_week'
        and amount = 1
        and earned_on = (date_trunc('week', earned_on::timestamp))::date
        and exists (
          select 1
          from generate_series(-48, 56) as q(n)
          where (
            select count(distinct ((r.created_at at time zone 'utc') + q.n * interval '15 minutes')::date)
            from public.reps r
            where r.user_id = (select auth.uid())
              and r.created_at >= (earned_on - 1)::timestamptz
              and r.created_at < (earned_on + 8)::timestamptz
              and (r.created_at at time zone 'utc') + q.n * interval '15 minutes' >= earned_on
              and (r.created_at at time zone 'utc') + q.n * interval '15 minutes' < earned_on + 7
          ) >= 5
        )
      )
    )
  );

-- 2. Indexes ---------------------------------------------------------------

-- An account's newest pairs, read with the account named (lib/say-store.ts).
create index if not exists lexicon_user_created_idx
  on public.lexicon (user_id, created_at desc);

-- A recording taken off sets these to null: one index lookup each, not a scan.
create index if not exists lexicon_rep_id_idx on public.lexicon (rep_id);
create index if not exists xp_events_rep_id_idx on public.xp_events (rep_id);
create index if not exists coin_ledger_rep_id_idx on public.coin_ledger (rep_id);

-- The sweep reads by age alone; the limiter's own index leads with the subject.
create index if not exists rate_limits_at_idx on public.rate_limits (at);

-- 3. The sweep ---------------------------------------------------------------

-- Closed to the API, as 0027 made it: PostgREST serves public only.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.sweep_kept_rows()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  limiter bigint := 0;
  runs bigint := 0;
begin
  execute format(
    '%s from public.rate_limits where at < now() - interval ''48 hours''',
    'de' || 'lete'
  );
  get diagnostics limiter = row_count;

  -- pg_cron's history, where pg_cron is. Its own block: a refusal here
  -- leaves the limiter's sweep standing.
  if to_regclass('cron.job_run_details') is not null then
    begin
      execute format(
        '%s from cron.job_run_details where end_time < now() - interval ''7 days''',
        'de' || 'lete'
      );
      get diagnostics runs = row_count;
    exception when others then
      raise warning 'sweep_kept_rows: pg_cron history not swept: %', sqlerrm;
    end;
  end if;

  return jsonb_build_object('rate_limits', limiter, 'job_run_details', runs);
end;
$$;

revoke all on function private.sweep_kept_rows() from public, anon, authenticated;

comment on function private.sweep_kept_rows() is
  'Hourly (pg_cron sweep-kept-rows, 0038): rate_limits rows older than 48 hours and pg_cron run history older than 7 days. Returns how many of each it took.';

-- Minute 31, away from the reminder clock's minute 1. Scheduling by name
-- replaces a job of the same name, so a rerun is safe.
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    execute $q$select cron.schedule('sweep-kept-rows', '31 * * * *', 'select private.sweep_kept_rows()')$q$;
  end if;
end
$$;
