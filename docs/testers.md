# Testers

About twenty friends speak for five minutes a day from Friday 30 October to Thursday 12 November 2026, and are paid A$35 each when they finish. Around each recording they answer two questions: how it felt, before the score shows, and whether the score felt right, after it. Their answers, stored beside the numbers they were shown, are how the thresholds (stars, the pause detector, presence) get tuned. While they test, their phones also send what the consent names: the device, how the app is used, and what breaks. This page is how to run it.

## What a tester gets

Tester mode switches on three things and nothing else:

1. **The consent** (version 3, `content/tester.ts`): everything kept, what for, who sees it, how long, deleting it, and a parent or guardian for anyone under 18.
2. **The two questions.** When a recording's results land, before any number shows: "How did that feel?" Rough, Okay or Strong, under the take's own wave and length, one tap that goes straight on to the score, or Skip. Then, on the results' last step after the score and the numbers, the question names the number it is about: "Did 665 feel right?" Too low, About right or Too high, changeable, with an optional "What felt off?" after Too low or Too high. The second question is asked again at the foot of the recording's page in the Log, where an answer already given reopens as it was left. Both are plain grey controls; the screen's one terracotta tap stays its own.
3. **Collection** (`lib/tester-collect.ts`), only on consent version 3: a device snapshot each time the app opens, the screens opened and the time on each, taps by the button's or link's name, the app shown and hidden, recordings started and stopped, and errors with what was on screen (a crash on the first screen of an open included: it is held in memory until collection starts).

It grants no Premium: 1234 is the first code anyone guesses, and Premium is what Ethos sells. To put a tester on Premium as well, send them the invite code too (`PREMIUM_UNLOCK_CODE`, entered from the paywall).

## How a friend becomes a tester

1. They open the link on their phone and add Ethos to the home screen (Safari: Share, Add to Home Screen).
2. They open Ethos **from the home-screen icon**, and do everything from there on. On an iPhone the icon keeps its own storage, apart from Safari's, so a code entered in Safari stays in Safari and the icon starts as someone new.
3. On the introduction's first screen they tap **Tester code** (small, top right).
4. They type the four digits (1234 unless `TESTER_CODE` is set) and tap Continue.
5. They read the consent and tap **I agree**, which sits after the last line. Not now leaves with nothing stored.
6. The next screen shows **Your tester number** (two groups of four, for example `3F9A 1C2E`) with Copy. They send it to you. It is how you find their rows in the report, pay them, check the parent's text, and delete their data when they ask.
7. They tap **Back to the introduction** and carry on as anyone would.

Already past the introduction, or already have an account? Settings, About, **Tester code** does the same. Afterwards that row reads **Testing Ethos, On** and opens the date they joined, their tester number and what they agreed to. A friend who joins on the introduction and then signs in to an account they already had keeps testing: signing in (password or Google) hands the consent to that account with the day they first joined, and their answers, notes, device and usage rows go with it. The recordings they made before signing in stay under the anonymous session, as every sign-in leaves them; the account remembers that session (`carried_from`), so the report counts those recordings as theirs and every deletion below reaches them.

The code is checked on the server only (`app/api/tester`), compared in constant time, and rate limited per address and per account (10 an hour, 30 a day). Only wrong codes count against it: a right code gives its slot back, so a room of friends on one Wi-Fi can all join at once. To stop new testers joining, set `TESTER_CODE` in Vercel to anything else and redeploy; existing testers stay testers. Since the door is on every new visitor's first screen and 1234 is the first guess, a fresh four digits sent only in your DM keeps strangers out of the report: set it before the DM goes out, and put it in step 3.

At most 60 testers join (`TESTER_LIMIT` in Vercel changes it). Past that a right code reads "Testing is full. Message Timothy." and nothing is stored; a tester already on the list is never refused. A friend who joins in Safari and again from the home-screen icon takes two places, so the limit is three times the cohort.

### A friend who joined on an older consent

The server stores the version a tester agreed to and when. Version 2 (30 Oct) named the services every recording goes through; version 3 (30 Oct, later the same day) is the full list. A tester on 1 or 2 is asked once per phone, on their next open of Ethos: the new consent opens over the first tab or Settings they land on, with no code to type (their testers row is the proof), and goes back where they were whichever way they answer. Until they agree, their phone sends nothing, migration 0022 refuses their answers, and where the questions would be (the results' last step, a recording's page in the Log) they read **Testing is paused.** with **Agree again**. Settings' row reads **Testing Ethos, Agree again** too. Nothing they made before is lost.

