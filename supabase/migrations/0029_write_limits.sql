-- 0029: what a browser may write, bounded (DECISIONS #457, the security sweep).
--
-- Anonymous sign-in makes a session free, and a session writes some rows
-- of its own straight through the REST API. 0021 bounded tester_feedback
-- for that reason; these are the rest a browser writes with no size of
-- its own, and a tester who stopped is no longer one who can write.
--
-- NOT VALID: the checks hold for every new or changed row and do not scan
-- (or refuse to apply over) a row stored before them. Applied by hand in
-- the SQL editor, as 0019 to 0028 were. Safe to run twice.

-- 1 to 3, each added only where it is not there yet, so a second run
-- changes nothing.
do $$
begin
  -- 1. The name a person gives: the introduction's 24 (lib/answers.ts MAX_NAME).
  if not exists (select 1 from pg_constraint where conname = 'profiles_display_name_len') then
    alter table public.profiles
      add constraint profiles_display_name_len
      check (display_name is null or char_length(display_name) <= 24) not valid;
  end if;

  -- 2. The pose Demos wears on You: a shop id (lib/shop.ts), never free text.
  if not exists (select 1 from pg_constraint where conname = 'profiles_equipped_pose_id') then
    alter table public.profiles
      add constraint profiles_equipped_pose_id
      check (equipped_pose is null or equipped_pose ~ '^pose_[a-z_]{1,40}$') not valid;
  end if;

  -- 3. The plan built from the introduction's answers: a few hundred bytes
  --    in practice (content/portfolio.ts), sixteen thousand at most.
  if not exists (select 1 from pg_constraint where conname = 'onboarding_portfolio_size') then
    alter table public.onboarding
      add constraint onboarding_portfolio_size
      check (pg_column_size(portfolio) <= 16000) not valid;
  end if;
end
$$;

-- 4. A tester who stopped (0025) writes no more answers: the consent says
--    nothing more is kept once they stop.
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
             and t.stopped_at is null
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
             and t.stopped_at is null
        )
      );
  end if;
end
$$;
