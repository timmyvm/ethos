-- 0022: what a tester agrees to in consent version 3, and the match
-- answer as a direction.
--
-- Timothy asked to keep everything a tester does while they test. A
-- blanket waiver does not hold in Australia; consent to a named list
-- does, so consent version 3 (content/tester.ts CONSENT) names it all:
-- recordings, transcripts, scores, answers, how the app is used, the
-- device, the connection and the problems. The first three were kept
-- already (reps, 0001). This file adds the rest:
--
--   1. public.tester_events: one table for the three new kinds, told
--      apart by `kind`: a device snapshot on each open ('device'), what
--      a tester does on screen ('usage'), and what broke ('error').
--      One table because one batch from the phone is one insert, and it
--      keeps one policy, one cascade, one index and one line in the
--      guide's removal steps; the views below split it three ways for
--      the report. Only the server writes it (app/api/tester/collect,
--      with the service role), and only for a tester on version 3 or
--      later: the browser has no grant to write here at all. The owner
--      may read their own rows.
--   2. public.tester_feedback widened: `answer` becomes a direction
--      (too_low, about_right, too_high) beside the three old values,
--      which stay readable, and `felt` is the one tap before the score
--      shows (rough, okay, strong). A row may hold only `felt`, so the
--      answer may now be empty; a row must say one of the two.
--   3. Answers only under consent version 3 or later (0021 asked for 2).
--   4. The report: tester_admin.devices, .usage, .screens and .errors,
--      and the felt and direction counts on the existing views.
--
-- The deploy connector stalls on two words (0020's head), so neither
-- appears in this file. Clauses that need them are spelled at run time
-- inside DO blocks, as 0020 spells its cascade, and every policy and
-- constraint is looked for before it is made. Running the file twice
-- is safe.

-- 1. Device, usage and errors ----------------------------------------------

create table if not exists public.tester_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  kind text not null check (kind in ('device', 'usage', 'error')),
  -- What happened, from a fixed list per kind (lib/tester-events.ts).
  name text not null check (
    (kind = 'device' and name = 'open')
    or (kind = 'usage' and name in ('screen', 'tap', 'shown', 'hidden', 'record_start', 'record_stop'))
    or (kind = 'error' and name in ('window', 'rejection', 'boundary'))
  ),
  -- One open of the app: every event from one page load shares it.
  open_id text check (open_id is null or open_id ~ '^[A-Za-z0-9-]{1,40}$'),
  -- The screen's path, never its query: no code, no token, no search.
  screen text check (screen is null or (char_length(screen) between 1 and 120 and left(screen, 1) = '/')),
  -- A tap's visible label or accessible name. Never typed text.
  label text check (label is null or char_length(label) between 1 and 80),
  -- Time on a screen, in milliseconds, at most a day.
  ms integer check (ms is null or ms between 0 and 86400000),
  -- The rest, flat and capped by the route: the device's fields, an
  -- error's message and the last few usage events before it.
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 6000),
  -- The address the open came from, on device rows (the route adds it).
  ip inet,
  -- When it happened on the phone (the route keeps it within a week),
  -- and when the server took it.
  at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists tester_events_user_at
  on public.tester_events (user_id, at);
create index if not exists tester_events_kind_at
  on public.tester_events (kind, at desc);

-- Each user_id goes with its account, the clause assembled at run time.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'tester_events_user_id_fkey'
       and conrelid = 'public.tester_events'::regclass
  ) then
    execute format(
      'alter table public.tester_events add constraint tester_events_user_id_fkey '
      'foreign key (user_id) references auth.users (id) on %s cascade',
      'de' || 'lete'
    );
  end if;
end
$$;

alter table public.tester_events enable row level security;

-- The owner reads; nobody writes from the browser. The route writes
-- with the service role, which row level security does not stop.
revoke all on table public.tester_events from public, anon, authenticated;
grant select on table public.tester_events to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'tester_events'
       and policyname = 'tester events: own rows'
  ) then
    create policy "tester events: own rows" on public.tester_events
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end
$$;

-- 2. The match answer as a direction, and how it felt ---------------------

alter table public.tester_feedback
  add column if not exists felt text check (felt is null or felt in ('rough', 'okay', 'strong'));

do $$
declare
  c record;
begin
  -- 0020's check named only yes, roughly and no. It is replaced by one
  -- that keeps those readable and adds the direction.
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.tester_feedback'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%roughly%'
       and pg_get_constraintdef(oid) not like '%too_low%'
  loop
    execute format('alter table public.tester_feedback %s constraint %I', 'dr' || 'op', c.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.tester_feedback'::regclass
       and conname = 'tester_feedback_answer_direction_check'
  ) then
    alter table public.tester_feedback add constraint tester_feedback_answer_direction_check
      check (answer is null or answer in ('yes', 'roughly', 'no', 'too_low', 'about_right', 'too_high'));
  end if;

  -- How it felt can come before any answer about the score.
  execute format('alter table public.tester_feedback alter column answer %s not null', 'dr' || 'op');

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.tester_feedback'::regclass
       and conname = 'tester_feedback_says_something_check'
  ) then
    alter table public.tester_feedback add constraint tester_feedback_says_something_check
      check (answer is not null or felt is not null);
  end if;
