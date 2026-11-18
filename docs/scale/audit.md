# Ethos as it grows: the capacity audit (18 Nov 2026)

## On one screen

Today Ethos has 52 accounts and about 25 recordings a week. Nothing is under strain. The first things to give way are a few limits set by hand, and those break long before the servers do: the guest ceiling, the sign-up email limit, the AI providers' spend caps, and the Vercel plan. The database had two real problems that grew with every recording anyone made. Both are fixed on this branch.

| Daily users | What breaks first, and when | Monthly cost after a year: storage / models / hosting | What we do |
|---|---|---|---|
| **1k** | A launch hour with 20 to 25 new guests fills the guest ceiling (M3). About 30 email sign-ups in an hour hit Supabase's email limit (OPS-2). Anthropic's Start tier caps spend at $500 a month, about 290 daily users (M2). If the team is on Vercel Hobby, the app is paused at about 350 to 450 daily users, and taking money breaks Hobby's terms (M4). Without this branch, the lexicon scan would reach 1 s per open at about 150k recordings, which is about 100 days at this size (DB-1). | **~$25 / ~$2.2k / ~$30** | Timothy: Vercel Pro, provider limits and tier, a guest budget, a transactional email sender. The scan is fixed here. |
| **10k** | Without this branch: the lexicon scan within about 10 days (15k recordings a day). Delete my recordings for a year-long account passes 8 s within about a week (DB-3). Reminders stop going out on time at about 1,000 subscriptions in the busiest hour (DB-4). Still open: from about 3 to 5k daily users the database's 1 GB of RAM no longer holds the recent rows (DB-15). | **~$100 / ~$22k / ~$130** | Fixed here: the scan, the cascades, and the sender (now about 15k subscriptions). Timothy: a compute upgrade once the cache hit ratio drops below 99%. |
| **100k** | Model spend, about $222k a month (M5). Provider rate tiers: Opus 5 allows 1,000 requests a minute on the Start tier (M10). About 10 TB of audio a year (DB-16). | **~$1.2k / ~$222k / ~$1.3k** | Timothy: the Premium read cap, the coach model and the price, a retention rule, and the next provider tiers. |
| **Any size** | **whisper-1 shuts down on 26 Feb 2027, 100 days from now (M1).** On that day every take fails to score. | | Timothy: pick the replacement. This branch makes sure takes are held on the phone, not thrown away, if the model is refused. |

How the costs were worked out: 1.5 takes per daily user per day, about 0.2 MB of audio and 7 KB of database per take, and $0.074 of model calls per daily user per day (Anthropic $0.058, OpenAI $0.016). The model figure is ±50% until the new token fields on the stage line give real numbers. Storage is Supabase Pro ($25) plus compute and overage at month 12. Hosting is Vercel Pro ($20) plus usage. At every size, models are about 95 to 99% of the bill.

**Built on this branch**, each with a test that fails on the old code:
1. **Migration 0038** (`2d5a810`). The 15 policies the advisor flagged now call `auth.uid()` once per statement instead of once per row, with the same meaning, proven on Postgres. It adds five indexes and an hourly pg_cron sweep. In tests, the lexicon read fell from 162 to 170 ms to 0.6 to 4 ms, and Delete my recordings for a 365-recording account from 2,227 ms to 37 ms.
2. **Every browser read names its account** (`265b49a`). Before 0038 lands, this alone brings the lexicon read down to 3 to 6 ms.
3. **Whisper has a deadline and one retry, and a 400 about the model counts as our fault** (`b05d3f3`).
4. **Every model call finishes inside its route's own time** (`de40701`). This covers Hostile, the boss fact-check, word lookups and Say it better.
5. **The reminder sender sends 16 at a time** (`716ef00`).
6. **The stage line records the coach's tokens and errors, and the guest ceiling logs when it fills** (`d772446`).

**Timothy's calls** are at the end of this page, each with its trade-off in two lines.

---

## How this was measured

