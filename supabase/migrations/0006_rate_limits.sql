-- Schema v6 — rate limiting for the AI pipeline (launch prep, 25 Aug).
--
-- /api/analyze is the only route that spends money (Whisper on every
-- upload, Claude on scorable ones). This is the server-side throttle in
-- front of that spend: a sliding-window counter per subject, where a
-- subject is a user id (real or anonymous) or, with no session at all,
-- the caller's IP.
--
-- The check runs through the service role from the API route. Clients
-- never touch this table: RLS is on with no policies, and the function
-- is revoked from anon/authenticated.

create table if not exists rate_limits (
  id bigint generated always as identity primary key,
  subject text not null,
  at timestamptz not null default now()
);

create index if not exists rate_limits_subject_at
  on rate_limits (subject, at desc);

alter table rate_limits enable row level security;

-- One call = one permission check, and on success one consumed slot.
-- Counting and inserting under an advisory lock on the subject makes
-- concurrent requests queue for a few milliseconds instead of all
-- sneaking under the same count.
create or replace function consume_rate_limit(
  p_subject text,
  p_hour_limit int,
  p_day_limit int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hour int;
  v_day int;
  v_oldest timestamptz;
  v_retry int;
begin
  perform pg_advisory_xact_lock(hashtext('rate_limit:' || p_subject));

  -- Rows older than the widest window are dead weight; sweep them on
  -- the way through so the table can never grow past a day of traffic.
  delete from rate_limits
   where subject = p_subject
     and at < now() - interval '24 hours';

  select count(*) filter (where at > now() - interval '1 hour'),
         count(*)
    into v_hour, v_day
    from rate_limits
   where subject = p_subject;

  if v_day >= p_day_limit then
    select min(at) into v_oldest
      from rate_limits where subject = p_subject;
    v_retry := greatest(
      60,
      extract(epoch from (v_oldest + interval '24 hours') - now())::int
    );
    return jsonb_build_object(
      'allowed', false, 'window', 'day', 'retry_after_s', v_retry
    );
  end if;

  if v_hour >= p_hour_limit then
    select min(at) into v_oldest
      from rate_limits
     where subject = p_subject
       and at > now() - interval '1 hour';
    v_retry := greatest(
      30,
      extract(epoch from (v_oldest + interval '1 hour') - now())::int
    );
    return jsonb_build_object(
      'allowed', false, 'window', 'hour', 'retry_after_s', v_retry
    );
  end if;

  insert into rate_limits (subject) values (p_subject);
  return jsonb_build_object(
    'allowed', true, 'window', null, 'retry_after_s', 0
  );
end;
$$;

revoke execute on function consume_rate_limit(text, int, int)
  from public, anon, authenticated;