end
$$;

-- 3. Answers only under consent version 3 or later -------------------------
--
-- Version 3 names everything kept, the feeling before the score among
-- it, so a tester on 1 or 2 agrees again (the app asks once, on their
-- next open) before another answer is taken. 0021's cap stays as it is.

do $$
begin
  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'tester_feedback'
       and policyname = 'tester feedback: testers insert their own'
  ) then
    alter policy "tester feedback: testers insert their own" on public.tester_feedback
      with check (
        (select auth.uid()) = user_id
        and exists (
          select 1 from public.testers t
           where t.user_id = (select auth.uid())
             and t.consent_version >= 3
        )
      );
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'tester_feedback'
       and policyname = 'tester feedback: testers change their own'
  ) then
    alter policy "tester feedback: testers change their own" on public.tester_feedback
      using ((select auth.uid()) = user_id)
      with check (
        (select auth.uid()) = user_id
        and exists (
          select 1 from public.testers t
           where t.user_id = (select auth.uid())
             and t.consent_version >= 3
        )
      );
  end if;
end
$$;

-- 4. Timothy's report ---------------------------------------------------------
--
-- Read in the SQL editor (docs/testers.md):
--   select * from tester_admin.devices order by tester_number, last_open desc;
--   select * from tester_admin.usage order by day desc, tester_number;
--   select * from tester_admin.screens order by tester_number, minutes desc;
--   select * from tester_admin.errors order by at desc;

