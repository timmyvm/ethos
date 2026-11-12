-- 0032: a tester who stopped writes no more answers (DECISIONS #464).
--
-- 0025 gave testers a way to stop, and the collector and the consent
-- both hold to it: nothing more is kept once they do. tester_feedback's
-- own policies (0022) never looked at stopped_at, so a stopped tester's
-- stale tab, or a console, could still add and change answers. Both
-- policies now ask that the tester has not stopped.
--
-- Applied by hand in the SQL editor, as 0019 to 0031 were. Safe to run
-- twice: each policy is altered only where it exists.
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
