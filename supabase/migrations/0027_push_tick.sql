-- 0027: the reminder sender gets a clock of its own (DECISIONS #430).
--
-- The reminders are sent by GET /api/push/cron, ticked hourly. Vercel Hobby
-- crons are daily-only (#186), so GitHub Actions ticked it with
-- "17 * * * *", and GitHub ran that 60 times from 25 Oct to 9 Nov: about 4
-- a day, gaps up to 10 h 40 m. A chosen hour with no tick in it was never
-- served (28 of 60 chosen hour-days in Melbourne, 30 Oct to 8 Nov).
--
-- pg_cron in this database ticks it at minute 1 of every hour instead (the
-- server's clock a second behind at 18:00:00 would read 17:59 and slip
-- the 6 pm reminder an hour; minute 1 cannot). pg_net makes the call. The
-- sender claims each person's day before it sends, so GitHub's backup
-- ticks on top of this one never ring anyone twice.
--
-- Safe to apply anywhere: this file holds no URL and no secret. Both live
-- in Vault, set by hand in production only (docs/reminders-ops.md):
--
--   select vault.create_secret('https://speakethos.com/api/push/cron', 'push_tick_url');
--   select vault.create_secret('<PUSH_TICK_SECRET, as in Vercel>', 'push_tick_secret');
--
-- Until both exist the job wakes, finds nothing and calls nobody, so a
-- branch database, a local stack or a restored copy never rings production.
--
-- Check it ran:
--   select status, start_time, return_message from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'push-tick')
--    order by start_time desc limit 5;
--   select status_code, content, created from net._http_response order by created desc limit 5;
-- Stop it:
--   select cron.unschedule('push-tick');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Closed to the API: PostgREST serves public only.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.push_tick()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  tick_url text;
  tick_secret text;
begin
  select decrypted_secret into tick_url
    from vault.decrypted_secrets where name = 'push_tick_url';
  select decrypted_secret into tick_secret
    from vault.decrypted_secrets where name = 'push_tick_secret';
  if coalesce(tick_url, '') = '' or coalesce(tick_secret, '') = '' then
    return null;
  end if;
  -- The request id; pg_net answers in net._http_response.
  return net.http_get(
    url := tick_url,
    -- The agent names the caller on /active's reminder clock (#430 review).
    headers := jsonb_build_object('Authorization', 'Bearer ' || tick_secret, 'User-Agent', 'pg_net push-tick'),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function private.push_tick() from public, anon, authenticated;

-- Minute 1 of every hour, UTC: every whole-hour zone gets HH:01 local, a
-- half-hour zone (Adelaide, India) HH:31, inside the hour it chose.
-- Scheduling by name replaces a job of the same name, so a rerun is safe.
select cron.schedule('push-tick', '1 * * * *', $$select private.push_tick()$$);
