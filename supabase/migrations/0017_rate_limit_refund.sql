-- 0017: a rate-limit slot spent on our outage is given back.
--
-- /api/analyze takes a slot (0006 consume_rate_limit) before it calls
-- Whisper, and the recording screen retries a failed upload three times.
-- When Whisper was down, every retry of ONE recording took another slot:
-- a new visitor (three an hour) hit "the floor reopens in about 60
-- minutes" after a single take that never scored, and the outbox's resend
-- got the same answer for the hour.
--
-- The route calls this when transcription fails for a reason that is not
-- the file's (Whisper 5xx or 429, no answer, not configured). A file
-- Whisper refuses (400, 413, 415) keeps its slot, so junk uploads still
-- cost one each. Only the service role calls it, as with the check.
--
-- No drop: this only adds a function. The delete inside it removes one
-- row of throttle data, the same table 0006 sweeps.

create or replace function public.refund_rate_limit(p_subject text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The same lock the check takes, so a refund never races a count.
  perform pg_advisory_xact_lock(hashtext('rate_limit:' || p_subject));
  delete from public.rate_limits
   where id = (
     select id from public.rate_limits
      where subject = p_subject
      order by at desc, id desc
      limit 1
   );
end;
$$;

revoke execute on function public.refund_rate_limit(text)
  from public, anon, authenticated;
