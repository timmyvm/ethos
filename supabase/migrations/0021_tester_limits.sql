-- 0021: a tester's answers, bounded, and kept only under the consent
-- that names the services every recording goes through.
--
-- Two things 0020 left open (the review of 30 Oct):
--
--   1. A tester writes answers straight through the API, and nothing
--      capped how many. The code is four digits and an anonymous account
--      is free, so one statement could store thousands of rows and push
--      the database toward its size cap, which stops writes for the
--      whole app. A tester answers once per recording: twenty a day for
--      fourteen days would be 280. So an account keeps 300 answers at
--      most, and a trigger refuses the next new one. Changing an answer
--      already there (the browser's upsert) still works at the cap.
--   2. Consent version 2 (content/tester.ts) says which services process
--      a tester's recordings; version 1 said nothing was shared. An answer
--      is now taken only from a tester whose consent is version 2 or
--      later, in both answer policies, so a version 1 tester is asked
--      again (the results screen hides the question until they are)
--      before anything more is kept. Raise the 2 here, in a new file,
--      when a later consent changes what is collected.
--
-- The deploy connector stalls on two words (0020's head), so neither
-- appears here: the function and trigger are "create or replace", and
-- the policies are changed in place with alter policy, each inside a DO
-- block that looks for it first. Running the file twice is safe.

-- 1. At most 300 answers per account -----------------------------------------

create or replace function public.tester_feedback_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- One writer per account at a time, so two requests at 299 cannot
  -- both pass. A row-level BEFORE trigger sees the rows its own
  -- statement has already written, so a bulk insert counts as it goes.
  perform pg_advisory_xact_lock(hashtext('tester_feedback:' || new.user_id::text));
  if exists (
    select 1 from public.tester_feedback f
     where f.user_id = new.user_id and f.client_id = new.client_id
  ) then
    -- An answer changed (insert on conflict update), not a new one.
    return new;
  end if;
  if (select count(*) from public.tester_feedback f where f.user_id = new.user_id) >= 300 then
    raise exception 'tester_feedback: an account keeps 300 answers at most'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.tester_feedback_cap() from public, anon, authenticated;

create or replace trigger tester_feedback_cap
  before insert on public.tester_feedback
  for each row execute function public.tester_feedback_cap();

-- 2. Answers only under consent version 2 or later --------------------------

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
             and t.consent_version >= 2
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
             and t.consent_version >= 2
        )
      );
  end if;
end
$$;