- **Database.** Every migration was loaded into PGlite (Postgres 17 compiled to WebAssembly) with Supabase's roles and its real `auth.uid()`, the version that parses the request's JWT claims on every call. The seed was 3,000 to 10,000 accounts and 31k to 104k recordings, plus heavy accounts with 365 and 1,000 recordings. The queries ran as `authenticated` and are the ones the app sends. `node scripts/explain-scale.mjs` reproduces the before and after; the output is in `docs/scale/explain.txt`. PGlite's milliseconds apply only to PGlite: native Postgres is faster per row, so trust the plan shapes and how the cost grows more than the absolute numbers.
- **Server.** A production build was served against stubs (Whisper 6 s, Claude 12 s, Supabase 20 ms) and hit with 10 and 50 takes at once. Every take returned in 18.2 to 18.9 s, against 18.2 s for a single take. Each take used 24 to 85 ms of CPU, and memory peaked at 422 MB. The route queues nothing. The limits are model time and provider caps.
- **Production facts.** These are read-only aggregates gathered on 18 Nov. Nothing in production was queried or changed for this audit. One correction to those facts: pg_cron calls `push_tick` hourly (`1 * * * *`), not every minute. 221 calls is about 9.2 days × 24.

---

## The findings

Each finding is marked **Built here**, **Timothy**, **Later** or **Fine**. Where a reviewer corrected a breaking point, the corrected one is given.

### Database

**DB-1 · Every open scanned the whole lexicon table · Built here.**
*Evidence:* Say it better's pair read (`lib/say-store.ts readPairs`) sent no account filter, the `lexicon` table had no index on `user_id`, and the policy called `auth.uid()` bare. The read is made idle after every Today open, on every recorder open, on You and on Say it better. Production's statistics show 333 sequential scans of `lexicon` against 1 index scan. On PGlite with 73k pairs the read cost 681 to 787 ms, the same for an account with 7 pairs as for one with 2,000, because every row parsed the JWT again.
*Breaks at:* about 9.6 µs per pair in the whole table, and there are about 0.67 pairs per recording. That means 1 s per open at about 150k recordings in total. Once peak traffic reaches a couple of these reads a second, the two shared cores on Micro are busy with them alone. The 8 s statement timeout comes at about 1.2M recordings.
*Fix:* 0038 wraps the policy and adds `lexicon (user_id, created_at desc)`, and every browser read now names the account. The explain output shows 162 to 170 ms falling to 0.6 to 4 ms.

**DB-2 · The other 14 flagged policies · Built here.**
*Evidence:* `reps`, `xp_events`, `coin_ledger`, `profiles`, `streaks`, `streak_freezes`, `onboarding` and `billing` call `auth.uid()` bare. The capped reads (Today's 90 recordings, Lessons' 200) already used the index. The whole-account reads (the spine, the XP) ran the policy on every row: 23 ms for a 1,000-recording account on PGlite, rising with the account.
*Breaks at:* nothing breaks. It is a per-row cost that grows with each account.
*Fix:* all 15 policies are wrapped, with every browser read naming the account so the planner keeps its index. The explain output shows the spine at 1,000 recordings falling from 23.1 to 8.9 ms and the XP from 13.1 to 4.1 ms. The reviewer's warning holds: wrapping alone makes Today's 90-row read touch about 17 times more pages for a heavy account, which is why the reads name the account in the same change.

**DB-3 · Deleting recordings scanned three tables once per recording · Built here.**
*Evidence:* `lexicon.rep_id`, `xp_events.rep_id` and `coin_ledger.rep_id` are set to null when their recording goes, and none of them had an index. Delete my recordings and account deletion therefore ran three full scans per recording. With 102k recordings on PGlite, deleting 365 recordings took 8.7 s and deleting 1,000 took 24.8 s. Both routes remove the audio before the rows, so a timeout left rows with no audio, and every retry timed out again.
*Breaks at:* the cost is the account's recordings × about 2.2 × all recordings, so it grows with the square of the data. A year-long account passes 8 s at about 100k recordings in total. If the service role does not inherit the 8 s timeout, the limit is the route's 60 s instead, about 7 times later.
*Fix:* 0038 adds the three `rep_id` indexes. The explain output shows 2,227 ms falling to 37 ms.

