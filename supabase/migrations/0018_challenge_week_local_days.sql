-- 0018: the week's challenge coin counts the user's own days, not UTC's.
--
-- 0011's insert policy pays a challenge_week coin only for a week with
-- five distinct days of recordings, and it counted those days as UTC
-- dates inside the UTC week. The client counts closes on the user's
-- LOCAL calendar. So a Sydney user (UTC+11) who spoke Monday to Friday
-- at 09:00 had recordings on Sunday to Thursday UTC, the policy saw four
-- days, and refused the coin; a Los Angeles user speaking Wednesday to
-- Sunday evening was refused the same way. lib/coin-sync.ts sent every
-- unpaid week in one upsert, so one refused week blocked every later one
-- (that half is fixed in the client: one grant per week).
--
-- The database does not know the user's zone. It accepts the week if
-- SOME real UTC offset (15-minute steps, -12:00 to +14:00) puts five
-- distinct local dates inside the local week that starts on earned_on.
-- That is exactly the claim the client makes, for whichever zone the
-- user is in, and it is still never true of a week without five days of
-- speaking in it. The streak_day arm is 0011's, unchanged.
--
-- No drop: the policy is rewritten in place.

alter policy "own coins insert" on public.coin_ledger
  with check (
    auth.uid() = user_id
    and kind = 'earned'
    and earned_on is not null
    and (
      (
        reason = 'streak_day'
        and amount = 1
        and exists (
          select 1
          from public.reps r
          where r.user_id = auth.uid()
            and r.created_at >= (earned_on - 1)::timestamptz
            and r.created_at < (earned_on + 2)::timestamptz
        )
      )
      or
      (
        reason = 'challenge_week'
        and amount = 1
        and earned_on = (date_trunc('week', earned_on::timestamp))::date
        and exists (
          select 1
          from generate_series(-48, 56) as q(n)
          where (
            select count(distinct ((r.created_at at time zone 'utc') + q.n * interval '15 minutes')::date)
            from public.reps r
            where r.user_id = auth.uid()
              and r.created_at >= (earned_on - 1)::timestamptz
              and r.created_at < (earned_on + 8)::timestamptz
              and (r.created_at at time zone 'utc') + q.n * interval '15 minutes' >= earned_on
              and (r.created_at at time zone 'utc') + q.n * interval '15 minutes' < earned_on + 7
          ) >= 5
        )
      )
    )
  );
