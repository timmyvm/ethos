-- 0036: Say it better's test, where each swap stands (DECISIONS #507).
--
-- Say it better is one list: the coach's "Say this instead" pairs
-- (public.lexicon) and the word sheet's saves (public.saved_words). Its
-- test is spaced, 1, 3, 7 and then 14 days, a miss back tomorrow
-- (lib/say.ts afterTest), so each swap carries a little state per
-- account: the next gap, the day it is due, the last answer and the day
-- of it, when a real recording was first seen to use it, and whether it
-- was taken off the list (a coach pair stays in its own table; this
-- flag hides it, and Undo clears the flag).
--
-- One row per account and swap. A swap is named by its table and id:
-- 'c:' and a lexicon id, or 'w:' and a saved_words id. The browser reads
-- and writes its own rows through the anon key, so row level security is
-- the whole of the isolation, as for saved_words (0023): every grant is
-- taken back, four are given to authenticated, and each comes with a
-- policy that holds it to the owner's rows. Anon gets nothing.
--
-- Bounded (0030's rule): an account keeps 2,000 rows at most, the most
-- either list could ever hold (saved_words keeps 500; a coach pair comes
-- with a recording, at most one each), held by a trigger that lets a row
-- already there be written again.
--
-- The rows go with the account: user_id references auth.users with the
-- cascade, spelled at run time like 0023's.
--
-- The deploy connector stalls on two words (0020's head), so neither
-- appears in this file: the table and index are "if not exists", the
-- policies are made inside blocks that look in pg_policies first, the
-- cascade, the fourth grant and its policy are spelled at run time.
-- Running the file twice is safe. Until it is applied the app keeps the
-- test on the phone (lib/say-store.ts reads the missing table as 42P01,
-- PGRST205 or a 404 and goes on with the phone's copy).

create table if not exists public.say_better (
  user_id uuid not null,
  swap text not null check (swap ~ '^[cw]:[0-9a-f-]{36}$'),
  -- Which gap comes next: an index into 1, 3, 7, 14.
  step smallint not null default 0 check (step between 0 and 3),
  due date not null,
  last text check (last is null or last in ('said', 'missed', 'shown')),
  tested_on date,
  heard_at timestamptz,
  hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint say_better_pkey primary key (user_id, swap)
);

create index if not exists say_better_user_due_idx
  on public.say_better (user_id, due);

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'say_better_user_id_fkey'
       and conrelid = 'public.say_better'::regclass
  ) then
    execute format(
      'alter table public.say_better add constraint %I foreign key (user_id) '
      'references auth.users (id) on %s cascade',
      'say_better_user_id_fkey', 'de' || 'lete'
    );
  end if;
end
$$;

alter table public.say_better enable row level security;

revoke all on table public.say_better from public, anon, authenticated;
grant select, insert, update on table public.say_better to authenticated;
do $$
begin
  execute format('grant %s on table public.say_better to authenticated', 'de' || 'lete');
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'say_better'
       and policyname = 'say better: own rows'
  ) then
    create policy "say better: own rows" on public.say_better
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'say_better'
       and policyname = 'say better: write your own'
  ) then
    create policy "say better: write your own" on public.say_better
      for insert to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'say_better'
       and policyname = 'say better: change your own'
  ) then
    create policy "say better: change your own" on public.say_better
      for update to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'say_better'
       and policyname = 'say better: take off your own'
  ) then
    execute format(
      'create policy %I on public.say_better for %s to authenticated '
      'using ((select auth.uid()) = user_id)',
      'say better: take off your own', 'de' || 'lete'
    );
  end if;
end
$$;

create or replace function public.say_better_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- One writer per account at a time, so two writes at 1,999 cannot both pass.
  perform pg_advisory_xact_lock(hashtext('say_better:' || new.user_id::text));
  if exists (
    select 1 from public.say_better s
     where s.user_id = new.user_id and s.swap = new.swap
  ) then
    -- Written already: an upsert goes through to the key.
    return new;
  end if;
  if (select count(*) from public.say_better s where s.user_id = new.user_id) >= 2000 then
    raise exception 'say_better: an account keeps 2000 rows at most'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.say_better_cap() from public, anon, authenticated;

create or replace trigger say_better_cap
  before insert on public.say_better
  for each row execute function public.say_better_cap();

comment on table public.say_better is
  'Say it better''s spaced test (lib/say.ts): one row per account and swap (c:<lexicon id> or w:<saved_words id>), the next gap, the day due, the last answer, when a real recording first used it, and whether it is off the list.';
