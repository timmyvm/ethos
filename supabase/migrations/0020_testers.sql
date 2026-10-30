-- 0020: testers, the friends who check whether the scores are right.
--
-- Timothy is asking about ten friends to speak for five minutes a day
-- for two weeks and say, after each recording, whether the score
-- matched how it felt. Every threshold behind the numbers (stars, the
-- pause detector, presence) is a first guess; their answers are how it
-- gets tuned. Three things here:
--
--   1. public.testers: one row per account in tester mode. Only the
--      server writes it (app/api/tester, with the service role), and it
--      writes the consent version and time in the same row that makes
--      the account a tester, so a tester without consent cannot exist.
--      The owner can read their own row; nobody can write one from the
--      browser.
--   2. public.tester_feedback: the answer to "Did this score match how
--      it felt?", one row per recording, keyed by the outbox id the
--      recording travelled under (0016 client_id), with the scores the
--      screen showed. Owners read, insert and update their own rows,
--      and insert only while a testers row exists for them.
--   3. tester_admin: the report Timothy reads in the SQL editor. A
--      schema the API never exposes, closed to anon and authenticated,
--      so only the service role and the dashboard can open it.
--
-- Both tables go with the account: user_id references auth.users with
-- the cascade, so the account route's one call (app/api/account) takes
-- every tester row with it, the way 0001 to 0012 take recordings and
-- scores. The recordings and scores themselves stay where they always
-- were (reps, 0001), readable only by their owner.
--
-- The deploy connector stalls on two words (STATE.md, 0017), so this
-- file holds neither: tables and indexes are "if not exists", policies
-- are created inside DO blocks that look in pg_policies first, and the
-- cascade clause on each foreign key is spelled at run time.

-- 1. Testers ---------------------------------------------------------------

