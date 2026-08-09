-- Schema v1 — BUILD-PLAN.md. Step 1 stores reps; auth polish comes later,
-- so user_id is nullable for founder-dogfood reps.

create table if not exists reps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  lesson_id text,
  created_at timestamptz not null default now(),
  duration_s numeric not null,
  transcript text not null,
  wpm integer not null,
  filler_count integer not null,
  fillers jsonb not null default '[]', -- [{word, t}]
  pauses jsonb not null default '[]',  -- [{t, len, kind}] kind: beat|pre|mid
  stars smallint not null check (stars between 1 and 3),
  focus text,
  supply jsonb, -- {original, upgrade, note}
  audio_path text
);

create index if not exists reps_user_created_idx on reps (user_id, created_at desc);

create table if not exists lexicon (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  original text not null,
  upgrade text not null,
  rep_id uuid references reps (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current integer not null default 0,
  longest integer not null default 0,
  last_rep_date date,
  freezes_equipped smallint not null default 0 check (freezes_equipped between 0 and 2) -- DECISIONS.md #14
);

-- Private bucket for rep audio blobs.
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

alter table reps enable row level security;
alter table lexicon enable row level security;
alter table streaks enable row level security;

-- Owners read their own rows. Writes go through the service role for now
-- (the analyze route); user-scoped policies tighten when auth lands.
create policy "own reps" on reps for select using (auth.uid() = user_id);
create policy "own lexicon" on lexicon for select using (auth.uid() = user_id);
create policy "own streak" on streaks for select using (auth.uid() = user_id);