One reflex tap on Back or Not now is all it takes to miss the ask, and every friend who joined before this build shipped is on version 2. So chase them. Who has not agreed to the full list:

```sql
select tester_number, name, consent_version, last_open
  from tester_admin.testers
 where consent_version < 3
 order by joined_at;
```

Message each one: "Open Ethos, Settings, About, Testing Ethos, read it and tap I agree."

## Where the data lives

Migrations `0020_testers.sql`, `0021_tester_limits.sql` and `0022_tester_data.sql`:

- `public.testers`: one row per tester (consent version, time, the day they joined, and `carried_from`: the anonymous sessions their testing came from when they signed in). The tester can read their own row; nobody can write one from the browser.
- `public.tester_feedback`: one row per recording, keyed by its outbox id: `felt` (rough, okay, strong, the tap before the score), `answer` (too_low, about_right, too_high; the 0020 answers yes, roughly and no stay readable in rows from before), the note, the scores on screen, the time. A tester reads and writes only their own rows, and only on consent version 3 or later (0022). An account keeps 300 rows at most (0021). `scores_shown` holds every number the answer was about; `seen` says where it was given (`results` or `log`).
- `public.tester_events`: everything collection sends, one row per event, `kind` device, usage or error. Only the server writes it (`app/api/tester/collect`, with the service role, after checking the session, the testers row and consent version 3); the browser has no grant to write there. A tester can read their own rows. An account keeps 15,000 at most and 20 errors per open of the app, and the table as a whole stops taking rows at 150 MB (`TESTER_EVENTS_MB` in Vercel changes it; `public.tester_events_bytes()` is its size, readable by the service role alone). Twenty friends over two weeks use well under 50 MB; the ceiling is there because the code is easy to guess. Past it, recording, scoring and the answers carry on; only collection stops keeping rows.
- `tester_admin`: the report. A schema the API never exposes, closed to everyone but the service role and the SQL editor.

Every one of those rows references the account, so deleting the account takes them all.

What collection never takes: what anyone types (a tap on a field is skipped, and a tap is kept by the control's name, never a value), the tester code (screens are paths, never their query), anything from outside Ethos (an error whose stack is all another site's, a browser extension's say, is skipped; a stack keeps Ethos's own lines only; files and messages keep their path, never a host, a query or a fragment), and anything at all from a phone whose account is not a tester on version 3. `scripts/check-tester-collect.mjs` asserts it in a browser and `lib/tester-events.test.ts` on every field.

Their recordings, transcripts and scores are the ordinary `reps` rows, readable only by their owner (migration 0001); transcripts keep Whisper's word timestamps (`whisper_raw`). The live camera's video never uploads: its five numbers do. A file picked on Upload goes as it is, video included, stored as `rep` and its extension, never under its own name. `scripts/check-testers-sql.mjs` runs every browser read and write against Postgres to prove it (`npm install` brings PGlite).

Their audio is in the private `audio` bucket. The server uploads it (no owner on the file, no user folder in its path), and the server signs every playback link (`app/api/audio`), only after checking the recording is the caller's. So the bucket needs no storage policy for the browser at all, and it should have none. Check once in the SQL editor:

```sql
select policyname, roles, cmd, qual
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects';
```

Any row that lets `anon`, `authenticated` or `public` read or list `bucket_id = 'audio'` lets any signed-in session (a free anonymous one included) list and play every recording, testers' included. Remove it in the dashboard (Storage, Policies). An empty result is right.

## Reading the report

Supabase dashboard, SQL editor. Every query here runs as pasted (`scripts/check-testers-sql.mjs` runs them all).

### The testers

Each tester, with their tester number, days spoken since joining (on Melbourne's calendar, or their reminders' zone), how they felt, which way the score was off, and how much they used the app:

```sql
select tester_number, name, email, anonymous, under_18, consent_version, joined_at,
       days_since_joining, days_spoken, recordings, average_index,
       felt_rough, felt_okay, felt_strong, too_low, about_right, too_high, notes,
       opens, minutes_in_app, errors, last_open, carried_from
  from tester_admin.testers
 order by joined_at;
```

`name` and `email` are empty for a friend who skipped the name question and never made an account (`anonymous` is true). The tester number is the one way to tell those rows apart. One friend, by the number they sent you (with or without the space):

```sql
select user_id, name, email, under_18, consent_version, days_spoken, recordings
  from tester_admin.testers
 where upper(left(user_id::text, 8)) = upper(replace('3F9A 1C2E', ' ', ''));
```

