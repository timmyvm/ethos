-- Schema v3 — boss reps, stress mods, streak freezes, entitlement.
-- Closes the gaps BUILT.md listed as "looks finished but isn't".

-- A rep now knows what kind of rep it was and under what conditions.
-- mods/xp_multiplier feed XP only: stars stay the sole quality signal
-- (DECISIONS #10, #16), so difficulty buys effort credit, never score.
alter table reps add column if not exists mode text not null default 'daily';
alter table reps drop constraint if exists reps_mode_check;
alter table reps add constraint reps_mode_check check (mode in ('daily', 'boss'));

alter table reps add column if not exists mods text[] not null default '{}';
alter table reps add column if not exists xp_multiplier numeric(4, 2) not null default 1.00;
alter table reps drop constraint if exists reps_xp_multiplier_check;
alter table reps add constraint reps_xp_multiplier_check
  check (xp_multiplier between 1 and 4);

alter table reps add column if not exists boss_topic_id text;
-- {score, coverage, claims: [{quote, verdict, why}], missed: [...]}
alter table reps add column if not exists accuracy jsonb;

-- Entitlement. No Stripe yet; this is the flag every premium gate reads,
-- so wiring a processor later is a webhook that sets one boolean.
alter table profiles add column if not exists premium boolean not null default false;
alter table profiles add column if not exists premium_until timestamptz;

-- Freezes: one row per rescued day. Convenience, never truth
-- (DECISIONS #14) — a frozen day keeps the streak, it never earns stars,
-- XP or an Ethos Index.
create table if not exists streak_freezes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  used_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, used_on)
);

create index if not exists streak_freezes_user_idx
  on streak_freezes (user_id, used_on desc);

alter table streak_freezes enable row level security;

drop policy if exists "own freezes" on streak_freezes;
create policy "own freezes" on streak_freezes
  for select using (auth.uid() = user_id);

drop policy if exists "own freezes insert" on streak_freezes;
create policy "own freezes insert" on streak_freezes
  for insert with check (auth.uid() = user_id);

-- The client equips and spends freezes, so it needs write access to its
-- own streak row (select policy already exists from v1).
drop policy if exists "own streak insert" on streaks;
create policy "own streak insert" on streaks
  for insert with check (auth.uid() = user_id);

drop policy if exists "own streak update" on streaks;
create policy "own streak update" on streaks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Profiles are created client-side on first save-progress.
drop policy if exists "own profile insert" on profiles;
create policy "own profile insert" on profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