**DB-4 · Reminders were sent one at a time · Built here.**
*Evidence:* `app/api/push/cron` handled each due subscription with 4 database round trips and a push, in sequence, inside a 60 s function. pg_net gives up on the call after 30 s.
*Breaks at:* about 250 ms per reminder gives about 240 per tick. With a quarter of subscribers in the busiest hour, that breaks at about 1,000 subscriptions, an estimate good to about 2x. The first sign would be a 30 s timeout in `net._http_response`.
*Fix:* 16 lanes (`lib/lanes.ts`). Each row's day is still claimed by one atomic update before sending, so no lane and no tick can ring a person twice. This raises the limit about 16 times, to roughly 15k subscriptions. **Later:** one done-today query per tick instead of one per row.

**DB-5 · The database clock · Fine.** `push_tick` reads two Vault secrets and queues one HTTP call an hour, about 3.5 ms each. It never reads `push_subscriptions`.

**DB-6 · pg_cron's history grew without end · Built here.** It gained 24 rows a day and nothing removed them. Harmless at this rate, but now trimmed: `private.sweep_kept_rows()` removes run history older than 7 days, hourly at minute 31.

**DB-7 · The limiter table was only swept when reminders were on · Built here.** The 48-hour sweep lived inside the reminder sender, after its push-key check, so with reminders off, one-off addresses and guests stayed in `rate_limits` for good. It was a sequential scan, 26 ms at 200k rows. It now has its own pg_cron job and an index on `at`.

**DB-8 · Tester data is capped but never cleared · Timothy.** 5,234 rows (1.7 MB) today. At most about 107 MB (22 testers × 15k rows), so it is not a space problem. The test ended on 15 Nov. Clearing it is a privacy call. The privacy page also promises deletion 12 months after the test ends (around Nov 2027, see STOR-1).

**DB-9 · XP and the coin ledger are read whole · Later.** About 30 bytes a row. An account passes one 1,000-row page after about 2.7 years of daily practice. *Fix later:* a server-side total, or a running total on `profiles`.

**DB-10 · The spine is read whole on every open · Later.** About 110 bytes per recording, so 1,000 recordings is 110 KB in one trip, and 3,000 is three trips and about 0.6 s more on mobile data, roughly 3 years of daily practice. *Fix later:* read only rows newer than the held copy, with a full read once a day. Medium risk, because the streak depends on it.

**DB-11 · Capped reads still carry whole rows · Later.** Today reads 90 rows of about 2.3 KB each. The reviewer's correction: the "300 GB a month at 10k daily users" figure assumes every user already has 90 or more recordings, and it ignores gzip. The real figure is likely well under Pro's 250 GB. The fix is the speed audit's fix 10, which the #511 branch has begun (Today's select trimmed).

**DB-12 · Connections · Fine.** Nothing opens a direct Postgres connection. Everything goes through PostgREST, GoTrue and Storage over HTTP. At 10k daily users the peak is about 37 queries a second, against a Micro capacity of roughly 1,000 to 2,000 simple indexed queries a second.

**DB-13 · Auth is capped at 10 database connections, a fixed number · Timothy (later).** That is plenty: about 3k to 10k calls a second of capacity against about 10 to 20 at peak. The fixed 10 only matters after a compute upgrade, so switch it to a percentage then. In code, later: verify the JWT locally (`getClaims`) instead of calling GoTrue on every API request.

**DB-14 · Guest accounts are never removed · Timothy.** Each one-time guest leaves about 7 KB of rows and 200 KB of audio. Production has 52 auth users against 43 profiles. The fix needs a rule first (for example, guests idle for 30 days). Then a job removes their audio and the user, safe since DB-3.

**DB-15 · Micro's 1 GB of RAM fills before its disk · Timothy.** Each recording is about 6.8 KB, mostly Whisper's raw JSON. Disk: 8 GB holds about 1.2M recordings. RAM: about 5k daily users × 90 rows × 2.3 KB is about 1 GB, so from about 3 to 5k daily users Today's reads start going to disk. *How we know:* the cache hit ratio in the dashboard. Upgrade compute when it drops below 99%.

