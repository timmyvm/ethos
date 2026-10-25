-- 0013: the judged-analysis meter is the server's to move, like premium.
--
-- 0012's trigger froze the entitlement columns against a browser
-- session, but 0003's "own profile update" policy still let one rewrite
-- the meter 0004 added: judged_rollover, judged_accrued_on and
-- judged_analysis_used_at. Clearing judged_accrued_on before each
-- recording read as a first-ever recording (lib/metering.ts) and granted
-- a judged analysis every time, which is Premium's metered value for
-- free. Only writeMeterState on the service role (lib/db.ts) moves them
-- now. A browser session can still write its name and its pose.
--
-- The trigger 0012 made already calls this function, so redefining it is
-- the whole change.

create or replace function guard_profile_entitlement() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.premium := false;
      new.premium_until := null;
      new.premium_source := null;
      new.judged_rollover := 1;
      new.judged_accrued_on := null;
      new.judged_analysis_used_at := null;
    else
      new.premium := old.premium;
      new.premium_until := old.premium_until;
      new.premium_source := old.premium_source;
      new.judged_rollover := old.judged_rollover;
      new.judged_accrued_on := old.judged_accrued_on;
      new.judged_analysis_used_at := old.judged_analysis_used_at;
    end if;
  end if;
  return new;
end;
$$;
