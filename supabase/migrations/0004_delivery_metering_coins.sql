-- Schema v4 — delivery metrics, judged-tier metering, coin ledger.
-- Decisions log, 11 Aug 2026 (§3, §4, §6).
--
-- §6 is explicit that the delivery columns land BEFORE the video feature
-- ships, so Voice + Video is a migration rather than a rewrite and the
-- results screen can branch on whether presence exists rather than on
-- which mode the user picked.

-- ---------------------------------------------------------------------
-- Delivery feedback (§1, §6)
-- ---------------------------------------------------------------------

-- `mode` was already taken by daily|boss in v3, so the capture mode gets
-- its own column rather than overloading one word with two meanings.
alter table reps add column if not exists capture_mode text not null default 'voice';
alter table reps drop constraint if exists reps_capture_mode_check;
alter table reps add constraint reps_capture_mode_check
  check (capture_mode in ('voice', 'voice_video'));

-- Derived numbers ONLY. Raw video never leaves the device, is never
-- uploaded and is never stored — pose detection runs client-side and
-- this is the entire footprint it leaves behind.
-- {gesture_rate, posture_drift, head_stability, eye_line_pct, presence_score}
-- null for every rep recorded in Voice mode.
alter table reps add column if not exists delivery_metrics jsonb;

-- Presence is a SECOND score, not a modifier on the first. The Ethos
-- Index stays audio-only so the trendline and the XP leagues remain
-- comparable regardless of which mode a user picked that day (§1).
alter table reps add column if not exists presence_score integer
  check (presence_score between 0 and 1000);

-- Timestamped delivery moments ("0:47 — you looked down for 6s"). Pro
-- surface, but stored for everyone: withholding the readout is a paywall,
-- throwing away the measurement would be a lie about what we recorded.
-- [{t, kind, seconds, note}]
alter table reps add column if not exists delivery_moments jsonb;

create index if not exists reps_presence_idx
  on reps (user_id, created_at desc)
  where presence_score is not null;

-- ---------------------------------------------------------------------
-- Judged-analysis metering (§3)
-- ---------------------------------------------------------------------
--
-- Meter the JUDGED tier, never the rep. Fillers, WPM, pause ratio,
-- repetition and the transcript are free and unlimited forever; the LLM
-- layer is what costs money to serve, so that is what is metered.
--
-- `judged_rollover` is the whole balance, not a separate bank: a new day
-- tops it up by one, capped at 3, so a user who practises hard on
-- Saturday is never worse off than one who logs in daily. Streaks count
-- reps, not analyses — nothing here can break a streak.
alter table profiles add column if not exists judged_analysis_used_at timestamptz;
alter table profiles add column if not exists judged_rollover integer not null default 1;
alter table profiles drop constraint if exists profiles_judged_rollover_check;
alter table profiles add constraint profiles_judged_rollover_check
  check (judged_rollover between 0 and 3);

-- Local calendar date the balance was last topped up. Stored as the
-- user's local date, not UTC: a reset that lands at 10am local is a
-- worse product than one that can be nudged by an hour at a boundary.
alter table profiles add column if not exists judged_accrued_on date;

-- ---------------------------------------------------------------------
-- Coins (§4)
-- ---------------------------------------------------------------------
--
-- Append-only, `earned`/`spent` rows rather than one mutable integer, so
-- the earn rate can be re-tuned or retro-adjusted later without
-- corrupting history. There is no shop at launch; coins accrue with
-- nothing to spend them on, which is exactly why the rate is anchored to
-- a price now (1/day against a notional 14-coin first item) instead of
-- being picked once a sink exists and everyone is already rich.
create table if not exists coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('earned', 'spent')),
  amount integer not null check (amount > 0),
  reason text not null,
  -- The local calendar day an earn credits. Null for spends.
  earned_on date,
  rep_id uuid references reps (id) on delete set null,
  created_at timestamptz not null default now(),
  -- The earn rate lives in the database, not only in the client that
  -- writes the row.
  constraint coin_ledger_streak_day_amount
    check (reason <> 'streak_day' or amount = 1)
);

-- One streak-day coin per day, enforced by the index rather than by the
-- client remembering. A double-tap, a second tab and a replayed request
-- all collapse to the same single row.
create unique index if not exists coin_ledger_streak_day_uniq
  on coin_ledger (user_id, earned_on)
  where reason = 'streak_day';

create index if not exists coin_ledger_user_idx
  on coin_ledger (user_id, created_at desc);

alter table coin_ledger enable row level security;

drop policy if exists "own coins" on coin_ledger;
create policy "own coins" on coin_ledger
  for select using (auth.uid() = user_id);

-- The client grants its own streak-day coin the way it grants freezes.
-- The policy is what stops that from being a mint: only earns, only the
-- streak-day reason, only one coin, and only for a day the account
-- actually has a rep near. The ±1 day window is deliberate slack for the
-- gap between the user's local date and UTC — the unique index above is
-- what actually caps the rate, this check only refuses days with no
-- speaking in them at all.
drop policy if exists "own coins insert" on coin_ledger;
create policy "own coins insert" on coin_ledger
  for insert with check (
    auth.uid() = user_id
    and kind = 'earned'
    and reason = 'streak_day'
    and amount = 1
    and earned_on is not null
    and exists (
      select 1
      from reps r
      where r.user_id = auth.uid()
        and r.created_at >= (earned_on - 1)::timestamptz
        and r.created_at < (earned_on + 2)::timestamptz
    )
  );