**DB-16 · Every recording's audio is kept forever · Timothy.** At 10k daily users that is about 2.6 GB a day. Pro's 100 GB lasts about 5 weeks, and after a year the store is about 950 GB, roughly $18 a month. It is a cost, not a break, and the retention rule is a product call.

**DB-17 · The code says Vercel Hobby · Timothy.** The same finding as M4 and OPS-1.

**DB-18 · Each take makes 12 to 14 small indexed calls · Fine.** At 10k daily users that is about 0.83 takes a second at peak, about 12 queries a second. Whisper and Claude are the limits, not the database.

**DB-19 · Point reads (a stored recording, profile, billing, onboarding, streaks) · Fine.** Single-row reads by key, 0.4 to 0.8 ms, the same before and after.

**DB-20 · The Log's Games side walks the account's index · Fine** up to about 10k recordings per account.

**DB-21 · Advisor odds and ends · Fine.** The slow `pg_timezone_names` query is PostgREST's schema reload or the dashboard, not app code. The "unused" `say_better` index sits on a table that is new and empty.

### Server and models

**M1 · whisper-1 shuts down on 26 Feb 2027 · Built here (takes are held) + Timothy (replacement).**
*Evidence:* every take, Hostile answer and Say it better line goes to `whisper-1` with word timestamps and the filler prompt. OpenAI's deprecations page names the date. Its suggested replacements (`gpt-transcribe`, `gpt-live-transcribe`) do not return word timestamps.
*Breaks at:* any number of users, on that date. The reviewer found the worse branch: if the retired model answers 400, the route read that as the file being unreadable. It answered 422, the phone's outbox let the take go, and the server removed its audio, so every take that day would have been lost.
*Fix built:* `lib/whisper-fault.ts` treats a 400 that names the model (`"param": "model"`, `model_not_found`, deprecated) as our fault. It answers 502, and the phone keeps the take and retries.
*Timothy:* pick a speech-to-text service that returns word times and keeps the ums, put it behind `transcribe()`, and switch only after the filler-count parity run in `docs/speed/whisper-parity.md`.

**M2 · The providers' monthly caps are the only spend ceiling · Built here (it shows) + Timothy.**
*Evidence:* the only global ceiling is the guest one. Anthropic's Start tier caps spend at $500 a month, about 290 daily users at $1.74 each a month. A coach failure disappeared into `Promise.allSettled` without a log line.
*Breaks at:* about 290 sustained daily users on Anthropic Start (about 575 on Build). After that, takes still score but get no read until the 1st of the month. The reviewer's correction: OpenAI tiers rise with credit purchases, so the real OpenAI risk is a prepaid balance hitting zero with auto-reload off, and that stops every take.
*Fix built:* a failed coach call now writes its status and error type to an error log and to the take's stage line (`coach_error`).
*Timothy:* in both consoles, check the tier, turn auto-reload on, set alerts at 50% and 80%, and ask for the next Anthropic tier before launch.
*Later:* a global daily ceiling on judged reads, once Timothy picks the budget.

