# 01 — Growth PM: North Star, Activation, Experiment Framework

**Role:** Head of Growth (retention-first, Mazal school) · **Date:** 2026-08-12
**Mandate:** One North Star with a tree under it, one implementable activation
definition, and an experiment *framework* — no ranked backlog until users exist.

---

## 0. Operating stance and assumptions

I work the funnel in reverse: retention → activation → acquisition. Fixing
acquisition on a leaky bucket is burning money; at Ethos's stage there is no
money to burn and no bucket measured yet, so the sequencing is not a preference,
it is the plan.

Stage facts this document is built on:

- Pre-launch, near-zero traffic, live at speakethos.com. No usage data exists.
  Every number about Ethos users in this document is therefore a hypothesis or
  a named-comparable benchmark, never a result.
- Everything is currently free behind one constant (DECISIONS #96). All
  monetisation thinking is design-for-the-flip, not currently-live. Nothing in
  this document proposes paid-conversion work; it proposes the instrumentation
  that makes the flip measurable later (§5, handoff note 3).
- The onboarding funnel is BUILT (DECISIONS #133–137): fresh browser →
  `/welcome` (3 screens, no quiz) → rep 1 (audio always, mic ask primed,
  baseline-framed per #135) → walked results (#103) → when-plan tap (#136) →
  save-progress soft wall for anonymous sessions (#134) → standing "keep them"
  line (#137). My activation definition targets this funnel as it exists.
- **ASSUMPTION (intake unfilled): ~15 focused founder-hours/week.**
- **ASSUMPTION (intake unfilled): soft launch / public beta within ~4–6 weeks.**
- Market: AU-first, AUD; product serves global English speakers.
- User quotes in this doc: none exist. Any voice-of-customer line below is
  marked **UNVALIDATED HYPOTHESIS**.

Where I disagree with a locked decision I raise a formal challenge in §6.
Nothing locked is silently contradicted.

---

## 1. North Star metric

### 1.1 The call: adopt vision.md's Day-14 retention, refined to be measurable

vision.md declares the north star: "Day-14 retention. Not signups, not
downloads, not followers. A signup is a compliment; a 14-day streak is a
business." I adopt it — it is the right star for a habit product — and refine
it in two ways, with reasoning. This is refinement, not a challenge.

**North Star Metric (NSM): Week-2 Rep Retention (W2R)** —
*the percentage of new users who complete a scored rep on day 1 (local
calendar) and complete at least one more scored rep during local days 8–14.*

Refinement 1 — **a rep, not a streak.** vision.md's poetic form ("a 14-day
streak is a business") must not become the operational definition. A user who
reps 9 of the first 14 days is a retained, habit-forming user with a broken
streak. Streaks are a *mechanic* that serves retention (loss aversion, #26,
#38); they are not the retention measure. Measuring streak survival as the NSM
would push us toward protecting streaks (more freezes, softer rules) instead of
producing return visits. DECISIONS #76 already encodes this instinct at the
metering layer: streaks count reps, not analyses. Same logic, one level up:
the business counts reps on days, not unbroken chains.

Refinement 2 — **a window, not an exact day.** "Returned on exactly day 14" at
beta cohort sizes (tens of users) is coin-flip noise; one person's travel day
moves the number 5 points. Days 8–14 as a window is the standard week-2
retention construction, it is robust at small N, and it still measures the
thing vision.md means: the habit survived past the novelty week.

Denominator detail: the cohort base is **users who complete a scored rep 1**
(passes the substance floor, #55) — not visitors, not `/welcome` viewers, not
signups. Sub-rep-1 losses are an *activation* problem (§2 and branch A of the
tree), and mixing them into the NSM base would let onboarding fixes masquerade
as retention gains. "Day 1" and "days 8–14" use the user's local calendar day
via the client UTC offset the product already uses for metering resets (#77) —
one day-boundary definition everywhere, or every retention number is fuzzy at
the edges.

### 1.2 Alternatives rejected, and why

| Candidate NSM | Why rejected |
|---|---|
| Signups / accounts created | Product is anonymous-first (#15, #134): signup is a *mid-funnel durability event*, not entry. Optimising it invites the quiz-wall/hard-wall patterns the product exists to reject (#11). It appears in the tree (branch D) with a retention-linked job: an unsaved browser is a cohort we lose the ability to re-engage and measure. |
| DAU / WAU | At near-zero users, absolute actives are dominated by acquisition volume, which we are deliberately not working yet. DAU is where this goes *after* W2R is healthy and acquisition unlocks — Duolingo's own growth model decomposes DAU into retention states, which is the accounting frame handed to the Data Analyst (§5). |
| Day-1 return (NURR-style) | The single best *leading indicator* — Duolingo treats day-2 return as activation, and the onboarding research pass (docs/onboarding-research.md §8, [A]-grade) already adopted this. But as the NORTH star it's too early: it validates onboarding, not habit. It becomes the spine of my activation definition (§2) instead. |
| Day-30 / month-2 retention | The truer long-term number, but at a 4–6 week beta horizon a D30 cohort matures too slowly to steer weekly decisions. W2R is the earliest window that still measures habit rather than novelty. D30 goes in the tree as a lagging check on W2R, not the star. |
| Median streak length | Same streak-vs-retention confusion as above, plus it's freeze-policy-sensitive: two mechanics decisions (#38, #126) can move it without any user behaving differently. A metric the *designer* can move isn't a metric. |
| Total reps / recordings | Volume without persons. Ten users doing 3 reps beats one user doing 30 for every future the business has. Days-spoken-per-user (the #93 day counter, which "only goes up") is the honest per-user volume metric and lives in branch B. |

### 1.3 The metric tree

Every branch traces to W2R. Nothing below is a vanity metric: each line either
feeds a W2R input or protects the ability to measure/re-engage a cohort.

```
NSM: W2R — % of rep-1 completers with ≥1 scored rep in local days 8–14
│
├── A. ACTIVATION (§2) — % of rep-1 completers who become Activated
│    ├── /welcome view → rep-1 started (the three-screen intro holds or leaks)
│    ├── mic permission grant rate (primed ask, #135 — the funnel's most
│    │     expensive tap; camera never asked at rep 1 by design, #68)
│    ├── rep-1 completed & scored (substance-floor pass rate, #55 — a floor
│    │     failure on rep 1 is an onboarding bug, not a user failure)
│    ├── results walk completed to final screen (#103 — the walk exists so
│    │     value is SEEN; exits mid-walk are the leak to watch)
│    └── rep 2 on a second local day within 72h  ← the activation event
│
├── B. HABIT FORMATION — do activated users build the daily loop
│    ├── days-spoken per user per week (the #93 day counter — the honest
│    │     volume number: pays once per day like coins, #79)
│    ├── streak-3 survival rate (Duolingo [A]: 1→2 day streak is the big
│    │     retention jump; 3 is where our second soft wall fires, #134)
│    ├── when-plan set rate (#136) and reminder→same-day-rep conversion
│    │     (d=0.65 mechanism only counts if the plan produces reps)
│    ├── freeze coverage: % of streak-threatening gaps bridged (#38/#39)
│    └── p50 loop time, start-tap → final results screen (guardrail: vision.md
│          caps the loop at 5 min; a slow loop is a silent churn machine)
│
├── C. VALUE DEPTH — is the product's promise (visible progress) delivered
│    ├── first baseline-beat: % of activated users whose Index beats rep 1's
│    │     baseline within 7 days, and days-to-first-beat (the #135 frame
│    │     writes a cheque — "a number to beat" — this measures cashing it)
│    ├── judged-analysis viewed rate per scored rep (the LLM tier is the
│    │     coaching layer; metered at 1/day when the flip comes, #75 — its
│    │     usage curve now is the demand signal for that price)
│    ├── dimension drill-down taps per results view (explainability is the
│    │     trust surface — the Wellspoken-confirmed converting behaviour)
│    ├── supply adoption: lexicon entries kept, and — the gold signal —
│    │     an upgraded word APPEARING in a later transcript (fuzzy to
│    │     detect, worth the fuzz: it's the product working end-to-end)
│    └── day-1-vs-day-N comparison card views (the core retention asset
│          AND the core marketing asset — one artifact, per vision.md)
│
├── D. DURABILITY — does the cohort survive as a measurable, reachable cohort
│    ├── soft-wall save rate (shown → saved, at rep-1 exit and streak-3, #134)
│    ├── anonymous data-loss rate: % of activated-but-unsaved browsers never
│    │     seen again (each is a user we can never email, count, or win back)
│    └── email capture rate among W2-retained users (the only owned
│          re-engagement channel this product has; hello@ replies are free
│          user research by design, #83)
│
└── E. COHORT SUPPLY (acquisition — deliberately last, deliberately thin)
     └── new rep-1 completers per week. Not for growth: for MEASUREMENT.
         W2R needs cohorts to exist. Target just enough volume to mature
         one readable cohort (§4.3). Source: founder-documented reps and
         the day-1-vs-day-N artifact (mechanics.md, CAC ≈ 0). No paid, no
         channel work, until W2R has a baseline and §4.3's gate opens.
```

Vanity-metric policy, explicit: signups appear only as branch D (durability of
measurement + re-engagement), page views only as the top of branch A's funnel,
total reps nowhere (days-spoken replaces it). If a future dashboard shows a
number this tree doesn't contain, the dashboard is wrong.

**WAITING ON DATA — every rate in this tree ships as an empty cell.** The tree
is the instrumentation contract, not a scoreboard. No targets are set here;
inventing target percentages for users who don't exist would be fiction.
Benchmarks worth pinning beside the empty cells, from named comparables:
Duolingo's delayed-signup pattern was worth +20% DAU [A, Gotthilf]; Amplitude
puts top-decile 3-month retention at 18.5% vs 3.8% median [B]; Duolingo calls
the 1→2-day streak jump their big retention cliff [A]. Those calibrate
expectations; they are not Ethos numbers.

---

## 2. "Activated", precisely

### 2.1 The definition

> **Activated:** the user completes scored rep 1, and completes a second
> scored rep on a *different local calendar day* within **72 hours** of rep 1.

Operationally, for the Data Analyst — activation fires when all four hold:

1. `rep_1`: a completed rep that passes the substance floor (#55) — "not
   enough to score" does not start the clock (it still streaks per #76, but a
   floor-fail is an onboarding defect to fix, not a baseline to beat).
2. `rep_2`: a second completed, scored rep by the same subject.
3. `local_day(rep_2) ≠ local_day(rep_1)`, using the client-offset local-day
   rule the product already has (#77). Two reps in one sitting are practice,
   not return.
4. `rep_2.completed_at − rep_1.completed_at ≤ 72h`.

The identity spine is the anonymous Supabase user id (#80/#142: the anonymous
upgrade keeps the SAME auth user, so activation survives account save with no
identity stitching). A cleared browser that never saved is an activation loss
we cannot distinguish from churn — which is exactly why branch D exists.

### 2.2 Why this and not the other candidates

The brief named three candidates. Judged against "earliest measurable moment
that predicts return":

- **First analysis viewed** — rejected as the definition: it doesn't
  discriminate. The results walk (#103) means essentially every rep-1
  completer views the analysis; a gate everyone passes predicts nothing. It
  is the right *funnel step* (branch A) and the wrong activation event. There
  is also a product reason: rep 1 is deliberately framed as "Day 0… a number
  to beat" (#135). The product's own promise says the value moment is not
  rep 1's score — it is the first *delta*, which only exists at rep 2. The
  activation definition and the product's psychology now point at the same
  moment, which is what makes the metric honest.
- **First score improvement across reps** — rejected: it confuses behaviour
  with outcome. A user can return five straight days without beating their
  baseline yet — that user is *more* activated than anyone, and this
  definition would call them a failure. Improvement timing also isn't fully
  in the user's control (or ours), so it would make the activation number
  hostage to scoring calibration, which is still v1-guess territory by the
  decisions log's own admission (#100, star-threshold bucket). It lives in
  branch C as **first baseline-beat**, a value-delivery metric.
- **First supply word adopted** — rejected: strongest depth signal, far too
  late and too rare to be activation (requires the upgraded word to surface
  in a later transcript — days out, fuzzy to detect). Branch C keeps it as
  the gold end-to-end signal.

The chosen definition is also the one with external validation: Duolingo's
growth model treats day-2 return as the activation event, and their PM calls
the 1→2-day streak move "a huge jump in retention" [A] — already adopted by
the onboarding research pass (docs/onboarding-research.md §8). I am agreeing
with that colleague's conclusion and tightening it into event predicates.

Why 72h and not 24h: a strict next-calendar-day rule reads a Friday-first-rep,
Sunday-second-rep user as failed. The habit loop is daily, but *activation* is
"the product earned a second session" — 72h captures that while the different-
local-day clause keeps same-sitting doubles out. **This window is a
hypothesis** — see 2.4.

### 2.3 Sub-moments to instrument around the event (diagnostics, not the definition)

Each is a built surface with a decision behind it; each is a place activation
can leak, and the Data Analyst should be able to see which:

| Moment | Built by | What a leak here means |
|---|---|---|
| `/welcome` → "Take the floor" tap | #133 | intro leaks; three screens aren't paying rent |
| mic prompt shown → granted | #135 primer | the priming sentence isn't doing its 2–3× job |
| rep 1 recorded → scored | #55, #116 | engine/substance problem, not a growth problem |
| results walk → final screen | #103 | value is produced but not seen |
| when-plan tapped (morning/lunch/evening) | #136 | the d=0.65 lever going unused |
| soft wall shown → saved / "Not now" | #134 | durability leak; watch, don't panic — decline is designed to be safe |
| reminder fired → rep same local day | #136 | plan→action gap; the reminder is furniture |

### 2.4 Validation plan — WAITING ON DATA, do not act on this section

Activation definitions are only real once checked against the NSM. When the
first cohort matures: compute W2R for activated vs non-activated rep-1
completers. The definition earns its job if the gap is large and stable; tune
the window (24h/48h/72h) to whichever cut best separates W2R outcomes at
whatever N exists — directionally at beta scale, properly at hundreds. Until
then the definition above ships as written; it is a strong prior borrowed
from a named comparable, not a discovered fact. Kill criterion for the
definition itself: if activated users' W2R is not meaningfully higher than
non-activated users' (directionally, at ≥50 rep-1 completers), the definition
is decoration and gets rebuilt from whatever the data says actually predicts
return.

---

## 3. What I am explicitly NOT proposing (sequencing discipline)

- **No acquisition work** beyond branch E's trickle (founder-documented reps,
  mechanics.md's CAC≈0 play) sized to feed measurement, not growth. Channel
  strategy, launch posts, ASO, paid — all of it waits for the §4.3 gate. A
  leaky bucket isn't known to be leaky OR tight yet; finding out comes first.
- **No conversion/pricing experiments.** Everything is free (#96); the flip is
  a boolean that belongs to Timothy, not to a growth doc. What growth owes the
  flip is instrumentation (§5, note 3) so day-one-of-paywall has baselines.
- **No A/B tests.** At beta N, a 50-per-arm test detects only ~±14-point
  differences — anything subtler is astrology with dashboards. Pre-data, the
  toolkit is: big swings, sequential before/after cohorts, watching ten real
  sessions, and founder dogfood (vision.md: dogfood is the QA — the
  docs/dogfood.md 14-day table is, genuinely, the first retention study).

---

## 4. Experiment backlog — FRAMEWORK ONLY · WAITING ON DATA

**Do not act on this section as a backlog. A ranked experiment list with zero
users is a wish list dressed as strategy.** What follows is the template every
future experiment must be written in, the categories I expect to matter first,
and the data gate that unlocks real ranking.

### 4.1 The hypothesis template (mandatory format, no exceptions)

> We believe **[change]** will move **[metric — a named node of the §1.3
> tree]** by roughly **[magnitude — directional at beta N]** because
> **[psychological/structural mechanism — named, not vibes]**. We'll know
> within **[timeframe]** by **[measurement — event names from §2/§5]**.
> Kill criteria: **[the result that kills it]**.

House rules on top of the template:

- The metric must be a tree node. An experiment that can't find its branch is
  an experiment on a vanity metric; it doesn't run.
- The mechanism must be named (loss aversion, implementation intention,
  goal-gradient, endowment, variable anticipation…), same discipline the
  decisions log already applies (#43–52 all name theirs). "Users will like
  it" is not a mechanism.
- Kill criteria are written *before* the experiment starts, and a killed
  experiment gets a one-line entry in a growth log — the #118 precedent
  (publishing the refuted hypothesis, keeping the correction) applies to
  growth exactly as it applied to the engine.
- Nothing in the template overrides vision.md's refusals. An experiment that
  wins by manufactured insecurity, guilt, pay-to-win, or horoscope feedback
  is a failed experiment with a good conversion rate.

Scoring, when ranking unlocks: **ICE adjusted for our reality** — Impact
against the tree, Mechanism-strength standing in for Confidence (no Ethos
priors exist; a named mechanism with [A]-grade external evidence outranks a
clever guess), Ease in *founder-hours* against the **~15 h/week assumption**
(a 40-hour build is a month of capacity; at this stage Ease is frequently the
deciding term).

### 4.2 The four categories I expect to matter first, in priority order

Funnel-reverse order. Categories, not experiments — each names the tree
branch it serves, the leak it hunts, and example *shapes* (illustrative, unranked).

**Category 1 — Activation mechanics (branch A).** The `/welcome` → rep-2
corridor. Highest priority because every other number is downstream of it and
because the corridor is newly built (#133–137) and has never met a stranger.
Leak-hunting order matches §2.3's table top-to-bottom. Example shapes: welcome
screen count/copy; mic-primer sentence variants; prompt difficulty of lesson
1 vs substance-floor failures; the final-screen "Next lesson" framing (#105)
pointed at *tomorrow* rather than *more today* — the loop wants daily return,
not binge depth. **UNVALIDATED HYPOTHESIS** (voice-of-customer): "I recorded
myself once, cringed at my own voice, and never came back" — the voice-
confrontation barrier (onboarding-research §7) is the activation leak I most
expect and least trust us to see in event data alone; pair funnel numbers
with watching real first sessions.

**Category 2 — Habit scaffolding (branch B).** The rep-2 → day-14 corridor.
Reminders (#136), streak mechanics (#26/#38), the day counter (#93), fresh-
start framing (#51). Example shapes: when-plan chip uptake vs placement;
reminder copy in coach register; whether streak-3's second soft wall (#134)
lands or leaks; freeze grant timing (day 3 vs day 7 — already flagged as the
honest middle in onboarding-research §9.1, colliding with #38, so it enters
this category only as a Timothy-decision with data attached, never a quiet test).

**Category 3 — Value legibility (branch C).** Users can retain mechanically
(streak pressure) while the product's actual promise — visible progress —
goes unfelt; that retention decays the moment the mechanic loosens. Example
shapes: days-to-first-baseline-beat vs W2R; comparison-card surfacing (the
vision.md "core retention asset" — when does a user first SEE day-1-vs-day-N
without going looking); supply-adoption nudges on `/you` (lexicon flash, #63);
whether judged-tier coaching (vs measured-only reps) correlates with return —
which is also the first real demand data for the #75 meter.

**Category 4 — Durability & capture (branch D).** Soft-wall save rate, the
#137 standing line, email capture among retained users. Lowest of the four —
not unimportant, but its failure mode (losing measurable cohorts) damages the
*measurement* of growth before it damages growth. It rises sharply if
anonymous-user W2R can't be trusted because unsaved browsers vanish — and
#134 already names the first dial (a late hard wall) as a flagged
Timothy-decision if anonymous day-14 is terrible.

Not a category: acquisition. It gets a category the day the §4.3 gate opens,
and its first experiments should test the *artifact* (day-1-vs-day-N cards as
content — the vision.md dual-use asset), not channels for their own sake.

### 4.3 The data gate that unlocks a real ranked backlog

A ranked top-10 becomes legitimate — and the next Growth PM session should
write one — when ALL of:

1. **≥100 rep-1 completers** total (funnel rates stop being anecdotes);
2. **≥1 fully-matured W2R cohort of ≥50 rep-1 completers** (the NSM has a
   baseline, so "Impact" means something);
3. **≥10 recorded/observed first sessions or user conversations** (the leaks
   have faces; event data says where, humans say why);
4. **The dogfood table is full** (docs/dogfood.md — vision.md gates shipping
   wider on it, so growth inherits the gate; a loop that didn't hold user
   zero for 14 days has no business being optimised for strangers).

Until the gate: Category-1 leak-hunting on qualitative signal, dogfood, and
the funnel counts themselves. After the gate: rank with adjusted-ICE, run
sequentially, one change per cohort where possible.

---

## 5. Handoff notes to the Data Analyst (instrumentation this doc depends on)

1. **Event vocabulary** (names indicative; the analyst owns final naming):
   `welcome_viewed{screen}`, `rep_started{lesson_id, mode, rep_number}`,
   `mic_prompt{shown|granted|denied}`, `rep_completed{scored:bool,
   substance_pass:bool, local_day}`, `results_screen_viewed{step}` /
   `results_walk_completed`, `when_plan{slot}`, `notif_permission{granted}`,
   `reminder_fired` → next `rep_completed` same local day,
   `soft_wall{shown|saved|declined, trigger: rep1|streak3}`,
   `dimension_tapped{key}`, `supply_viewed` / `lexicon_saved`,
   `comparison_card_viewed`. Local-day derivation must reuse the #77
   clamped-offset rule — one calendar everywhere.
2. **Identity:** anonymous Supabase user id is the subject key; account save
   keeps the same id (#142), so no aliasing table is needed. Log entitlement
   state (`EVERYTHING_FREE` flag value) as an event property from day one —
   post-flip cohorts must be separable from free-era cohorts or the flip's
   effect is unmeasurable (this is the #96 rider: free-era retention data
   will NOT predict post-flip behaviour on gated surfaces; label the era).
3. **Privacy floor:** no transcript content, no audio, and no Presence frames
   in analytics events — metadata and counts only. The product's privacy
   posture (#70–74) is a stated selling point; analytics must not quietly
   undercut it.
4. **The first dashboard is the §1.3 tree with empty cells**, plus the §2.3
   funnel. Nothing else. A pre-launch dashboard with twenty charts is a
   twenty-way invitation to stare at noise.

---

## 6. Formal challenges to locked decisions

Raised per protocol: claim, evidence, settling test. Not applied; Timothy's
call.

### Challenge 1 — Weekly XP leagues at launch population (mechanics.md; DECISIONS #16)

**Claim:** shipping the ~20-user weekly league visible-by-default at
near-zero traffic will hurt, not help, W2R. A league of 2 is an empty room,
and an empty room tells every early user "this product is dead" — the highest-
cost message a retention surface can send during the exact weeks we're trying
to measure honest baseline retention.
**Evidence:** the decisions log's own reasoning — #89 killed clan wars
because "at launch it matches one user against silence." A 20-slot league at
single-digit WAU is the same silence with a scoreboard. Duolingo's leagues
work at a scale where every cohort of 20 fills in minutes; the mechanism
being stolen (social comparison pressure) requires population density we
won't have for months. #90 already deferred VS mode on identical logic.
**Test that settles it:** gate league *visibility* behind pool density — the
league surface renders only when a weekly pool of ≥15 rep-active users
exists; below threshold, show a personal weekly XP target in its place
(self-referenced, no dead room). When the threshold first trips, compare
league-exposed vs pre-league cohorts' W2R and B-branch metrics
(directionally at beta N). Cost of being wrong is near zero: the league
stays built (#16 untouched), only its render condition changes.

### Challenge 2 — Path runway vs the months-2–9 retention claim (mechanics.md "Retention lifecycle"; DECISIONS #141)

**Claim:** the content runway contradicts the retention model. mechanics.md
says months 2–9 are "the deep skill — the path is designed to span this,"
but #141 ships 29 lessons and honestly advertises "about 4 weeks." A daily
user exhausts the path right as W2R matures — so the product's stated
month-2+ retention story currently has no content spine, and the first
retained cohort will hit the wall together, precisely when they're most
valuable and most measurable.
**Evidence:** arithmetic (29 lessons ÷ 1/day ≈ 4.1 weeks); #141's own
end-of-road copy; mechanics.md's graduation-problem framing ("nobody
finishes a gym") — a gym whose program ends at week 4 is finished, which is
the exact framing failure it warns against. Boss modes and stress mods add
difficulty, not program; replaying for stars is real but is a loop, not a road.
**Test that settles it:** instrument `path_exhausted` (all 29 cleared) and
distance-to-end (≤7 lessons remaining); measure week-5/6 return of
exhausted vs non-exhausted users (directionally at beta N). Decision
trigger, stated now: when the first 5 real users come within 7 lessons of
the end, the next content unit is scheduled — **ASSUMPTION (~15 h/week):
that build is roughly a week of founder capacity, so the trigger must fire
a week before the wall, not at it.** If week-5 return holds fine on
replay + boss alone, I'm wrong and the road's honest ending was enough.

---

*End of role 1. Next roles: treat §1.3 as the metric contract and §2.1 as the
activation contract unless your role has evidence they're wrong — in which
case challenge them in writing, as I've done here.*