A `consent_version` under 3 is a friend who has not agreed to the full list yet: chase them (the query under "A friend who joined on an older consent"); until then nothing new is kept for them. `carried_from` lists the anonymous sessions a friend signed in from; their recordings are counted here as the friend's.

### The scores

Every recording since they joined, its numbers, how it felt and which way the score was off:

```sql
select tester_number, name, spoken_on, ethos_index, stars, wpm, filler_count, pauses,
       pause_score, fillers_score, pace_score, range_score, presence_score,
       felt, matched, note
  from tester_admin.recordings
 order by name, spoken_at;
```

Where the score felt wrong, with what they said (the last two values are the old question's):

```sql
select tester_number, name, spoken_on, ethos_index, stars, felt, matched, note,
       scores_shown, transcript
  from tester_admin.recordings
 where matched in ('too_low', 'too_high', 'no', 'roughly')
 order by spoken_at desc;
```

How the feeling lines up with the number, which is the point of the test. If Rough and Strong recordings get the same Index, the score is not measuring what a speaker feels:

```sql
select felt, count(*) as recordings, round(avg(ethos_index)) as average_index,
       round(avg(stars), 2) as average_stars,
       count(*) filter (where matched = 'too_low') as too_low,
       count(*) filter (where matched = 'about_right') as about_right,
       count(*) filter (where matched = 'too_high') as too_high
  from tester_admin.recordings
 where felt is not null
 group by felt
 order by felt;
```

Every answer, including any whose recording never stored (`rep_id` is null):

```sql
select tester_number, name, felt, answer, note, index_shown, stars_shown, answered_at, rep_id
  from tester_admin.answers
 order by answered_at desc;
```

### Devices

One row per phone a tester opened Ethos on (one browser at one screen size), with its latest snapshot:

```sql
select tester_number, name, model, os, browser, screen_size, pixel_ratio, language,
       time_zone, on_home_screen, display_mode, connection, effective_type,
       downlink_mbps, round_trip_ms, save_data, last_ip, opens, first_open, last_open
  from tester_admin.devices
 order by tester_number, last_open desc;
```

How to read it: an iPhone says `iPhone` and its iOS version, never the exact model (Safari does not tell); Android in Chrome gives the model (`Pixel 9`). `browser` reads `Safari (home screen)` for the installed app on an iPhone. `connection`, `downlink_mbps` and `round_trip_ms` come only from Android Chrome; they are empty on an iPhone. `on_home_screen` false means they are using Ethos in a browser tab, which on an iPhone keeps a different storage from the icon. Anyone in this list should be told to open it from the icon:

```sql
select tester_number, name, model, browser, last_open
  from tester_admin.devices
 where on_home_screen is not true
 order by last_open desc;
```

### Usage

Each tester's day (their own calendar): opens, screens, minutes on screen, taps, recordings started and stopped, problems:

```sql
select day, tester_number, name, opens, screens, minutes, taps,
       recordings_started, recordings_stopped, errors
  from tester_admin.usage
 order by day desc, tester_number;
```

How to read it: `minutes` counts only time the app was on screen. `recordings_started` well above `recordings_stopped` means takes abandoned mid-way. A day with opens and no recordings is someone who looked and left. Where the time goes, screen by screen, over the whole test (a recording's page counts as one screen, `/rep/[id]`):

```sql
select tester_number, name, screen, views, minutes, taps
  from tester_admin.screens
 order by tester_number, minutes desc;
```

What gets tapped on one screen (`/rep` is the recording screen and its results):

```sql
select label, count(*) as taps
  from public.tester_events
 where kind = 'usage' and name = 'tap' and screen = '/rep'
 group by label
 order by taps desc;
```

### Problems

Every error, newest first, with the device and the last five things that happened before it (`on_screen`):

```sql
select at, tester_number, name, source, screen, message, code_at, model, os, browser, on_screen
  from tester_admin.errors
 order by at desc;
```

How to read it: `source` is `window` (a script error), `rejection` (a failed promise nobody caught) or `boundary` (the "That screen didn't load" page, with `digest` matching Vercel's logs). `code_at` is the file and line in the built app. Everything that happened in the open the newest error came from, in order:

```sql
select at, kind, name, screen, label, ms
  from public.tester_events
 where open_id = (select open_id from tester_admin.errors order by at desc limit 1)
 order by at;
```

### Paying and the parents

Who has finished the 14 days (30 October to 12 November):

```sql
select tester_number, name, email, days_spoken
  from tester_admin.testers
 where days_spoken >= 14
 order by name;
```

The same list is who is owed free Premium at launch (the DM promises it): keep it.

`under_18` comes from the introduction's age answer, and it is empty for anyone who skipped that question or the whole introduction. Check you have a parent's or guardian's text for every tester where it is true or empty:

```sql
select upper(left(user_id::text, 8)) as tester_number, name, under_18
  from tester_admin.testers
 where under_18 is distinct from false
 order by joined_at;
```

## Deleting one tester's data

The consent says: ask Timothy and it's all deleted within 7 days. Do it the day they ask.

Everything, account included: the tester can do it themselves (Settings, Delete my account). For one who asks you instead, find their user id from their tester number (the query under The testers), then:

```
export NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service role key>
node scripts/tester-delete.mjs <user id>         # dry run: prints what goes
node scripts/tester-delete.mjs <user id> --yes   # does it
```

It removes their audio files and their rate-limit rows, then any anonymous session they signed in from while testing (its audio, rate limits and account, once Supabase confirms it is still anonymous), then the account, and the account's removal takes every row they own: recordings, transcripts, scores, progress, the tester row, the match answers, and every device, usage and error row. It refuses an account with a plan on it (that one deletes itself from Settings, which cancels the plan at Stripe first). Settings' Delete my account takes the carried sessions the same way.

To stop testing but keep the account and its recordings, add `--tester-only`: it removes the tester row first (their phone stops sending the moment the server sees none), then the device, usage and error rows, the match answers, the tester rate-limit rows, and any anonymous session they signed in from (nobody can open it again). It counts the rows again at the end and prints 0 and 0.

## Keeping it 12 months, then deleting it

The consent says the data is kept up to 12 months after the test ends, then deleted, and that a friend who keeps using Ethos keeps their recordings and scores in their account. The test ends Thursday 12 November 2026, so by **12 November 2027**:

1. See who still uses Ethos (spoke in the last 90 days):

```sql
select tester_number, name, email, last_spoken_at,
       last_spoken_at > now() - interval '90 days' as still_using
  from tester_admin.testers
 order by last_spoken_at desc nulls last;
```

2. Run the delete for every tester in that list: `--tester-only --yes` where `still_using` is true (what testing added goes; their account, recordings and scores stay, under Privacy's terms for everyone), and the full `--yes` for everyone else, which takes every recording made in the test.
3. Check the report is empty: `select count(*) from tester_admin.testers;` and `select count(*) from public.tester_events;` both 0.

Put it in your calendar now.

## Shipping 0022

Deploy the code that carries consent version 3 first, then apply 0022, minutes apart (as 0021 went on, #398). In the gap a version 3 tester's answers are refused and wait on their phone, resent from the next recording screen, and their device and usage batches are dropped; a sign-in carries the consent but cannot yet remember the session it came from (`carried_from`), and the size ceiling cannot be read, so it lets rows in. The migration file holds neither of the words the deploy connector stalls on.

## The message

The one Timothy sends, as one DM. Step 5 matters most: the tester number is the only way to tell a friend's rows apart in the report, so chase anyone who has not sent theirs by the end of day one.

```
yo thanks for being down 🙏

Ethos: 5 mins of speaking a day, and it measures how clearly you talk (ums, pace, pauses).

THE DEAL
5 mins a day for 14 days, starting today (Fri 30 Oct) to Thu 12 Nov. After each recording, tap how it felt, then whether the score felt right (be honest). 10 min chat at the end. A$35 when you finish + free Premium at launch.

SETUP (2 mins)
1. Open speakethos.com
2. iPhone: Safari > Share > Add to Home Screen. Android: Chrome > menu > Add to Home screen
3. Open it from your home screen, tap Tester code (top right), enter 1234
4. Read the consent, tap I agree, allow the mic
5. Send me your tester number (it's on the screen with a Copy button)

DATA
I see your recordings, transcripts, scores, how you use the app, device info, your IP and any errors. It's only used to make the scoring accurate and fix bugs. Only I see it, it's never sold, and it only goes to the services that run the app (database and storage, hosting, transcription and AI feedback, all named in Privacy). I'll delete it anytime you ask.
```

A friend who missed step 5 finds the number again in Settings, About, Testing Ethos.

If you set `TESTER_CODE` in Vercel (do, before it goes out), put that code in step 3 instead of 1234.
