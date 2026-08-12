# 02 — Data Analyst: Tracking Plan, Weekly Metrics, Guardrails, Honesty Rules, Tooling

**Role:** Product Data Analyst · **Date:** 2026-08-12
**Mandate:** Instrumentation cheap enough for a solo founder to build and honest
enough that it cannot flatter him — the enemy is self-deception, not missing data.

---

## 0. Ground truth — what actually exists (verified against the repo tonight)

Before any plan: what the database and codebase can and cannot answer today.

**Tables that exist** (supabase/migrations/0001–0005):

| Table | Columns this doc uses | Notes |
|---|---|---|
| `reps` | `user_id` (nullable!), `created_at`, `lesson_id`, `duration_s`, `wpm`, `filler_count`, `stars`, `ethos_index` (nullable), `dimensions`, `mode` (daily\|boss), `mods`, `xp_multiplier`, `capture_mode` (voice\|voice_video), `presence_score`, `boss_topic_id` | The behavioural spine. A rep row is stored even when unscorable (#76) |
| `streaks` | `current`, `longest`, `last_rep_date`, `freezes_equipped` | Current state only — no history of past streaks |
| `streak_freezes` | `used_on` | One row per rescued day — freeze usage IS queryable |
| `xp_events` | `amount`, `source`, `rep_id`, `created_at` | |
| `lexicon` | `original`, `upgrade`, `rep_id`, `created_at` | Supply adoption (kept entries) IS queryable |
| `coin_ledger` | `kind`, `amount`, `reason`, `earned_on` | Append-only; `earned_on` is a **local** date — the only local-day value stored anywhere |
| `profiles` | `premium`, `premium_until`, `judged_*` metering columns, `created_at` | |

**Tables that do NOT exist:** `events` (no analytics events of any kind),
`league_members` (leagues are step 3; not built). There is **no analytics SDK,
no PostHog, no tracking call anywhere in `app/` or `lib/`** — I checked. Every
client-side event in §1 is spec-only.

**Four measurement gaps in the existing schema** (facts, not complaints — each
has a one-column fix listed in §1.4 for founder review):

1. **`ethos_index IS NULL` is ambiguous.** Reading `app/api/analyze/route.ts`:
   a rep gets no Index if it (a) failed the substance floor (#55), (b) had its
   judged tier metered out (#75), or (c) hit a hard grounding failure in the
   coach layer (#123). While `EVERYTHING_FREE = true` (verified in
   `lib/entitlement.ts`), metering answers "unlimited" for everyone, so today
   null ≈ substance-fail or coach hard-fail. **The moment #96 flips, this proxy
   breaks** — nulls will mostly mean "metered", and any retention cut on
   "scored reps" silently changes meaning. Fix before the flip, not after.
2. **The client's UTC offset is sent but not stored.** The analyze route reads
   `tzOffset` for metering (#77) and drops it. `reps.created_at` is UTC; no
   local day is recorded per rep. All local-day SQL below therefore uses
   `Australia/Melbourne` as an **explicitly flagged approximation** (AU-first
   market) — correct for the first users, wrong the day someone reps from
   another continent.
3. **No engine version on reps.** Scoring changed materially on 11 Aug alone
   (#97 pause placement, #100 self-corrections, #108 dimension split). A
   trendline that crosses an engine change is not user progress and not user
   decline — it is a recalibration. Nothing in the DB marks which engine
   scored which rep.
4. **`reps.user_id` is nullable** (founder-dogfood era). Every query below
   filters `user_id IS NOT NULL`, and founder accounts must be excluded by
   uuid (§4, item 5) or Timothy will be most of every cohort at launch N.

**Adoption statement re: 01-growth-pm.md.** I adopt the Growth PM's North Star
(W2R, §1.1 there) and activation definition (§2.1 there) **verbatim as the
metric contract** — the reasoning is right, especially "a rep, not a streak"
and the 8–14-day window for small-N robustness. Four measurement-side
amendments, none a disagreement of substance:

- Their event vocabulary is normalized here to strict `object_action` naming
  (their `mic_prompt{shown|granted|denied}` becomes three events; §1.1).
- Their `rep_completed` is reclassified: the `reps` row **is** that event.
  Instrumenting a duplicate client event invites the two counts to disagree.
- "Scored rep" is operationalized as `ethos_index IS NOT NULL`, with the
  undercount in gap 1 above stated wherever it is used.
- Their habit-branch metric "p50 loop time, start-tap → final results screen"
  cannot be computed from anything that exists — it needs the client events
  in §1. Listed as spec-only, not silently included.

One caveat on their handoff note 2 ("no aliasing table needed" — correct,
#142 keeps one auth user): the one identity leak is a user who signs **in** to
a different account, orphaning device progress (#80). Those users appear in
data as a churned anonymous cohort plus a fresh signup. Rare, unavoidable,
and worth remembering when anonymous churn looks slightly worse than saved
churn — some of it is the same humans.

---

## 1. Event tracking plan — the core loop

### 1.1 Principles

- **Don't instrument what the DB already records.** A rep, a lexicon entry, a
  freeze, a coin spend, an XP grant — these are rows. Querying rows beats
  duplicating them as events (two sources of truth always disagree eventually).
  Client events exist to capture what rows can't: *the taps that didn't result
  in a row* — the abandonment, the decline, the permission denial.
- **Every event names the decision it informs.** No decision, no event.
- **Global properties on every event:** `user_id` (anonymous Supabase uid —
  works pre-signup because anonymous auth issues a uid), `tz_offset_min`
  (client offset, clamped ±14h per #77 — one calendar rule everywhere),
  `entitlement_era` (`free_era` while `EVERYTHING_FREE`, else `paywalled`; the
  #96 rider — post-flip cohorts must be separable or the flip is unmeasurable),
  `premium` (the stored flag, read even now), `app_version` (or git SHA —
  serves as the engine-version tag until reps carry their own).
- **Privacy floor (adopted from 01 §5.3, hardened):** no transcript text, no
  audio, no video, no Presence frames, no prompt text in any event — IDs,
  counts, and enums only. The product's privacy posture (#70–74) is a stated
  selling point; analytics must not quietly undercut it. `supply` original/
  upgrade words never appear in events (they're in `lexicon` rows behind RLS,
  which is where they belong).

### 1.2 The plan

Status column: **BUILT-SURFACE** = the trigger moment exists in shipped UI,
only the logging call is missing. **DB-DERIVED** = do not instrument; query
the table. **SPEC-ONLY** = surface itself not built or dormant.

| Event (`object_action`) | Fires exactly when | Properties (beyond globals) | Decision it informs | Status |
|---|---|---|---|---|
| `welcome_viewed` | Each of the 3 `/welcome` screens renders (#133) | `screen: 1\|2\|3` | Does the intro hold or leak; whether 3 screens pay rent (01 §2.3) | BUILT-SURFACE |
| `mic_permission_requested` | The primed OS mic prompt is triggered (#135) | `rep_number` | Denominator for grant rate | BUILT-SURFACE |
| `mic_permission_granted` / `mic_permission_denied` | OS dialog resolves | `rep_number` | The funnel's most expensive tap (#68); is the priming sentence doing its claimed 2–3× job | BUILT-SURFACE |
| `rep_started` | Rec tap lands and recording actually begins | `lesson_id`, `mode: daily\|boss`, `capture_mode`, `rep_number`, `mods[]`, `frame_used: bool` | Start→complete abandonment — the only loop leak no table can show | BUILT-SURFACE |
| `rep_completed` | — | — | **CUT as an event: the `reps` row is this event.** Abandonment = `rep_started` with no rep row within ~10 min | DB-DERIVED |
| `rep_scored` | — | — | CUT: `reps.ethos_index`/`stars` on the row | DB-DERIVED |
| `results_step_viewed` | Each screen of the walked results renders (#103) | `step: score\|numbers\|words`, `rep_number` | Where the walk leaks; value produced but not seen | BUILT-SURFACE |
| `results_walk_completed` | Final results screen reached | `rep_number`, `ended_on: next_lesson\|done` | #105's momentum bet; feeds loop-time p50 with `rep_started` | BUILT-SURFACE |
| `dimension_tapped` | A dimension row is expanded on results/log | `key` (schema key, incl. `confidence` — display label is Steadiness per #87, analytics keep the schema key) | Explainability is the trust surface (branch C); which dimensions earn attention | BUILT-SURFACE |
| `when_plan_set` | The one-tap plan chip is tapped (#136) | `slot: morning\|lunch\|evening` | The d=0.65 lever — uptake half | BUILT-SURFACE |
| `notification_permission_granted` / `_denied` | OS dialog after the when-plan tap resolves | `slot` | Whether the primer earns the grant | BUILT-SURFACE |
| `reminder_clicked` | User opens the app from the reminder notification | `slot` | Plan→action half: pair with a rep row the same local day, or the reminder is furniture. (Fired-but-ignored reminders are only partly observable — #42's scheduling-tier honesty applies to analytics too; measure clicks, not sends) | BUILT-SURFACE |
| `soft_wall_viewed` | The save-progress wall renders (#134) | `trigger: rep1\|streak3` | Durability leak; the flagged hard-wall decision needs this denominator | BUILT-SURFACE |
| `soft_wall_declined` | "Not now" tapped | `trigger` | The other half of save rate; decline is designed safe — verify it is | BUILT-SURFACE |
| `signup_completed` | Email attach confirms (#142 convert sequence completes) | `path: anonymous_upgrade\|direct` | Save rate numerator; also DB-visible (auth user gains email) — event exists to carry `trigger` context the row can't | BUILT-SURFACE |
| `streak_extended` / `streak_lost` | — | — | **CUT as events:** derivable from rep rows + `streak_freezes` by replaying the day sequence; `streaks` holds current state. Instrumenting them means the mechanic's bugs write themselves into the record of the mechanic | DB-DERIVED |
| `streak_freeze_used` | — | — | CUT: `streak_freezes.used_on` is exactly this | DB-DERIVED |
| `lexicon_word_added` | — | — | CUT: `lexicon` rows. (The gold signal — upgraded word appearing in a later transcript — is a batch job over `lexicon` × `reps.transcript` server-side, never an event; transcripts stay out of analytics) | DB-DERIVED |
| `boss_mode_started` | — | — | CUT: `rep_started{mode: boss}` covers intent; completion is a rep row with `mode='boss'` | covered |
| `comparison_card_viewed` | Day-1-vs-day-N card renders | `days_spanned` | vision.md's core retention asset — is it ever SEEN unprompted (branch C) | BUILT-SURFACE |
| `share_card_created` | Share/export artifact generated (`ShareCard.tsx`) | `kind` | Branch E's artifact-first acquisition test — the only acquisition event that exists pre-gate | BUILT-SURFACE |
| `paywall_viewed` | A gated surface renders its gate | `surface: log_archive\|lexicon_archive\|boss_library\|presence_readout\|judged_meter` | **Dormant while #96 holds — ships in the schema NOW so flip-day has a day-one denominator.** `Paywall.tsx` exists but never renders in the free era | SPEC-ONLY (dormant) |
| `paywall_hit` | A metered limit actually blocks (judged cap reached, #75) | `surface`, `rollover_balance` | Demand pressure on the meter — the price-setting signal | SPEC-ONLY (dormant) |
| `upgrade_started` / `upgrade_completed` | Checkout opened / Stripe webhook confirms | `plan: monthly\|annual` | Conversion, post-flip only. No processor is wired yet (open queue) — `upgrade_completed` is a webhook-side insert when Stripe lands | SPEC-ONLY |
| `league_promoted` / `league_demoted` | — | — | **CUT entirely for now.** `league_members` doesn't exist, no league UI is built, and 01's Challenge 1 (density-gate the league) is pending Timothy's call. Instrumenting an unbuilt, challenged surface is planning theatre. Revisit when the league renders for anyone | CUT |
| `app_opened` / session events | — | — | **CUT deliberately.** Opens without reps are the number that flatters (#79: reward the rep, never the login). Days-spoken (from rep rows) is the honest usage metric | CUT |

~14 live client events total. That is the whole plan; anything a future
dashboard wants that isn't here must first name its decision.

### 1.3 Proposed `events` table (FOR FOUNDER REVIEW — not created tonight; documents-only run)

```sql
-- DRAFT DDL, review before running. One table, append-only, RLS like coin_ledger.
create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,                 -- object_action, values from §1.2 only
  props jsonb not null default '{}',  -- enums/counts/ids ONLY (privacy floor §1.1)
  tz_offset_min integer,              -- clamped client offset, #77 rule
  entitlement_era text not null default 'free_era',
  app_version text,
  created_at timestamptz not null default now()
);
create index events_user_created_idx on events (user_id, created_at desc);
create index events_name_created_idx on events (name, created_at desc);
alter table events enable row level security;
create policy "own events insert" on events for insert
  with check (auth.uid() = user_id);  -- no select policy: clients write, only the founder (service role / SQL editor) reads
```

Client side: one `track(name, props)` helper in `lib/` that fire-and-forgets an
insert via the existing Supabase browser client. No SDK, no queue, no consent
banner complexity (first-party, no cookies beyond the auth session already in
use — verify against AU Privacy Act posture at public launch). Estimated build:
half a day inside the **ASSUMPTION (intake unfilled): ~15 focused
founder-hours/week** budget.

### 1.4 Four one-column fixes to close §0's gaps (founder review, ordered by urgency)

1. `reps.scorable boolean` + `reps.judged boolean` — kills the null-ambiguity
   **before** the #96 flip makes it unfixable retroactively.
2. `reps.tz_offset_min integer` — store what the route already receives; ends
   the Melbourne approximation.
3. `reps.engine_version text` (git SHA or a hand-bumped constant) — makes
   score trendlines readable across recalibrations (#97/#100/#108 precedent).
4. `profiles.is_founder boolean` (or a hardcoded uuid list in the SQL) — makes
   founder-exclusion queryable instead of remembered.

---

## 2. The five weekly metrics (pre-launch stage)

Read Monday morning, one hour, same hour every week (§4, item 2). All SQL runs
in the Supabase SQL editor against production. Conventions used throughout:
`user_id IS NOT NULL`, founder uuid excluded (placeholder `:founder_id`),
local day = `(created_at at time zone 'Australia/Melbourne')::date` —
**flagged approximation** per §0 gap 2. "Scored" = `ethos_index IS NOT NULL` —
**flagged undercount** per §0 gap 1.

**Small-n banner over this whole section: with <100 users these are counts,
not rates.** "3 of 7 activated" is a fact; "43% activation" is the same fact
wearing a lab coat. Report the fraction, never the percentage, until the
denominator clears ~50 — and below ~30 total users, an hour watching five real
first sessions teaches more than any of these queries.

A reusable CTE the queries below share:

```sql
-- first_rep: each real user's first recording, with local day
with first_rep as (
  select user_id,
         min(created_at) as t0,
         (min(created_at) at time zone 'Australia/Melbourne')::date as d0
  from reps
  where user_id is not null
    and user_id <> :founder_id
  group by user_id
)
```

### Metric 1 — New rep-1 completers per week (cohort supply)

**Definition:** distinct users whose first-ever rep row landed this week.
The denominator feed for everything else (tree branch E). Not a growth
number — a measurement-supply number.

```sql
select date_trunc('week', d0) as week, count(*) as new_rep1_completers
from first_rep
group by 1 order by 1;
```

**How to read:** you need cohorts to exist before any retention number means
anything (01 §4.3 gate: one matured cohort of ≥50). Zero is a true and useful
reading: it says "keep building, stop staring at dashboards."
**Failure mode:** this is the easiest number to inflate (post somewhere, spike
the week) and the spike tells you nothing — a wave of rep-1s from a channel
that never returns *raises* this while W2R falls. Never celebrate M1 in a week
when M3's newest matured cohort got worse.

### Metric 2 — Activation rate (Growth PM contract, §2.1 there)

**Definition:** of rep-1 completers whose 72h window has closed, the share
with a second scored rep on a *different local day* within 72h of rep 1.

```sql
select count(*) as matured_rep1,
       count(*) filter (where activated) as activated
from (
  select f.user_id,
         exists (
           select 1 from reps r
           where r.user_id = f.user_id
             and r.ethos_index is not null
             and r.created_at > f.t0
             and r.created_at <= f.t0 + interval '72 hours'
             and (r.created_at at time zone 'Australia/Melbourne')::date <> f.d0
         ) as activated
  from first_rep f
  where f.t0 < now() - interval '72 hours'   -- matured windows only
) x;
```

**How to read:** the earliest habit signal that exists. Track it per weekly
cohort once cohorts have >10 people; before that, track the raw pair of
numbers. Validation of the definition itself is **WAITING ON DATA — do not
act** (01 §2.4 owns the kill criterion; I'll run the activated-vs-not W2R
split when ≥50 matured rep-1s exist).
**Failure mode:** onboarding changes that push a *same-sitting* second rep
("go again!") don't move this — good, by design — but a change that nudges
users to return once inside 72h and never again moves it up while W2R stays
flat. Activation up + W2R flat for two matured cohorts = the definition is
being gamed by our own UX; escalate to the 01 §2.4 rebuild clause.

### Metric 3 — W2R, the North Star

**Definition:** % of rep-1 completers with ≥1 scored rep during local days
8–14 after rep 1 (day 1 = d0, so the window is d0+7 … d0+13). Only cohorts
≥14 days old.

```sql
select date_trunc('week', d0)::date as cohort_week,
       count(*) as cohort_size,
       count(*) filter (where retained) as retained_w2
from (
  select f.*,
         exists (
           select 1 from reps r
           where r.user_id = f.user_id
             and r.ethos_index is not null
             and (r.created_at at time zone 'Australia/Melbourne')::date
                 between f.d0 + 7 and f.d0 + 13
         ) as retained
  from first_rep f
  where f.d0 <= (now() at time zone 'Australia/Melbourne')::date - 14
) x
group by 1 order by 1;
```

**How to read:** cohort by cohort, oldest first, and only matured cohorts —
this week's signups have NO W2R yet and must render as empty cells, not
zeros. Benchmarks beside the empty cells (named comparables, not Ethos
numbers): Amplitude's benchmark puts median 3-month retention ~3.8% vs
top-decile 18.5% [B, via 01 §1.3]; a habit product that can't hold double
digits at week 2 with a warm early audience has a product problem no growth
work fixes.
**Failure mode — three ways this looks good while the product gets worse:**
(a) early cohorts are friends and the persona-identical warm audience; W2R
falls as cohorts get colder, and comparing this month's strangers to last
month's friends reads as decline that isn't (or friend-era health that isn't);
label cohort *source* the day acquisition starts. (b) A streak-mechanic
tightening can push people to show up in days 8–14 while resenting it —
pair with M4's shape and days-spoken depth before celebrating. (c) Survivor
composition: if anonymous users clear their browsers, they vanish from the
denominator's *future* but not its past — watch branch D's save rate beside
this always.

### Metric 4 — The return curve (day-N since first rep)

**Definition:** for each day-offset N (1–14), the share of eligible users
(first rep ≥N days ago) with a rep on local day d0+N. The classic retention
triangle collapsed to one curve.

```sql
with days as (
  select r.user_id,
         (r.created_at at time zone 'Australia/Melbourne')::date - f.d0 as day_n
  from reps r
  join first_rep f using (user_id)
  group by 1, 2
)
select n.day_n,
       (select count(*) from first_rep f2
         where f2.d0 <= (now() at time zone 'Australia/Melbourne')::date - n.day_n) as eligible,
       count(distinct d.user_id) filter (where d.day_n = n.day_n) as returned
from generate_series(1, 14) as n(day_n)
left join days d on d.day_n = n.day_n
group by n.day_n order by n.day_n;
```

**How to read — this is the PMF instrument.** Plot returned/eligible by day.
**A curve that FLATTENS above zero — any plateau, even a low one — is the
signal that some population has formed a habit; a curve sliding monotonically
toward zero means the product does not retain, full stop,** and no
acquisition, paywall, or streak tuning is worth an hour until the shape
changes. At beta N the curve will be jagged; look for the shape across two
weeks of readings, not any single point.
**Failure mode:** the streak mechanic manufactures early flatness (days 2–5
look loyal because loss aversion is doing the lifting, #26). The honest read
is days 8–14: past the novelty week and past the first streak-protection
adrenaline. Also: aggregating all cohorts into one curve hides "newer cohorts
worse" — once ≥3 cohorts exist, plot them separately or the average lies.

### Metric 5 — Engine integrity: scored-rep rate

**Definition:** % of stored recordings that received an Ethos Index, weekly.

```sql
select date_trunc('week', created_at) as week,
       count(*) as recordings,
       count(*) filter (where ethos_index is null) as unscored,
       count(*) filter (where mode = 'boss') as boss_reps
from reps
where user_id is not null and user_id <> :founder_id
group by 1 order by 1;
```

**How to read:** in the free era, unscored ≈ substance-floor fails (#55) plus
coach-layer hard failures (#123). A rising unscored share on rep 1 is an
*onboarding defect* — the prompt is too hard cold, or the mic pipeline is
mangling audio — masquerading as churn (01's tree says the same: "a floor
failure on rep 1 is an onboarding bug, not a user failure"). This metric
exists so that weeks when retention dips get checked against weeks when the
engine got stricter, before anyone writes a growth story about it.
**Failure mode:** it can look *perfect* while the product gets worse — 100%
scored via a substance floor that's too lenient means garbage reps earn
Indexes and every downstream number inflates. Read it with the founder's own
hand-check ritual (BUILD-PLAN definition of done: numbers match what you'd
count by hand). And per §0 gap 1: **the day #96 flips, this metric's meaning
changes** — unscored will mostly mean "metered". Ship §1.4 fix 1 first.

**Deliberately not in the five:** signups (branch D diagnostic, not a weekly
star — the product is anonymous-first, #15), total reps (volume without
persons), streak lengths (mechanic-sensitive: #38/#126 can move them with no
human behaving differently), DAU/WAU (acquisition-dominated at this scale),
and anything Presence — client-trusted by design (#72), fine for the user,
not evidence for us.

---

## 3. Guardrail metrics per experiment class

Rule: every experiment names its guardrails **before** it starts, and a win
on the primary that trips a guardrail is a **loss** — written into the growth
log as a loss. Vision.md constraints sit above all of this: an experiment
that wins by guilt, manufactured insecurity, or score inflation is a failed
experiment with a good conversion rate (adopting 01 §4.1's house rule).

| Experiment class | Primary metric (tree node) | Guardrails | Loss condition (explicit) |
|---|---|---|---|
| **Paywall / pricing** (post-flip only; dormant until #96 reverses) | Upgrade rate (`paywall_viewed` → `upgrade_completed`) | **W2R of the exposed cohort** (the brief's own example: conversion up + retention down = loss); days-spoken/week; streak survival through `paywall_hit`; `soft_wall` save rate | Conversion ↑ while exposed-cohort W2R or days-spoken ↓ vs the pre-flip baseline — which is why the baseline must exist *before* the flip |
| **Onboarding / activation** (welcome copy, mic primer, lesson-1 difficulty, walk framing) | Activation rate (M2) | Mic grant rate; rep-1 unscored rate (M5 on rep 1 — an easier-sounding prompt that fails the substance floor more is a net loss); walk completion; W2R | Activation ↑ but W2R flat for 2 matured cohorts (§2 M2 failure mode); or mic grants ↓ |
| **Reminders / notifications** (#136 copy, timing, slots) | `reminder_clicked` → same-local-day rep | Notification permission denial rate; reminder disable rate in settings; **the one-per-day cap and quiet hours are constraints, not variables** (mechanics.md) | Same-day reps ↑ while disables/denials ↑ — you're spending permission capital you can't re-earn |
| **Scoring / threshold calibration** (star thresholds, pause constants, `VOICED_THRESHOLD`, Presence constants — the open-queue calibration bucket) | Agreement with hand-counted ground truth (the only valid primary; user metrics are NOT the target) | Score-distribution continuity: median Index and star mix before/after, **read as a recalibration, never as user change**; M5 unscored rate | Any reading of a post-change score movement as user improvement/decline. Without `engine_version` (§1.4 fix 3) this guardrail is enforced by diary discipline: log the deploy date, split every trendline there |
| **Content / path** (new units, road copy, lesson order — incl. 01's Challenge 2 runway trigger) | Path progression; week-5 return of near-end users | Loop time p50 ≤ 5 min (vision.md cap; needs §1's events); W2R; per-lesson unscored rate (a too-hard new lesson shows up as floor-fails) | Progression ↑ via lessons that fail more or bloat the loop |
| **Mechanics / celebration** (sound #138–140, streak UI, day counter, shop) | Next-day return of exposed users | Sound/haptics opt-out rate; one-celebration-per-rep rule (#34) as constraint; coin-ledger sanity (the #132 lesson: silent mechanic failures — assert grants actually land) | Return ↑ while opt-outs climb; or any mechanic change that moves streak numbers with no change in rep rows (mechanic measuring itself) |
| **Acquisition** (post-gate only, per 01 §4.3) | New rep-1 completers (M1) | **Per-source W2R** vs organic baseline; rep-1 unscored rate per source (cold traffic fails the floor more) | Volume ↑ from a source whose W2R runs materially below organic — that channel is buying noise, not users |

Standing guardrail on everything: the **§2 small-n banner**. A guardrail that
moved on 9 users hasn't moved; it's twitched. Two consecutive weekly readings
or ~30+ users per cell before a guardrail verdict either way.

---

## 4. Anti-self-deception checklist

Print this. It is the actual deliverable; the SQL is just plumbing.

1. **Minimum samples before reading anything.** Fractions ("3 of 7"), never
   percentages, below n=50 per cell. No before/after comparison verdicts
   below ~30 per side; no A/B tests at all pre-gate (adopting 01 §3: at 50/arm
   you can only detect ~±14-point swings — anything subtler is astrology with
   dashboards). Directional language only until n≥100.
2. **No peeking.** One metrics hour, Monday, calendar-blocked. Mid-week looks
   are allowed for *bug detection only* (M5, error rates), never for verdicts.
   Sequential peeking at a moving rate is how a coin flip becomes a
   "trend" — every extra look is another lottery ticket for a false positive.
   Kill criteria are written before a change ships (01 §4.1 template,
   adopted), so the reading day is checking a prediction, not shopping for one.
3. **Friends and hallway tests are directional, never confirmatory.** They
   are persona-warm, socially incentivized to be kind, and they know you.
   Their sessions are gold for *watching* (where they hesitate, what they
   misread) and worthless for *rates*. Tag known-contact uids; exclude them
   from cohort metrics the same as the founder.
4. **Survivorship bias is the default state of all feedback.** Every reply
   to hello@ (#83), every Discord message, every review comes from someone
   engaged enough to write; the churned are silent by definition. The
   feedback you receive describes the users you kept. Every voice-of-customer
   line stays marked **UNVALIDATED HYPOTHESIS** until it has a behavioural
   count behind it — no exceptions, including in future role documents.
5. **Exclude the founder from every aggregate.** Vision.md makes Timothy user
   zero and the dogfood table the QA gate — correct, and it means his uid
   will be the single largest data source at launch. One uuid filter (§1.4
   fix 4), applied everywhere, from day one.
6. **A spike is noise until it survives two readings.** Novelty week ≠ habit
   (M4's failure mode); launch-post week ≠ baseline. Nothing about week 1 of
   a change gets written down as a result, only as a note.
7. **Never read trendlines across engine versions** (§3 scoring row). The
   11 Aug recalibrations (#97, #100, #108) already make pre/post-11-Aug
   Indexes incomparable. Log deploy dates; split charts there.
8. **Never compare free-era to post-flip cohorts on gated surfaces** (#96
   rider, via 01). `entitlement_era` on every event and a hard line in every
   chart at flip day.
9. **With <100 users, watch, don't aggregate.** Five complete first sessions
   — screen-recorded with consent or shoulder-surfed — beat any query in §2.
   The event funnel says *where* people leave; only watching says *why*. 01's
   data gate (§4.3 there) requires ≥10 observed sessions before a ranked
   backlog exists; schedule them like meetings or they won't happen.
10. **Publish refuted hypotheses.** The #118 precedent, applied to growth: a
    killed experiment gets its one-line entry (claim, result, correction) in
    the growth log. A deleted failure is a failure you'll re-run in three
    months.
11. **Streak metrics measure the mechanic, not retention** (01 refinement 1,
    adopted as a standing rule). Any analysis where a streak number is the
    dependent variable must state which mechanic decision could move it with
    zero human behaviour change (#38, #39, #126 all can).
12. **The dashboard is the 01 §1.3 tree with empty cells, plus the §2.3
    funnel — nothing else.** An empty cell is a true statement ("not enough
    data"). A twenty-chart dashboard at zero users is a twenty-way invitation
    to stare at noise until it winks.

---

## 5. Tooling recommendation

Constraints: solo dev, ~15 h/week (**ASSUMPTION, intake unfilled**), stack is
Next.js/Supabase/Vercel, privacy posture is a selling point (#70–74),
identity is the anonymous Supabase uid, and every metric that matters (§2)
joins against `reps` — which lives in Supabase Postgres.

| Option | Cost | Setup effort | Joins to `reps`/`streaks` | Funnel/retention UI | Privacy / data residency | Session replay |
|---|---|---|---|---|---|---|
| **Supabase-native `events` table** (§1.3) | $0 (existing project) | ~half a day: table + `track()` helper + saved SQL | **Native — same database, one `join`** | None; SQL only (this doc ships the queries) | First-party, RLS, nothing leaves the stack | No |
| **PostHog Cloud free tier** | $0 to ~1M events/mo | 1–2 days: SDK, reverse-proxy to dodge blockers, uid as `distinct_id`, property hygiene | Indirect — behavioural truth stays in Supabase; funnels live elsewhere; answering "did walk-completers retain" means stitching two systems | Excellent (funnels, retention curves, paths) — the actual reason to want it | Third-party subprocessor; fine if configured metadata-only, but it's config discipline, not architecture | Yes — but **replay on a mic/camera product needs a masking review before it ever turns on**; a replay of a rep screen is adjacent to exactly what #70 promises never leaves the device |
| **Vercel Analytics** (likely already available) | $0 basic | Minutes | None (no user identity) | No | Aggregated, cookieless | No |
| **Plausible / Umami** | ~$9/mo or self-host | Hours | None | Page-level only | Excellent | No |

**Pick: the Supabase-native events table, now.** Reasoning, in order of
weight: (1) every §2 metric is a join against `reps` — the NSM is computable
*today, with zero instrumentation*, from tables that already exist, and the
client events only add funnel edges; putting those edges in the same Postgres
means one query answers "did users who completed the walk retain better," and
no cross-system stitching ever lies about identity. (2) At near-zero users a
funnel UI renders empty charts; PostHog's genuine advantages price in at a
scale we don't have. (3) First-party keeps the privacy posture architectural
instead of configurational. (4) It's the cheapest thing that can possibly
work, in founder-hours — the binding budget.

**Named upgrade path, with a trigger:** adopt PostHog **alongside** (dual-write
inside the one `track()` helper — a 20-line change) when either (a) ≥100
rep-1 completers exist and weekly funnel reading in raw SQL starts eating >1
of the 15 hours, or (b) the #96 flip lands and paywall funnel iteration gets
frequent. Session replay stays off unless a masking review passes; until
then, item 9's consented session-watching covers the need at our N.
Keep/enable Vercel Analytics for the marketing pages only (page-level reach
of speakethos.com — branch E context, never product truth).

---

## 6. Formal challenges and gaps

**Formal challenges to locked decisions: none.** I reviewed all 142 entries;
nothing locked conflicts with honest measurement. The two challenges already
open in 01 (§6: league density-gating; path runway) both carry measurement
plans I endorse — the league one specifically means §1.2's cut of league
events stands until Timothy rules.

**Gaps flagged for founder action (not challenges — nothing locked says
otherwise):** the four one-column fixes in §1.4, with fix 1
(`scorable`/`judged` on reps) explicitly sequenced **before** the #96 flip,
because it cannot be backfilled after.

**Adopted from 01 without reservation:** W2R as NSM, the activation
definition and its 72h window (validation WAITING ON DATA, their §2.4), the
§1.3 tree as the only dashboard, the §4.3 data gate, the no-A/B-pre-gate
rule, and the era-labelling rider on #96.

*End of role 2. Next roles: the events in §1.2 are the vocabulary — do not
invent parallel event names; the §2 queries are the definitions of record for
any number you cite; and §4 binds your claims too, including item 4's
UNVALIDATED HYPOTHESIS marking.*
