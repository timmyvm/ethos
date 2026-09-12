-- The introduction's answers and the portfolio built from them
-- (DECISIONS #232). One row per user, upserted; given before a session
-- exists, so the device holds them first and this follows the account
-- to the next phone. Every column is a closed set the client validates
-- too (content/portfolio.ts); the portfolio is the built plan, kept so
-- a new device paints it without rebuilding, and `rules_version` says
-- which table built it so it can be rebuilt when the table moves.
-- Nothing here feeds a score.
create table if not exists public.onboarding (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  age_band      text check (age_band in ('u18', '18_24', '25_34', '35_plus')),
  goal          text check (goal in ('sharper', 'present', 'feet', 'anyone')),
  pains         text[] not null default '{}' check (cardinality(pains) <= 3),
  level         text check (level in ('never', 'some', 'often')),
  context       text check (context in ('class', 'work', 'social', 'online')),
  portfolio     jsonb not null default '{}'::jsonb,
  rules_version integer not null default 1,
  answered_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.onboarding enable row level security;

drop policy if exists "onboarding: own row" on public.onboarding;
create policy "onboarding: own row" on public.onboarding
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
