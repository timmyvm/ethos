# Testers

About ten friends speak for five minutes a day for 14 days and, after each recording, answer one question: did the score match how it felt? Their answers, stored beside the numbers they were shown, are how the thresholds (stars, the pause detector, presence) get tuned. This page is how to run it.

## What a tester gets

Tester mode switches on two things and nothing else: the consent they agree to, and the match check on results (Yes, Roughly or No, and an optional "What felt off?" after the last two). It grants no Premium: 1234 is the first code anyone guesses, and Premium is what Ethos sells. To put a tester on Premium as well, send them the invite code too (`PREMIUM_UNLOCK_CODE`, entered from the paywall).

## How a friend becomes a tester

1. They open the link on their phone and add Ethos to the home screen (Safari: Share, Add to Home Screen).
2. On the introduction's first screen, under Next, they tap **Tester code** (bottom right).
3. They type the four digits (1234 unless `TESTER_CODE` is set) and tap Continue.
4. They read the consent and tap **I agree**. Not now leaves with nothing stored.
5. They tap **Back to the introduction** and carry on as anyone would.

Already past the introduction? Settings, About, **Tester code** does the same. Afterwards that row reads **Testing Ethos, On** and shows what they agreed to and since when.

The code is checked on the server only (`app/api/tester`), compared in constant time, and rate limited per address and per account (10 an hour, 30 a day). To stop new testers joining, set `TESTER_CODE` in Vercel to anything else and redeploy; existing testers stay testers.

The consent's text is in `content/tester.ts` and `COPY-RULES.md`. The server stores the version a tester agreed to and when, in the same write that makes them a tester.

## Where the data lives

Migration `0020_testers.sql`:

- `public.testers`: one row per tester (consent version, time). The tester can read their own row; nobody can write one from the browser.
- `public.tester_feedback`: one row per answered recording (the answer, the note, the scores on screen, the time), keyed by the recording's outbox id. A tester reads and writes only their own rows, and only while they are a tester.
- `tester_admin`: the report. A schema the API never exposes, closed to everyone but the service role and the SQL editor.

Their recordings, transcripts and scores are the ordinary `reps` rows, readable only by their owner (migration 0001). `scripts/check-testers-sql.mjs` runs every browser read and write against Postgres to prove it.

## Reading the report

Supabase dashboard, SQL editor. Each tester, with days spoken since joining (on Melbourne's calendar, or their reminders' zone) and how their answers split:

```sql
select name, email, under_18, joined_at, days_since_joining, days_spoken,
       recordings, average_index, matched_yes, matched_roughly, matched_no, notes
  from tester_admin.testers
 order by joined_at;
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

`under_18` comes from the introduction's age answer. Check you have a parent's text for every tester where it is true.

## Deleting one tester's data

Everything, account included: the tester can do it themselves (Settings, Delete my account). For one who asks you instead, with the user id from `tester_admin.testers`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service role key> \
  node scripts/tester-delete.mjs <user id>         # dry run: prints what goes
  node scripts/tester-delete.mjs <user id> --yes   # does it
```

It removes their audio files, then the account, and the account's removal takes every row they own: recordings, transcripts, scores, progress, the tester row and the match answers. It refuses an account with a plan on it (that one deletes itself from Settings, which cancels the plan at Stripe first).

To stop testing but keep the account and its recordings, add `--tester-only`: it removes only the tester row and the match answers.

## The message

> Your recordings and scores are only for making the scoring accurate. Only I see them, nothing gets shared, and I'll delete it all whenever you want. If you're under 18, just get a parent to text me it's cool.