create table if not exists public.testers (
  user_id uuid primary key,
  consent_version integer not null check (consent_version > 0),
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- 2. The match answers -----------------------------------------------------

create table if not exists public.tester_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  -- The outbox id (lib/rep-outbox.ts newOutboxId), the same shape
  -- /api/analyze accepts.
  client_id text not null check (char_length(client_id) between 1 and 200),
  -- The stored recording, once the upload has answered with its id.
  rep_id uuid,
  answer text not null check (answer in ('yes', 'roughly', 'no')),
  note text check (note is null or char_length(note) between 1 and 280),
  -- The numbers on screen when the answer was given (lib/tester.ts
  -- scoreSnapshot): small, flat, numbers only.
  scores jsonb not null default '{}'::jsonb
    check (jsonb_typeof(scores) = 'object' and pg_column_size(scores) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tester_feedback_user_client_uniq
  on public.tester_feedback (user_id, client_id);

-- Each user_id goes with its account. The clause is assembled here so
-- the word never appears in this file (see the head of the file).
do $$
declare
  t text;
begin
  foreach t in array array['testers', 'tester_feedback'] loop
    if not exists (
      select 1 from pg_constraint
       where conname = t || '_user_id_fkey'
         and conrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (user_id) '
        'references auth.users (id) on %s cascade',
        t, t || '_user_id_fkey', 'de' || 'lete'
      );
    end if;
  end loop;
end
$$;

-- Row level security. Supabase's default grants hand every new public
-- table to anon and authenticated; these take that back to exactly what
-- the policies below allow.

alter table public.testers enable row level security;
alter table public.tester_feedback enable row level security;

revoke all on table public.testers from public, anon, authenticated;
grant select on table public.testers to authenticated;

revoke all on table public.tester_feedback from public, anon, authenticated;
grant select, insert, update on table public.tester_feedback to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'testers'
       and policyname = 'testers: own row'
  ) then
    create policy "testers: own row" on public.testers
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'tester_feedback'
       and policyname = 'tester feedback: own rows'
  ) then
    create policy "tester feedback: own rows" on public.tester_feedback
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'tester_feedback'
       and policyname = 'tester feedback: testers insert their own'
  ) then
    create policy "tester feedback: testers insert their own" on public.tester_feedback
      for insert to authenticated
      with check (
        (select auth.uid()) = user_id
        and exists (
          select 1 from public.testers t where t.user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'tester_feedback'
       and policyname = 'tester feedback: testers change their own'
  ) then
    create policy "tester feedback: testers change their own" on public.tester_feedback
      for update to authenticated
      using ((select auth.uid()) = user_id)
      with check (
        (select auth.uid()) = user_id
        and exists (
          select 1 from public.testers t where t.user_id = (select auth.uid())
        )
      );
  end if;
end
$$;

-- 3. Timothy's report --------------------------------------------------------
--
-- Read in the SQL editor (docs/testers.md):
--   select * from tester_admin.testers order by joined_at;
--   select * from tester_admin.recordings order by name, spoken_at;
--   select * from tester_admin.answers order by answered_at;
--
-- The views run as their owner, so they see every tester; that is why
-- the schema is closed to everyone but the service role.

create schema if not exists tester_admin;
revoke all on schema tester_admin from public, anon, authenticated;
grant usage on schema tester_admin to service_role;

-- A jsonb value as a number, or null when it is anything else, so one
-- odd row never breaks the report.
create or replace function tester_admin.num(j jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(j) = 'number' then (j #>> '{}')::numeric end
$$;

-- The tester's calendar: the zone their reminders follow (0019), or
-- Melbourne's, where the testers are.
create or replace view tester_admin.zones as
select
  t.user_id,
  coalesce(
    (
      select ps.tz
        from public.push_subscriptions ps
       where ps.user_id = t.user_id and ps.tz is not null
       order by ps.created_at desc
       limit 1
    ),
    'Australia/Melbourne'
  ) as tz
from public.testers t;

-- One row per tester: who, since when, how many days spoken, and how
-- their answers split.
create or replace view tester_admin.testers as
select
  t.user_id,
  p.display_name as name,
  u.email,
  coalesce(u.is_anonymous, false) as anonymous,
  o.age_band = 'u18' as under_18,
  t.created_at as joined_at,
  t.consent_version,
  t.consented_at,
  ((now() at time zone z.tz)::date - (t.created_at at time zone z.tz)::date) + 1
    as days_since_joining,
  coalesce(r.days_spoken, 0) as days_spoken,
  coalesce(r.recordings, 0) as recordings,
  r.average_index,
  r.average_stars,
  r.last_spoken_at,
  coalesce(f.answered, 0) as answered,
  coalesce(f.matched_yes, 0) as matched_yes,
  coalesce(f.matched_roughly, 0) as matched_roughly,
  coalesce(f.matched_no, 0) as matched_no,
  coalesce(f.notes, 0) as notes
from public.testers t
join tester_admin.zones z on z.user_id = t.user_id
left join auth.users u on u.id = t.user_id
left join public.profiles p on p.user_id = t.user_id
left join public.onboarding o on o.user_id = t.user_id
left join lateral (
  select
    count(*) as recordings,
    count(distinct (x.created_at at time zone z.tz)::date) as days_spoken,
    round(avg(x.ethos_index)) as average_index,
    round(avg(x.stars), 2) as average_stars,
    max(x.created_at) as last_spoken_at
  from public.reps x
  where x.user_id = t.user_id and x.created_at >= t.created_at
) r on true
left join lateral (
  select
    count(*) as answered,
    count(*) filter (where y.answer = 'yes') as matched_yes,
    count(*) filter (where y.answer = 'roughly') as matched_roughly,
    count(*) filter (where y.answer = 'no') as matched_no,
    count(y.note) as notes
  from public.tester_feedback y
  where y.user_id = t.user_id
) f on true;

-- One row per recording a tester made since joining, with its numbers
-- and the answer they gave about it, if any.
create or replace view tester_admin.recordings as
select
  t.user_id,
  p.display_name as name,
  x.created_at as spoken_at,
  (x.created_at at time zone z.tz)::date as spoken_on,
  x.id as rep_id,
  x.lesson_id,
  x.mode,
  x.capture_mode,
  x.duration_s,
  x.ethos_index,
  x.stars,
  x.wpm,
  x.filler_count,
  case when jsonb_typeof(x.pauses) = 'array' then jsonb_array_length(x.pauses) end as pauses,
  tester_admin.num(x.dimensions #> '{tier1,pause}') as pause_score,
  tester_admin.num(x.dimensions #> '{tier1,fillers}') as fillers_score,
  tester_admin.num(x.dimensions #> '{tier1,repairs}') as repairs_score,
  tester_admin.num(x.dimensions #> '{tier1,pace}') as pace_score,
  tester_admin.num(x.dimensions #> '{tier1,range}') as range_score,
  tester_admin.num(x.dimensions #> '{tier2,structure,score}') as structure_score,
  tester_admin.num(x.dimensions #> '{tier2,credibility,score}') as credibility_score,
  tester_admin.num(x.dimensions #> '{tier2,engagement,score}') as engagement_score,
  tester_admin.num(x.dimensions #> '{tier2,confidence,score}') as confidence_score,
  x.presence_score,
  f.answer as matched,
  f.note,
  f.scores as scores_shown,
  f.updated_at as answered_at,
  x.transcript,
  x.audio_path
from public.testers t
join tester_admin.zones z on z.user_id = t.user_id
join public.reps x on x.user_id = t.user_id and x.created_at >= t.created_at
left join public.profiles p on p.user_id = t.user_id
left join lateral (
  select y.answer, y.note, y.scores, y.updated_at
    from public.tester_feedback y
   where y.user_id = x.user_id
     and (y.client_id = x.client_id or y.rep_id = x.id)
   order by y.updated_at desc
   limit 1
) f on true;

-- Every answer, with the scores it was given about, and its recording
-- when the upload stored one (rep_id is null when it never did).
create or replace view tester_admin.answers as
select
  y.user_id,
  p.display_name as name,
  y.answer,
  y.note,
  y.scores as scores_shown,
  tester_admin.num(y.scores -> 'index') as index_shown,
  tester_admin.num(y.scores -> 'stars') as stars_shown,
  y.created_at as first_answered_at,
  y.updated_at as answered_at,
  x.id as rep_id,
  x.created_at as spoken_at,
  y.client_id
from public.tester_feedback y
left join public.profiles p on p.user_id = y.user_id
left join lateral (
  select r.id, r.created_at
    from public.reps r
   where r.user_id = y.user_id
     and (r.client_id = y.client_id or r.id = y.rep_id)
   order by r.created_at
   limit 1
) x on true;

revoke all on all tables in schema tester_admin from public, anon, authenticated;
revoke all on all functions in schema tester_admin from public, anon, authenticated;
grant select on all tables in schema tester_admin to service_role;
grant execute on all functions in schema tester_admin to service_role;
