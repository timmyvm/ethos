-- Schema v11 — a second earn reason, for the daily challenge's weekly
-- coin (DECISIONS #281).
--
-- WHY WEEKLY AND NOT DAILY. The streak-day coin already fires for the
-- same recording that closes a challenge, so a daily challenge coin
-- would be two ledger rows for one act, and it would double the earn
-- rate the shop's prices were set backwards from (lib/coins.ts:
-- the first item is priced at fourteen, which is two weeks of speaking).
-- One coin for a week with five closed days in it keeps the rate
-- honest, keeps the grant deterministic, and is not a lottery: nothing
-- in this product is random (docs/growth/03, "add no exogenous
-- randomness").
--
-- WHAT THIS FILE ACTUALLY NEEDS TO CHANGE. 0005 already replaced the
-- partial index with a FULL one, `coin_ledger_earn_uniq (user_id,
-- reason, earned_on)`, and its own comment says that was to "still
-- allow future earn reasons on the same day". So the rate cap needs
-- nothing new. What blocks a second reason is 0004's insert policy,
-- which hard-codes `reason = 'streak_day'`. That is all this replaces.
--
-- WHAT THE POLICY CAN AND CANNOT CHECK. It can check that the week
-- credited contains real recordings. It cannot recompute whether the
-- challenge closed, because that needs the trait readings and the
-- user's own trailing window (lib/challenge.ts). The client decides;
-- the policy stops the row being minted out of nothing. That is the
-- same division of labour 0004 chose for the streak-day coin, and it is
-- worth saying out loud rather than implying a guarantee that is not
-- there.

alter table coin_ledger drop constraint if exists coin_ledger_challenge_week_amount;
alter table coin_ledger add constraint coin_ledger_challenge_week_amount
  check (reason <> 'challenge_week' or amount = 1);

drop policy if exists "own coins insert" on coin_ledger;
create policy "own coins insert" on coin_ledger
  for insert with check (
    auth.uid() = user_id
    and kind = 'earned'
    and earned_on is not null
    and (
      -- The day's coin, unchanged from 0004: one, for a day with
      -- speaking in it. The +/- 1 day window is slack for the gap
      -- between the user's local date and UTC; the unique index is what
      -- caps the rate.
      (
        reason = 'streak_day'
        and amount = 1
        and exists (
          select 1
          from reps r
          where r.user_id = auth.uid()
            and r.created_at >= (earned_on - 1)::timestamptz
            and r.created_at < (earned_on + 2)::timestamptz
        )
      )
      or
      -- The week's coin. `earned_on` is that week's Monday, and the week
      -- has to hold at least five distinct days with a recording: the
      -- client only asks when five of them CLOSED, and five days of
      -- speaking is the most the database can verify on its own.
      (
        reason = 'challenge_week'
        and amount = 1
        and earned_on = (date_trunc('week', earned_on::timestamp))::date
        and (
          select count(distinct (r.created_at at time zone 'utc')::date)
          from reps r
          where r.user_id = auth.uid()
            and r.created_at >= earned_on::timestamptz
            and r.created_at < (earned_on + 7)::timestamptz
        ) >= 5
      )
    )
  );
