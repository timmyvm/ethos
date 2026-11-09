# Reminders that reach people: what production needs (DECISIONS #430)

The production steps below were run from the session on 9 Nov, after the
deploy (#432). They need no Vercel setting: the clock's secret is made inside
the database and never leaves it, and the founder list for `/active` is a
table there. Rerun them only for a new project.

**The hourly clock is the ship gate, not a follow-up (#430 review).** The
code alone does not deliver the evening reminders: replayed on GitHub's real
ticks, 30 Oct to 8 Nov in Melbourne, the 8 pm reminder went out on 4 of 10
days and the 9 pm one (the hour both introduction pickers chose) on 2,
because a 9 pm pick can only be served by a tick between 21:00 and 21:59 and
quiet hours begin at 22. GitHub's three new schedules have never been
measured. So the branch ships with a clock at minute 1 of every hour, either
the database's (steps 2 to 5) or cron-job.org's (the route under "Without
the database's clock"), and `/active`'s "Reminder
clock" saying "N of 24 hours" the next day.

## Why

- GitHub ran the hourly reminder tick (`17 * * * *`) 60 times from 25 Oct to
  9 Nov: about 4 a day, gaps up to 10 h 40 m. Every run answered 200; the
  scheduler was the fault. 28 of 60 chosen hour-days in Melbourne had a tick
  in their window; on Sunday 8 Nov the 6 pm subscribers got nothing.
- With a tick at minute 1 of every hour, every chosen hour is served at
  HH:01 (lib/push-ticks.test.ts replays it).

## What ships in the branch (code only)

- The sender (`app/api/push/cron`) accepts `CRON_SECRET`, `PUSH_TICK_SECRET`
  (32 characters or more), or a bearer the database says is its own clock's
  secret (`public.push_tick_ok`, 0028, service role only), claims each person's day before it sends (two callers in the
  same minute ring once), serves a late tick until quiet hours begin (not
  naming an hour that has passed), and answers why: `{ ok, subs, due, done,
  unsure, taken, sent, failed, dropped }`.
- `.github/workflows/push-cron.yml`: the backup, three schedules an hour
  (:07, :29, :48) and a concurrency group. Uses the existing `CRON_SECRET`.
- `supabase/migrations/0027_push_tick.sql`: pg_cron + pg_net, minute 1 of
  every hour, URL and secret read from Vault. It holds no URL and no secret,
  and without the two Vault entries it calls nobody, so a branch or local
  database never rings production.
- `supabase/migrations/0028_db_held_secrets.sql`: `public.push_tick_ok`
  (is this bearer the Vault secret?) and `public.is_founder_email` (is this
  address in `private.founders`?), both callable by the service role only.
- `POST /api/push/test` behind Settings' "Send a test".

## Production, in this order

1. **Deploy** (main). Migration 0026 goes first if a new project lacks it.

2. **Supabase, extensions and migrations**: apply
   `supabase/migrations/0027_push_tick.sql` then `0028_db_held_secrets.sql`
   (they create pg_cron and pg_net; if a project refuses, enable both in the
   dashboard first: Integrations, Cron; Database, Extensions, `pg_net`). 0027
   schedules the job `push-tick` at `1 * * * *` (UTC, so HH:01 in every
   whole-hour zone).

3. **Vault** (SQL editor, one run). The secret is made here and is never
   copied anywhere:
   ```sql
   select vault.create_secret('https://speakethos.com/api/push/cron', 'push_tick_url', 'The reminder sender');
   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_tick_secret', 'Bearer for /api/push/cron, checked by public.push_tick_ok');
   ```

4. **The founder**, for `/active` (a confirmed, non-anonymous account):
   ```sql
   insert into private.founders (email) values (lower('<your account email>'));
   ```
   `ADMIN_EMAILS` in Vercel still works beside it; neither set, the page
   answers as if it did not exist.

5. **Check, after the next HH:01** (SQL editor):
   ```sql
   select status, start_time, return_message
     from cron.job_run_details
    where jobid = (select jobid from cron.job where jobname = 'push-tick')
    order by start_time desc limit 5;

   select status_code, content, created
     from net._http_response order by created desc limit 5;
   ```
   Want: `succeeded`, and `200` with a body like
   `{"ok":true,"subs":4,"due":0,"done":0,"unsure":0,"taken":0,"sent":0,"failed":0,"dropped":0}`.
   A `401` means the deploy is older than 0028's check, or the Vault secret
   is under 32 characters; a `403` means Vercel's bot protection is on for
   the route.

6. **Your iPhone** (the whole path, about a minute):
   - Open speakethos.com in Safari, Share, Add to Home Screen, open it from
     the Home Screen.
   - Record a take. On the results, "Same time tomorrow?" with "Remind me at
     <hour>". Tap it, then Allow. It says "Tomorrow, <hour>." only once the
     server has the subscription.
   - Settings, Reminders: "Send a test". It should arrive in seconds with the
     app closed. If it does not: iPhone Settings, Notifications, Ethos.

7. **The next day**, open `speakethos.com/active` signed in: "Reminder
   clock" lists each caller with its last tick and how many of the last 24
   hours it reached. The database's row should read 24 of 24 hours. "No
   tick in the last hour" means the clock stopped.

**Rotate the secret** (both sides read Vault, so the next tick uses it):
```sql
select vault.update_secret((select id from vault.secrets where name = 'push_tick_secret'),
                           encode(extensions.gen_random_bytes(32), 'hex'));
```

## Without the database's clock

cron-job.org (free, about two minutes): set `PUSH_TICK_SECRET` in Vercel
(`openssl rand -hex 32`; under 32 characters it is ignored and logged), then
a job every hour at minute 1, GET `https://speakethos.com/api/push/cron`,
header `Authorization: Bearer <PUSH_TICK_SECRET>`. `/active` shows it as
"cron-job.org".

## Stop or roll back

```sql
select cron.unschedule('push-tick');
```
The GitHub schedules keep running; the claim makes them harmless together.

## What to watch (aggregates only)

```sql
-- Phones holding a reminder, and how many were sent one today (Melbourne).
select count(*) as phones,
       count(*) filter (where last_sent_on = (now() at time zone 'Australia/Melbourne')::date) as sent_today
  from public.push_subscriptions;
```
A tester's phone files each reminder outcome as a tap with the role
`reminder` in `public.tester_events` ("Reminder: saved for 18:00",
"Reminder: failed, server 502", "Reminder: denied", "Reminder: not now",
"Reminder: Home Screen steps shown"), so the next "picked an hour, no row"
explains itself.
