-- 0030: the last three tables a browser could fill, bounded (security
-- audit, 11 Nov, second pass).
--
-- 0021 and 0024 closed this for tester answers and saved words: a guest
-- session is free to make, and a table it can write without end pushes
-- the database to its size cap, which stops writes for the whole app.
-- Three older tables were still open the same way:
--
--   streak_freezes  any signed-in session could insert a row for every
--                   date there is, thousands to a request.
--   onboarding      one row an account, but `portfolio` and each of
--                   `pains` took text of any length.
--   profiles        the same for `display_name` and `equipped_pose`.
--
-- So an account keeps 400 freeze days at most, none on a day that has
-- not begun anywhere yet, and the four columns are held to several times
-- the longest value the app writes: a name is 24 characters in the app
-- (MAX_NAME), a pose id 14, a pain 8, the plan about 1,000 bytes.
--
-- Last, a function made later in public starts with no caller but its
-- owner and the server, as 0029 did for tables: a migration gives the
-- browser each one on purpose.
--
-- The deploy connector stalls on two words (0020's head), so neither
-- appears here. Running the file twice is safe.

-- 1. Freeze days, bounded per account.
create or replace function public.streak_freezes_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- A freeze covers a day that was missed, so never one that has not
  -- begun. The zone furthest ahead is UTC+14.
  if new.used_on > ((now() at time zone 'utc') + interval '14 hours')::date then
    raise exception 'streak_freezes: a freeze is for a day that has come'
      using errcode = 'check_violation';
  end if;
  -- One writer per account at a time, so two at 399 cannot both pass. A
  -- row-level BEFORE trigger sees the rows its own statement has already
  -- written, so a bulk insert counts as it goes (0024).
  perform pg_advisory_xact_lock(hashtext('streak_freezes:' || new.user_id::text));
  if exists (
    select 1 from public.streak_freezes f
     where f.user_id = new.user_id and f.used_on = new.used_on
  ) then
    -- Spent already: the unique key answers it, not the cap.
    return new;
  end if;
  if (select count(*) from public.streak_freezes f where f.user_id = new.user_id) >= 400 then
    raise exception 'streak_freezes: an account keeps 400 freeze days at most'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.streak_freezes_cap() from public, anon, authenticated;

create or replace trigger streak_freezes_cap
  before insert on public.streak_freezes
  for each row execute function public.streak_freezes_cap();

-- 2. The four open columns, each added once behind a look in pg_constraint.
do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('profiles',   'profiles_display_name_len',  'display_name is null or char_length(display_name) <= 64'),
      ('profiles',   'profiles_equipped_pose_len', 'equipped_pose is null or char_length(equipped_pose) <= 40'),
      ('onboarding', 'onboarding_pains_len',       'char_length(array_to_string(pains, '''')) <= 72'),
      ('onboarding', 'onboarding_portfolio_size',  'octet_length(portfolio::text) <= 20000')
    ) as t(tbl, name, rule)
  loop
    if not exists (
      select 1 from pg_constraint
       where conname = c.name and conrelid = format('public.%I', c.tbl)::regclass
    ) then
      execute format('alter table public.%I add constraint %I check (%s)', c.tbl, c.name, c.rule);
    end if;
  end loop;
end $$;

-- 3. A later function starts closed. The first line takes back what
--    Postgres gives everyone on any new function; the second what
--    Supabase gives the browser's roles on one made in public. The
--    server's role keeps its own.
alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