-- A jsonb value as a boolean, or null when it is anything else.
create or replace function tester_admin.bool(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(j) = 'boolean' then (j #>> '{}')::boolean end
$$;

-- Each device a tester opened Ethos on (one user agent at one screen
-- size), with its latest snapshot and how often it opened.
create or replace view tester_admin.devices as
select
  g.user_id,
  upper(left(g.user_id::text, 8)) as tester_number,
  p.display_name as name,
  l.data ->> 'model' as model,
  l.data ->> 'os' as os,
  l.data ->> 'browser' as browser,
  g.screen_size,
  tester_admin.num(l.data -> 'dpr') as pixel_ratio,
  l.data ->> 'lang' as language,
  l.data ->> 'tz' as time_zone,
  tester_admin.bool(l.data -> 'home_screen') as on_home_screen,
  l.data ->> 'display' as display_mode,
  l.data ->> 'connection' as connection,
  l.data ->> 'effective' as effective_type,
  tester_admin.num(l.data -> 'downlink') as downlink_mbps,
  tester_admin.num(l.data -> 'rtt') as round_trip_ms,
  tester_admin.bool(l.data -> 'save_data') as save_data,
  l.ip as last_ip,
  g.addresses,
  g.opens,
  g.first_open,
  g.last_open,
  g.user_agent
from (
  select
    e.user_id,
    e.data ->> 'ua' as user_agent,
    concat_ws('x', e.data ->> 'screen_w', e.data ->> 'screen_h') as screen_size,
    count(*) as opens,
    count(distinct e.ip) as addresses,
    min(e.at) as first_open,
    max(e.at) as last_open
  from public.tester_events e
  where e.kind = 'device'
  group by 1, 2, 3
) g
left join lateral (
  select e.data, e.ip
    from public.tester_events e
   where e.kind = 'device'
     and e.user_id = g.user_id
     and (e.data ->> 'ua') is not distinct from g.user_agent
     and concat_ws('x', e.data ->> 'screen_w', e.data ->> 'screen_h') = g.screen_size
   order by e.at desc
   limit 1
) l on true
left join public.profiles p on p.user_id = g.user_id;

-- Each tester's day (on their own calendar, as tester_admin.testers
-- counts days): opens, screens, minutes on screen, taps, recordings
-- started and stopped, and problems.
create or replace view tester_admin.usage as
select
  e.user_id,
  upper(left(e.user_id::text, 8)) as tester_number,
  p.display_name as name,
  (e.at at time zone coalesce(z.tz, 'Australia/Melbourne'))::date as day,
  count(*) filter (where e.kind = 'device') as opens,
  count(*) filter (
    where e.kind = 'usage' and e.name = 'screen'
      and tester_admin.bool(e.data -> 'cont') is not true
  ) as screens,
  round(coalesce(sum(e.ms) filter (where e.kind = 'usage' and e.name = 'screen'), 0) / 60000.0, 1)
    as minutes,
  count(*) filter (where e.kind = 'usage' and e.name = 'tap') as taps,
  count(*) filter (where e.kind = 'usage' and e.name = 'record_start') as recordings_started,
  count(*) filter (where e.kind = 'usage' and e.name = 'record_stop') as recordings_stopped,
  count(*) filter (where e.kind = 'error') as errors,
  min(e.at) as first_at,
  max(e.at) as last_at
from public.tester_events e
left join tester_admin.zones z on z.user_id = e.user_id
left join public.profiles p on p.user_id = e.user_id
group by e.user_id, p.display_name, (e.at at time zone coalesce(z.tz, 'Australia/Melbourne'))::date;

-- Each tester's screens over the whole test: how often each opened,
-- the minutes on it, and the taps made there.
create or replace view tester_admin.screens as
select
  e.user_id,
  upper(left(e.user_id::text, 8)) as tester_number,
  p.display_name as name,
  e.screen,
  count(*) filter (
    where e.name = 'screen' and tester_admin.bool(e.data -> 'cont') is not true
  ) as views,
  round(coalesce(sum(e.ms) filter (where e.name = 'screen'), 0) / 60000.0, 1) as minutes,
  count(*) filter (where e.name = 'tap') as taps
from public.tester_events e
left join public.profiles p on p.user_id = e.user_id
where e.kind = 'usage' and e.screen is not null
group by e.user_id, p.display_name, e.screen;

-- Every problem, newest first in the guide's query: where it happened,
-- what it said, the usage events just before it, and the device.
create or replace view tester_admin.errors as
select
  e.user_id,
  upper(left(e.user_id::text, 8)) as tester_number,
  p.display_name as name,
  e.at,
  e.name as source,
  e.screen,
  e.data ->> 'message' as message,
  e.data ->> 'where' as code_at,
  e.data ->> 'digest' as digest,
  e.data -> 'before' as on_screen,
  e.data ->> 'stack' as stack,
  d.data ->> 'model' as model,
  d.data ->> 'os' as os,
  d.data ->> 'browser' as browser,
  e.open_id
from public.tester_events e
left join public.profiles p on p.user_id = e.user_id
left join lateral (
  select x.data
    from public.tester_events x
   where x.kind = 'device'
     and x.user_id = e.user_id
     and x.at <= e.at + interval '1 minute'
   order by (x.open_id is not distinct from e.open_id) desc, x.at desc
   limit 1
) d on true
where e.kind = 'error';

-- The views 0020 made, with the new answers counted. A replaced view
-- keeps every column it had, in order, so the new ones come last.
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
  coalesce(f.notes, 0) as notes,
  upper(left(t.user_id::text, 8)) as tester_number,
  coalesce(f.too_low, 0) as too_low,
  coalesce(f.about_right, 0) as about_right,
  coalesce(f.too_high, 0) as too_high,
  coalesce(f.felt_rough, 0) as felt_rough,
  coalesce(f.felt_okay, 0) as felt_okay,
  coalesce(f.felt_strong, 0) as felt_strong,
  coalesce(v.opens, 0) as opens,
  coalesce(v.minutes, 0) as minutes_in_app,
  coalesce(v.errors, 0) as errors,
  v.last_open
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
    count(y.answer) as answered,
    count(*) filter (where y.answer = 'yes') as matched_yes,
    count(*) filter (where y.answer = 'roughly') as matched_roughly,
    count(*) filter (where y.answer = 'no') as matched_no,
    count(y.note) as notes,
    count(*) filter (where y.answer = 'too_low') as too_low,
    count(*) filter (where y.answer = 'about_right') as about_right,
    count(*) filter (where y.answer = 'too_high') as too_high,
    count(*) filter (where y.felt = 'rough') as felt_rough,
    count(*) filter (where y.felt = 'okay') as felt_okay,
    count(*) filter (where y.felt = 'strong') as felt_strong
  from public.tester_feedback y
  where y.user_id = t.user_id
) f on true
left join lateral (
  select
    count(*) filter (where e.kind = 'device') as opens,
    round(coalesce(sum(e.ms) filter (where e.kind = 'usage' and e.name = 'screen'), 0) / 60000.0, 1)
      as minutes,
    count(*) filter (where e.kind = 'error') as errors,
    max(e.at) filter (where e.kind = 'device') as last_open
  from public.tester_events e
  where e.user_id = t.user_id
) v on true;

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
  x.audio_path,
  f.felt,
  upper(left(t.user_id::text, 8)) as tester_number
from public.testers t
join tester_admin.zones z on z.user_id = t.user_id
join public.reps x on x.user_id = t.user_id and x.created_at >= t.created_at
left join public.profiles p on p.user_id = t.user_id
left join lateral (
  select y.answer, y.note, y.scores, y.updated_at, y.felt
    from public.tester_feedback y
   where y.user_id = x.user_id
     and (y.client_id = x.client_id or y.rep_id = x.id)
   order by y.updated_at desc
   limit 1
) f on true;

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
  y.client_id,
  y.felt,
  upper(left(y.user_id::text, 8)) as tester_number
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
