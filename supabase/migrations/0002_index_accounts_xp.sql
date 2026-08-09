-- Schema v2 — Ethos Index + accounts/XP groundwork (mechanics.md Aug 9
-- update; DECISIONS #15–19). League tables land with step 3.

alter table reps add column if not exists strength text;
alter table reps add column if not exists ethos_index integer
  check (ethos_index between 0 and 1000);
-- {tier1: {pause,fillers,pace,range}, anchors: {hedgeCount,restartCount},
--  tier2: {structure,credibility,engagement,confidence:
--          {score, citedMoment, improve}} | null}
alter table reps add column if not exists dimensions jsonb;

create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount > 0),
  source text not null check (source in ('rep', 'boss', 'mod')),
  rep_id uuid references reps (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists xp_events_user_created_idx
  on xp_events (user_id, created_at desc);

alter table profiles enable row level security;
alter table xp_events enable row level security;

create policy "own profile" on profiles for select using (auth.uid() = user_id);
create policy "own xp" on xp_events for select using (auth.uid() = user_id);
