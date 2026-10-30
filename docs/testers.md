# Testers

About ten friends speak for five minutes a day for 14 days and, after each recording, answer one question: did the score match how it felt? Their answers, stored beside the numbers they were shown, are how the thresholds (stars, the pause detector, presence) get tuned. This page is how to run it.

## What a tester gets

Tester mode switches on two things and nothing else: the consent they agree to, and the match check (Yes, Roughly or No, and an optional "What felt off?" after the last two). The question is asked on the last step of a recording's results, after the score and the numbers have both been on screen, and again at the foot of that recording's page in the Log, where an answer already given reopens as it was left and can be changed. It grants no Premium: 1234 is the first code anyone guesses, and Premium is what Ethos sells. To put a tester on Premium as well, send them the invite code too (`PREMIUM_UNLOCK_CODE`, entered from the paywall).

## How a friend becomes a tester

1. They open the link on their phone and add Ethos to the home screen (Safari: Share, Add to Home Screen).
2. They open Ethos **from the home-screen icon**, and do everything from there on. On an iPhone the icon keeps its own storage, apart from Safari's, so a code entered in Safari stays in Safari and the icon starts as someone new.
3. On the introduction's first screen they tap **Tester code** (small, top right).
4. They type the four digits (1234 unless `TESTER_CODE` is set) and tap Continue.
5. They read the consent and tap **I agree**. Not now leaves with nothing stored.
6. The next screen shows **Your tester number** (two groups of four, for example `3F9A 1C2E`) with Copy. They send it to you. It is how you find their row in the report, pay them, check the parent's text, and delete their data when they ask.
7. They tap **Back to the introduction** and carry on as anyone would.

Already past the introduction, or already have an account? Settings, About, **Tester code** does the same. Afterwards that row reads **Testing Ethos, On** and opens the date they joined, their tester number and what they agreed to. A friend who joins on the introduction and then signs in to an account they already had keeps testing: signing in (password or Google) hands the consent to that account.

The code is checked on the server only (`app/api/tester`), compared in constant time, and rate limited per address and per account (10 an hour, 30 a day). Only wrong codes count against it: a right code gives its slot back, so a room of friends on one Wi-Fi can all join at once. To stop new testers joining, set `TESTER_CODE` in Vercel to anything else and redeploy; existing testers stay testers. Since the door is on every new visitor's first screen and 1234 is the first guess, a fresh four digits sent only in your DM keeps strangers out of the report.

The consent's text is in `content/tester.ts` and `COPY-RULES.md`. The server stores the version a tester agreed to and when, in the same write that makes them a tester; agreeing again to the same version keeps the first time. Version 2 (30 Oct) names where every recording goes (the services Privacy lists) and links Privacy. A tester on version 1 sees the code entry again in Settings, and their results skip the question until they have read and agreed to version 2; migration 0021 refuses their answers until then.

## Where the data lives

Migration `0020_testers.sql`:

- `public.testers`: one row per tester (consent version, time). The tester can read their own row; nobody can write one from the browser.
- `public.tester_feedback`: one row per answered recording (the answer, the note, the scores on screen, the time), keyed by the recording's outbox id. A tester reads and writes only their own rows, and only while they are a tester on consent version 2 or later (0021). An account keeps 300 answers at most (0021): twenty a day for fourteen days is 280, and the cap stops anyone who types 1234 from filling the database. Changing an answer at the cap still works.
- `scores_shown` holds every number the answer was about: the Index, stars, each measured score, the judged ones, pace, fillers, pauses. `seen` says where the answer was given: `results` (the last step, after the numbers) or `log` (the recording's page, later).
- `tester_admin`: the report. A schema the API never exposes, closed to everyone but the service role and the SQL editor.

Their recordings, transcripts and scores are the ordinary `reps` rows, readable only by their owner (migration 0001). `scripts/check-testers-sql.mjs` runs every browser read and write against Postgres to prove it.

Their audio is in the private `audio` bucket. The server uploads it (no owner on the file, no user folder in its path), and since 30 Oct the server also signs every playback link (`app/api/audio`), only after checking the recording is the caller's. So the bucket needs no storage policy for the browser at all, and it should have none. Check once in the SQL editor:

```sql
select policyname, roles, cmd, qual
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects';
```

Any row that lets `anon`, `authenticated` or `public` read or list `bucket_id = 'audio'` lets any signed-in session (a free anonymous one included) list and play every recording, testers' included. Remove it in the dashboard (Storage, Policies). An empty result is right.

## Reading the report

Supabase dashboard, SQL editor. Each tester, with their tester number, days spoken since joining (on Melbourne's calendar, or their reminders' zone) and how their answers split:

```sql
select upper(left(user_id::text, 8)) as tester_number, name, email, anonymous,
       under_18, consent_version, joined_at, days_since_joining, days_spoken,
       recordings, average_index, matched_yes, matched_roughly, matched_no, notes
  from tester_admin.testers
 order by joined_at;
```

`name` and `email` are empty for a friend who skipped the name question and never made an account (`anonymous` is true). The tester number is the one way to tell those rows apart. One friend, by the number they sent you (with or without the space):

```sql
select user_id, name, email, under_18, days_spoken, recordings
  from tester_admin.testers
 where upper(left(user_id::text, 8)) = upper(replace('3F9A 1C2E', ' ', ''));
```

Every recording since they joined, its numbers and their answer:

```sql
select name, spoken_on, ethos_index, stars, wpm, filler_count, pauses,
       pause_score, fillers_score, pace_score, range_score, presence_score,
       matched, note
  from tester_admin.recordings
 order by name, spoken_at;
```

Where the score felt wrong, with what they said:

```sql
select name, spoken_on, ethos_index, stars, matched, note, scores_shown, transcript
  from tester_admin.recordings
 where matched in ('no', 'roughly')
 order by spoken_at desc;
```

Every answer, including any whose recording never stored (`rep_id` is null):

```sql
select name, answer, note, index_shown, stars_shown, answered_at, rep_id
  from tester_admin.answers
 order by answered_at desc;
```

Who has finished the 14 days:

```sql
select name, email, days_spoken
  from tester_admin.testers
 where days_spoken >= 14
 order by name;
```

`under_18` comes from the introduction's age answer, and it is empty for anyone who skipped that question or the whole introduction. Check you have a parent's text for every tester where it is true or empty:

```sql
select upper(left(user_id::text, 8)) as tester_number, name, under_18
  from tester_admin.testers
 where under_18 is distinct from false
 order by joined_at;
```

## Deleting one tester's data

Everything, account included: the tester can do it themselves (Settings, Delete my account). For one who asks you instead, find their user id from their tester number (the query under Reading the report), then:

```
export NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service role key>
node scripts/tester-delete.mjs <user id>         # dry run: prints what goes
node scripts/tester-delete.mjs <user id> --yes   # does it
```

It removes their audio files, then the account, and the account's removal takes every row they own: recordings, transcripts, scores, progress, the tester row and the match answers. It refuses an account with a plan on it (that one deletes itself from Settings, which cancels the plan at Stripe first).

To stop testing but keep the account and its recordings, add `--tester-only`: it removes only the tester row and the match answers.

## The message

> Your recordings and scores are only for making the scoring accurate. Only I see them, nothing gets shared, and I'll delete it all whenever you want. If you're under 18, just get a parent to text me it's cool.

"Nothing gets shared" is looser than the consent, which says each recording goes to the services that score and store it (Privacy names them). If you want the DM to match it exactly: "Only I see them, nothing's sold, and it only goes to the services that score it."

Then the steps, as a second message:

> Open speakethos.com on your phone, add it to your home screen, and open it from the icon. On the first screen tap Tester code (top right), type the code and agree. Then send me your tester number from the next screen.
