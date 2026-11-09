# Reminders that reach people: what production needs (DECISIONS #430)

Branch `comeback/reminders`. Everything below the line "Timothy" is a
production step: nobody else runs it, and nothing in the branch runs it for
you.

**The hourly clock is the ship gate, not a follow-up (#430 review).** The
code alone does not deliver the evening reminders: replayed on GitHub's real
ticks, 30 Oct to 8 Nov in Melbourne, the 8 pm reminder went out on 4 of 10
days and the 9 pm one (the hour both introduction pickers chose) on 2,
because a 9 pm pick can only be served by a tick between 21:00 and 21:59 and
quiet hours begin at 22. GitHub's three new schedules have never been
measured. So the branch ships with a clock at minute 1 of every hour, either
the database's (steps 2 to 7) or cron-job.org's (the two-minute route under
"If you would rather not touch the database"), and `/active`'s "Reminder
clock" saying "N of 24 hours" the next day.

## Why

- GitHub ran the hourly reminder tick (`17 * * * *`) 60 times from 25 Oct to
  9 Nov: about 4 a day, gaps up to 10 h 40 m. Every run answered 200; the
  scheduler was the fault. 28 of 60 chosen hour-days in Melbourne had a tick
  in their window; on Sunday 8 Nov the 6 pm subscribers got nothing.
- With a tick at minute 1 of every hour, every chosen hour is served at
  HH:01 (lib/push-ticks.test.ts replays it).

## What ships in the branch (code only)

- The sender (`app/api/push/cron`) accepts `PUSH_TICK_SECRET` beside
  `CRON_SECRET`, claims each person's day before it sends (two callers in the
  same minute ring once), serves a late tick until quiet hours begin (not
  naming an hour that has passed), and answers why: `{ ok, subs, due, done,
  unsure, taken, sent, failed, dropped }`.
- `.github/workflows/push-cron.yml`: the backup, three schedules an hour
  (:07, :29, :48) and a concurrency group. Uses the existing `CRON_SECRET`.
- `supabase/migrations/0027_push_tick.sql`: pg_cron + pg_net, minute 1 of
  every hour, URL and secret read from Vault. **Written, not applied.** It
  holds no URL and no secret, and without the two Vault entries it calls
  nobody, so a branch or local database never rings production.
- `POST /api/push/test` behind Settings' "Send a test".

## Timothy, in this order

1. **Deploy the branch** to production (merge as usual). Migration 0026 is
   still owed before this ships (STATE.md, the games); apply it first.

2. **Make the secret** on your laptop:
   ```
   openssl rand -hex 32
   ```
   Keep it for steps 3 and 5. It is never pasted anywhere else.

3. **Vercel**: Project, Settings, Environment Variables, add, Production
   only:
   - `PUSH_TICK_SECRET` = the value. The sender ignores any secret under 32
     characters (it logs "PUSH_TICK_SECRET is ignored"), so a short one
     fails closed.
   - `ADMIN_EMAILS` = your account's email (confirmed), for `/active`.
     Unset, the page answers you as if it did not exist.
   - Check `CRON_SECRET` is 32 characters or more. A shorter one is now
     ignored too: GitHub's push-cron run fails with 401. Make a new one with
     `openssl rand -hex 32` and set it here and in GitHub (Settings,
     Secrets and variables, Actions, `CRON_SECRET`).

   Redeploy (Deployments, the latest, Redeploy), so the route reads them.

4. **Supabase, extensions**: Dashboard, Integrations, Cron, Enable (that is
   pg_cron); Database, Extensions, search `pg_net`, Enable. (The migration
   also runs `create extension if not exists` for both; enabling them in the
   dashboard first means it cannot fail on permissions.)

5. **Supabase, Vault** (SQL editor, one run):
   ```sql
   select vault.create_secret('https://speakethos.com/api/push/cron', 'push_tick_url', 'The reminder sender');
   select vault.create_secret('PASTE-THE-SECRET-FROM-STEP-2', 'push_tick_secret', 'Bearer for /api/push/cron');
   ```

6. **Apply the migration**: paste `supabase/migrations/0027_push_tick.sql`
   into the SQL editor and run it (or `supabase db push` if that is how 0026
   went in). It schedules the job `push-tick` at `1 * * * *` (UTC, so HH:01
   in every whole-hour zone).

7. **Check, after the next HH:01** (SQL editor):
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
   A `401` means the Vault secret and Vercel's differ (step 3 or 5); a `403`
   means Vercel's bot protection is on for the route.

8. **Your iPhone** (the whole path, about a minute):
   - Open speakethos.com in Safari, Share, Add to Home Screen, open it from
     the Home Screen.
   - Record a take. On the results, "Same time tomorrow?" with "Remind me at
     <hour>". Tap it, then Allow. It says "Tomorrow, <hour>." only once the
     server has the subscription.
   - Settings, Reminders: "Send a test". It should arrive in seconds with the
     app closed. If it does not: iPhone Settings, Notifications, Ethos.

9. **The next day**, open `speakethos.com/active` signed in: "Reminder
   clock" lists each caller with its last tick and how many of the last 24
   hours it reached. The database's row should read 24 of 24 hours. "No
   tick in the last hour" means the clock stopped.

## If you would rather not touch the database

cron-job.org (free, about two minutes): a job every hour at minute 1, GET
`https://speakethos.com/api/push/cron`, header
`Authorization: Bearer <PUSH_TICK_SECRET>` (step 3 first; `CRON_SECRET`
works too if it is 32 characters or more). `/active` shows it as
"cron-job.org". Or store the secret as `push_tick_secret` in step 5 and skip
the rest of step 3.

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