**M3 · The guest ceiling fills on a launch day · Built here (it shows) + Timothy.**
*Evidence:* everyone starts as a guest. All guests together share `guestall` at 60 an hour and 300 a day.
*Breaks at* (reviewer's figures): about 20 to 25 new guests in one hour, or about 100 to 120 in a day. After that, the next new person's first take is refused with "Recording without an account is full for now." A handful of addresses can fill it on purpose.
*Fix built:* every refusal at the ceiling writes `{"evt":"limit.guestall","route":…,"window":…}`.
*Timothy:* size the ceiling, the hourly limit first, from a daily guest budget. Each guest take costs about $0.05.

**M4 · Vercel Hobby · Timothy.** The code comments say Hobby, and the team's name looks like a default Hobby team. Hostile's 120 s limit deploys, so Fluid compute is on, but that does not tell Hobby from Pro.
*Breaks at:* the first payment, under the terms. The memory allowance runs out at about 350 to 450 daily users, and then every deployment is paused until support or a move to Pro. Logs are kept for 1 hour.
*Do:* confirm the plan under Settings → Billing, and move to Pro before checkout opens or before about 300 daily users, whichever comes first. On Pro a take costs about $0.0002 of Vercel. The stale "Hobby cap" comment on analyze is fixed here.

**M5 · Each daily user costs about $0.074 a day · Built here (measured from now) + Timothy.**
*Evidence:* the coach (Opus 5, about 4k tokens in and 0.6k to 1.5k out) costs about $0.035 when the cache is warm and $0.05 when cold. A Hostile round is about $0.05, the boss check about $0.03, a word lookup about $0.0003, and Whisper $0.006 a minute.
*Breaks at:* unit economics, not a user count. At the A$6.99 floor a Premium user nets about US$3.9 a month. A Premium user inside the five-minute loop costs about $1.5 to $3.3 a month, a heavy one about $6, and one at the caps about $58.
*Fix built:* the stage line now adds up the coach's billed input, cache-read, cache-write and output tokens over every attempt. A week of these lines turns the ±50% estimate into a measured cost per take.
*Timothy:* a daily cap on Premium judged reads, a cheaper coach model after an Index parity run, or the price.

**M6 · Parallel takes can each get a judged read · Later (not built).** The meter is read and then written without a lock, so a script sending 10 takes at once gets 10 reads for one unit of balance. That is about 10 judged reads a day sustained instead of 1, about $0.45 a day of extra spend per scripted account. Normal clients never trigger it, because the outbox sends one at a time. *Why not here:* the fix is a compare-and-swap claim before the coach, with the read given back when the coach fails. It changes when the free read is spent, and it deserves its own change with the meter's tests. It is next in line, and needs no call from Timothy.

**M7 · Whisper, the boss check and Hostile had no timeouts · Built here.**
*Evidence:* a slow provider ran into the platform's kill. The slot stayed taken, the audio was left in the bucket with no row, and the phone sent the take again with a new Whisper charge. A stalled Hostile question held the person at the mic until a 504.
*Fix built:* Whisper must answer within 50 s of the request on analyze (55 s at the latest when a slow upload left it under 5 s; the minute counts the upload), 60 s on Hostile and 20 s on Say it better. Past that it is cut off and treated as Whisper being down: 502, the slot is given back, and the audio is removed. The boss check runs under the coach's 45 s deadline. Each Hostile phase gets a deadline the coach's way: a question within 25 s, which otherwise falls back to a written one, and every model call by 100 s of the route's 120. A slow verdict now answers 502 instead of 504.

**M8 · All guests share one advisory lock · Timothy (the firewall rule already owed).** The reviewer's correction: this only matters at hundreds of requests a second, and Vercel and the database give out first at that rate. Filling the guest ceiling from 2 to 4 addresses is far cheaper. *Do:* add the Vercel Firewall rule already listed in STATE (120 requests per 60 s per IP on `/api/*` except the Stripe webhook), plus Bot Protection.

**M9 · No way to see the cost of a take or a provider error · Built here (tokens, errors) + Later (keeping the line).** Logs last 1 hour on Hobby and 1 day on Pro. *Later:* write the stage line to a small table with nothing personal in it (see OPS-3), and add a daily sum to `/active`.

**M10 · A burst of takes · Built here (one retry).** A burst never queues on the server, and the phone's retry ladder spreads it out. Whisper starts refusing above about 2,500 requests a minute on the Build tier. *Fix built:* one server retry with 0.4 to 1 s of jitter on a 429, a 5xx or a dropped connection, when at least 15 s of the deadline is left.

**M11 · Request bodies · Fine.** A 90 s take is 0.36 MB at 32 kbps and 1.44 MB at 128 kbps, both under Vercel's 4.5 MB limit.

**M12 · Route durations · Built here.** Say it better and word lookups had no `maxDuration` of their own, so a hung call held an instance for Fluid's default of 300 s. They now have 30 s, and the word lookup is cut off at 20 s.

**M13 · Region and cold starts · Fine.** The functions run in icn1, beside the database in Seoul.

**M14 · The limiter table grows by about 10 rows per daily user per day · Built here.** At 100k daily users that is 1 to 2M live rows, and the hourly sweep was a sequential scan. Now it uses an index on `at` and has its own job.

**M15 · Per-address guest limits catch shared Wi-Fi · Later.** A class of 20 to 30 people on one network hits the address limit at about the same point as the ceiling. The refusal reads "That's a lot of practice in one hour", which is not what happened. *Later:* show the create-an-account line there too (a copy change), and check Supabase's anonymous sign-in rate before any event-style launch.

**M16 · Audio grows in a straight line · Built here (no orphans on timeouts) + Timothy (retention).** About 8 GB a month at 1k daily users and 80 GB at 10k.

**M17 · Prompt caching · Fine.** The coach and word prompts are cached. The cache stays warm once judged takes come in more often than every 5 minutes.

### Storage and operations

**OPS-1 · Hobby plan · Timothy.** Same as M4. The reviewer adds that even on Pro, logs last only 1 day, so a week of stage lines needs a table whatever the plan.

**OPS-2 · About 30 email sign-ups an hour · Timothy.** Confirm email is on and SMTP is the live mailbox. Supabase's default email limit with custom SMTP is about 30 an hour per project. After that, every new email sign-up sees "Too many tries in a row. Give it a minute." for up to an hour and cannot reach a recording. Google sign-in is not affected. *Do:* raise the limit (for example to 500 an hour) and send through a transactional sender (Resend, Postmark or SES) with SPF and DKIM. *Later, in code:* give the email-limit error its own line pointing to Google.

**OPS-3 · Nothing watches errors, failed takes or spend · Timothy + Later.**
*Timothy, 15 minutes:* hard limits and alerts in OpenAI, Anthropic, Supabase and Vercel, and a free uptime check on `/`.
*Later, half a day:* a `take_log` row per take with the coach's outcome (ran, metered, unscorable, failed, timed out). The reviewer's correction: "focus is null" in `reps` is mostly the free meter working, not an outage, so it cannot be used as the signal.

**FAIL-1 · Whisper with no timeout orphaned audio · Built here** (see M7). The reviewer's correction: recorder takes are capped at 90 s, so only an OpenAI slowdown triggers it, never take length. The deadline is measured from the start of the request, leaving 10 s to clean up. *Later:* a weekly sweep for orphaned audio (`storage.objects` with no `reps.audio_path`). Production shows 250 objects against 250 rows, so there are none yet.

**FAIL-2 · Outages degrade honestly · Fine.** A Supabase outage never moves a held take towards being dropped. *Later:* `/api/audio`, `/api/recordings` and `/api/account` say "That session has expired" when Auth is down. They should answer 503 instead.

**STOR-1 · Audio and tester data have no end date · Timothy.** The privacy page says data is kept until you delete it, so keeping an abandoned account's voice is disclosed. The one promise with nothing behind it is deleting tester data 12 months after the test, due around Nov 2027.

**STOR-2 · Nobody has confirmed iPhones record at 32 kbps · Later (a measurement).** If they don't, iPhone takes are about 5.5 times larger in storage and playback, and upload about 5 to 8 s slower. No take is ever refused, since 90 s at 128 kbps is 1.44 MB. *How we know:* bytes per second of the first iPhone takes since 18 Nov. About 2,900 B/s means 32 kbps is honoured.

**EGR-1 · Playback egress · Fine.** One signed link per open. Pro's 250 GB covers about 1.4M full plays a month.

**EGR-2 · Whole-row reads · Later.** This only bites at several thousand daily users who each have 90 or more recordings, and gzip helps. The #511 branch trims Today's select.

**STAT-1 · Six pages render per request · Later.** Not a capacity issue. Convert `/say` to `useSearchParams` inside Suspense, and add `generateStaticParams` for lessons, traits and units.

**STAT-2 · `public/` files revalidate on every fetch · Later.** These are 304s, not re-downloads, and they cost edge requests. That only matters against Hobby's 1M a month. *Later:* a one-day `max-age` for icons, idle clips and lesson art. The pose model's path must be versioned before it gets a long `max-age`.

**STAT-3 · The service worker · Fine.**

**ABUSE-1 · Nothing caps Whisper minutes · Timothy + Later.** A 4 MB file at 6 kbps is about 90 minutes of audio, about $0.53 a call. Across the guest ceiling that is about $160 a day. The reviewer's correction: a size cap does not bound this, because a script can choose its bitrate. *Fix:* meter Whisper minutes on the server per guest and for all guests together, against budgets Timothy picks, plus the firewall rule and the hard monthly limits.

**BKP-1 · Backups cover the database only · Timothy + Later.** There is no copy of the audio and no restore runbook, and migrations are applied by hand. *Timothy:* decide whether recordings need a copy (about $2 a month per 100 GB of object storage) and when point-in-time recovery is worth its cost. *Later:* a runbook, a `deleted_accounts` log so a restore can replay deletions, and a manual backup before each hand-applied migration.

**PLAN-1 · Supabase's spend cap · Timothy.** With the cap on (the default), usage past a quota is restricted. With it off, it is billed. *Do:* turn it off once alerts exist (OPS-3). Disk is billed either way.

---

## Timothy's calls

Each one is a cost, a plan, a retention rule for people's recordings, or a product behaviour, so none is built here.

1. **Vercel Pro, before checkout opens or before about 300 daily users.** It costs $20 a month per seat. Staying on Hobby risks the app being paused, with 1 hour of logs and a breach of the terms at the first payment.
2. **Provider limits (OpenAI and Anthropic): tier, auto-reload, alerts at 50% and 80%, and the next Anthropic tier before launch.** Hard limits stop a runaway bill. When one is hit, takes lose their read (Anthropic) or stop scoring (OpenAI) until the 1st, so set it with headroom.
3. **The replacement for whisper-1 (shuts down 26 Feb 2027).** It must return word times and keep the ums. The filler count is the core number, so switch only after the parity run on stored takes.
4. **A guest budget that sets the size of `guestall`, the hourly limit first.** Raising it lets launch days through. It is the only bound on what scripted guests can spend, at about $0.05 a take.
5. **Premium: a daily cap on judged reads, the coach model, or the price.** A capped user costs about $58 a month against about US$3.9 net. A cap or a cheaper model changes what Premium means, and a model change moves the Index, so it needs a parity run.
6. **Retention: guests idle N days, audio older than N months, and tester data (export, then clear `tester_events`; the 12-month promise).** This saves cost and keeps a privacy promise. The trade-off is that old takes stop playing back.
7. **Supabase settings: compute up a size when the cache hit ratio drops below 99% (about 3 to 5k daily users), Auth connections as a percentage at that point, the email limit raised with a transactional sender, and the spend cap off once alerts exist.** Each costs a little money, against a sign-up wall, slow reads or a restricted project.
8. **The Vercel Firewall rule and Bot Protection (already in STATE).** About 10 minutes. It closes the cheapest abuse paths, and the reminder clocks and Stripe must not be caught by it.
9. **Backups: a copy of the audio, and point-in-time recovery when revenue justifies it.** About $2 a month per 100 GB for the copy. Without one, a recording removed by mistake is gone for good.
10. **Apply 0038 through the connector, after the deploy that carries this branch.** It is safe to run twice, and none of the connector's two blocked words appear in it. Until it is applied, the reads already name their account, which carries most of the gain. The order matters a little: the wrapped policies without the named reads make Today's 90-row read touch about 17 times more pages for a heavy account (DB-2), so the code goes first. At today's sizes either order is harmless. It lands the same with #511's 0037 before or after it (checked on PGlite: the same policies, indexes, columns, grants and functions either way).

## What to watch

- **`analyze.stages`:** `whisper_ms` p99 against the 50 s deadline, `coach_error`, and the four token fields (cost per take = tokens × prices).
- **`limit.guestall` lines:** the day the guest ceiling first fills.
- **The reminder sender's report:** `due` against `sent`, and `net._http_response` for a 30 s timeout.
- **Supabase:** the cache hit ratio (upgrade below 99%), and sequential against index scans on `lexicon`, which should flip once 0038 is applied.
- **Provider consoles:** daily cost by model divided by takes per day, until the stage-line table exists.
