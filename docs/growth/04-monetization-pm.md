# 04 — Monetization PM: The Map, The Screen, The Price, The Flip

**Role:** Monetization PM (consumer subscription; paywalls shipped, upgrade-moments school) · **Date:** 2026-08-12
**Mandate:** Design what the paywall is when `EVERYTHING_FREE` turns false, and what evidence earns the turn — nothing here monetizes anyone tonight.

---

## 0. Operating stance and stage facts

- **Nothing in this document is live.** DECISIONS #96: everything is free behind
  one constant (`lib/entitlement.ts`, verified — `EVERYTHING_FREE = true`,
  `profiles.premium` still read underneath). This whole document is
  design-for-the-flip. The flip itself is one boolean plus a Stripe webhook
  (open queue), and it belongs to Timothy, not to this doc (adopting 01 §3).
- Two decisions are locked and I build on them, not around them:
  **paywall-after-value** (#11: after the day-3 progress card, never a
  quiz-wall) and **the chess.com model** — the free tier stays genuinely
  useful forever, capped only by #75's judged-tier meter (1 deep read/day,
  rollover banked to 3; reps, measured metrics, transcript, live ring
  unlimited; streaks count reps, not analyses, #76).
- I adopt 01's metric contract (W2R north star, activation §2.1) and 02's
  event vocabulary verbatim. 02's paywall guardrail row is my binding rule,
  stated as my own: **a design that converts more but retains less is a loss,
  and gets written into the growth log as a loss.**
- Pre-launch, zero users, zero revenue data. Every conversion or price claim
  below is a named-comparable benchmark or a labelled assumption — never an
  Ethos result. Any voice-of-customer line is **UNVALIDATED HYPOTHESIS**.
- **ASSUMPTION (intake unfilled): ~15 focused founder-hours/week.**
- **ASSUMPTION (intake unfilled): soft launch / public beta within ~4–6 weeks.**
- Market: AU-first, AUD pricing; product serves global English speakers.
- Where I disagree with a locked decision, §9 raises it formally.

### 0.1 The one-paragraph theory of this paywall

Ethos's free tier is not a demo; it is the funnel, the community, and the
habit. The paid tier sells **depth on a habit that already exists**: more
coaching per day (deep reads), the archive of your own past (log, lexicon,
comparison cards), the readout of what the camera measured (Presence, #73),
and the library behind the weekly boss (#36). Every upgrade moment is timed
to **peak motivation — immediately after felt progress** (Duolingo shows its
offer after a completed lesson, never before one), and urgency only ever
comes from the user's own numbers and goals, never from our timers. The
brand is comfort + command; a hard sell is off-brand and, worse, off-model —
this product's LTV lives in month 4, not day 4.

---

## 1. The monetization map — every surface where free meets premium

Overview first, detail per surface after. "Framing" specifies both the loss
and gain variants because framing is testable later (§6 E1); the listed
primary is my prior, not a result.

| # | Surface | Trigger moment | Emotional state (hypothesis) | Primary framing | Mis-design to avoid |
|---|---|---|---|---|---|
| a | 2nd deep read of the day (#75) | Rep 2+ scored, judged tier absent | Momentum; came back same day — our best user | **Loss** — "keep today's coaching going" | A wall instead of results; fake blurred judged scores |
| b | Presence readout (#73) | Voice+video rep ends; live ring worked free | Curiosity + mild self-exposure (just on camera) | **Gain** — curiosity gap; nothing was taken | Padlock on the toggle; interrupting the rep |
| c | Streak-freeze scarcity (#38/#126) | Streak at risk, freeze count low | Anxiety about loss | **NO MONEY SURFACE — ever** | Duolingo-style streak-repair IAP; any sheet here |
| d | Log day-8+ / lexicon 4th entry (#31/#17) | Scrolling own history; rows age out of the 7-day window | Reflective ownership; pride in the pile | **Loss (honest)** — their past is held, not deleted | Deleting data; blurred fake rows; countdown |
| e | Boss library (#36) | Weekly Cold Topic done; wants another / wants Debate | Appetite after a win — peak motivation | **Gain** — "any topic, any time" | Locking the weekly free run; a grid of padlocks |
| f | The free-forever list (§1.6) | — | — | Never gated | Gating any of it |

### 1.1 (a) The second deep read — the core meter, and the core moment

**What the free user sees, post-flip.** Their rep is stored, measured,
transcribed, and walked exactly as always (#75/#76 — a capped rep still
returns everything deterministic). Where the judged tier would render, one
calm card: today's deep read is spent, tomorrow's arrives at midnight, and
banked reads (up to 3) are shown as held objects, not debts. Beneath it, one
quiet line that opens the paywall sheet. Adopting 03 §3.2 wholesale: the
allowance renders on the pre-rep anticipation surface (#48) as an asset
("1 deep read ready"), and on a second-plus rep of the day the user **aims**
the spend with one tap — a cap you aim is a tool; a cap that auto-drains is
a tax. No meter UI renders in the free era (03's rule; a gauge on an
unmetered good teaches people to see a wall that isn't there).

**Why this is the #1 surface.** The person who hits it did two reps in one
day. That is the single strongest demand signal the product can emit, and it
arrives at Duolingo's peak-motivation timing — right after completed work.
The mis-design is treating that person as a wallet instead of a fan:
replacing their results with a wall (violates #75 — the rep must always
return something), or rendering fake blurred judged scores (fabrication-
adjacent; the no-horoscope product cannot show pretend numbers anywhere).

**Framing pair for role 5.** Loss: the coaching continues — direction:
"Keep today's coaching going," never "you've run out." Gain variant for
testing: unlimited deep reads as capability. What the moment must never
say: anything that frames the free read as a downgrade — it is the product,
permanently, per the chess.com model.

### 1.2 (b) The Presence readout — sell the readout, never the mirror

**What the free user sees.** Per #73 the split is on the cost line: the live
ring and skeleton work free, forever, in-rep. At results, the Index renders
in full; in the Presence slot, an honest card: this rep's Presence was
measured on-device; the readout — score /1000, timestamped moments, the
week-over-week trendline, playback markers — is Pro. No number shown, no
number faked.

**Emotional state.** Curiosity with a flush of self-exposure: they were just
on camera and the app visibly watched (ring moved, skeleton tracked). The
open question "what did it see?" is the sale. This is the one surface where
**gain framing wins by default** — nothing was taken from them, so loss copy
would ring false. Direction: "See what the camera measured."

**Mis-designs.** A premium badge on the Voice/Voice+Video toggle (violates
#68 — the toggle is unbadged and mainline); a blurred or spinning fake score
(a measurement product faking a measurement); asking for camera permission
inside an upsell (permission asks live at moment-of-use, #68/#135). Also:
never gate the *privacy* claim — "video never leaves your device" (#70–74)
is stated to everyone, always; it is why the free ring exists.

### 1.3 (c) Streak scarcity — the surface we refuse to monetize

Locked and correct: money never buys streaks or freezes (#14, #38, #126).
Coins can buy a freeze (14 coins = two weeks of speaking — a slower route,
not a shortcut). So the design rule, stated flat: **no paywall sheet, Pro
line, or offer of any kind renders on any streak-risk surface** — not the
at-risk banner, not the streak-lost morning, not the freeze card in the
shop. The emotional state there is loss-anxiety about something the user
built; selling into it is the Duolingo streak-repair pattern, it is guilt-
adjacent, and on this brand it would cost more trust than it earns revenue.

The monetization value of the streak is indirect and larger: streaks build
the month-4 user, and the month-4 user is who annual plans are for. That is
LTV logic beating grab logic, and it's the whole reason the chess.com model
was chosen.

**Mis-design to avoid, named for the record:** "Your streak ends in 3 hours
— go Pro to protect it" is the single worst screen this product could ever
ship. It breaks #14, #26, and the brand in one tap.

### 1.4 (d) The archive — your own past as the upgrade

**What the free user sees, post-flip.** The log shows the last 7 days in
full (#31). Older rows are neither deleted nor faked: one honest line —
true counts, real dates — says how many recordings are held and how far
back the first one goes. Same pattern for the lexicon beyond its free
entries and for day-1-vs-day-N comparison cards (#17). The upgrade is
**retroactive**: going Pro reveals everything you already did. That makes
this the strongest *annual* argument in the product — an archive is a
long-horizon good, and the person who wants their day-1 rep back is
already thinking in months.

**Emotional state.** Reflective ownership — a day-8+ user scrolling their
own pile. Loss framing is honest here because the thing at stake really is
theirs; the copy direction is possession, not punishment: "Your first rep
is still here." Never "you lost access" — they didn't; we hold it for them.

**Mis-designs.** Deleting old data (irreversible, kills the retroactive
upgrade, reads as theft); blurred fake rows; any countdown ("your history
disappears in 3 days" — manufactured urgency on a false claim). And the big
one, which gets its own flip-day rider in §3: hiding history that free-era
users have already seen.

### 1.5 (e) The boss library — depth behind the weekly appointment

**What the free user sees.** This week's Cold Topic, free, once (#36) —
the appointment stands and 03's countdown-chip suggestion strengthens it.
After the run (or on a mid-week return visit wanting more), the library:
any topic, any time, plus Debate and Hostile Q&A when they exist. Real
topic names visible in the library list — a library of padlocks is a dead
room; a library of titles is a shelf you want.

**Emotional state.** Appetite after a win. Boss runs end big (multiplier,
fanfare); the "another one" impulse right after is genuine peak-motivation.
Gain framing: more of the thing you just enjoyed. **Mis-designs:** gating
the weekly free run (violates #36 — "a locked button nobody can press is
not a monetisation strategy"); upselling before the user's first boss
experience (nothing felt yet = quiz-wall energy); framing the library as
catching up ("you're behind on topics" — guilt mechanic).

### 1.6 (f) Deliberately never gated — the free-forever list

Printed as a list because every future paywall discussion should have to
argue against it explicitly:

- **The rep, measured metrics, transcript, pause bar, live ring** — #75/#73.
  The habit itself is free or there is no funnel.
- **The first deep read of every day** — the daily taste of the deepest
  value is what renews desire (chess.com's free daily review). Gate it and
  the product becomes a meter with a mascot.
- **Streaks, freezes, the day counter** — §1.3. Never for money.
- **The full 29-lesson path** — #141's own test asserts every gate is
  affordable from daily units. The road is the retention spine; a paywalled
  road is a toll booth in a gym.
- **The daily supply word** — the swap itself stays free (#31 gates the
  archive, not the day's coaching). It is the most-praised pattern in the
  category (Wellspoken teardown) and it feeds the Callback loop (03 §4).
- **Coins and the shop** — coins are earned by speaking and money never
  buys them (#78, #125). The shop is engagement plumbing, not revenue.
- **XP, levels, leagues** — #16, plus 03's Challenge A (endorsed, §8):
  league rank must not even be *indirectly* purchasable.
- **The day-3 progress card itself** — the aha is felt free before any
  gate, ever. The card sells the paywall; the paywall never sells the card.
- **When-plan reminders, settings, auth, hello@ replies** — habit and trust
  infrastructure. Monetizing trust surfaces is how you stop having them.

---

## 2. What the paywall must never do (binding rules, before the screen)

1. **Never gate the first-analysis aha** — rep 1's full results, including
   its judged tier, render free forever. (It costs one LLM call to make a
   customer; it costs the whole funnel to save it.)
2. **Never render proactively before the day-3 card** (#11). Before day 3,
   cap moments show meter state only — informational, no sheet. From day 3,
   the sheet may attach to cap moments and deliberate taps on Pro surfaces.
3. **Never appear on streak-risk surfaces** (§1.3).
4. **Never interrupt a rep, a results walk mid-screen, or a celebration**
   (#34, #103). The sheet lives after value, structurally.
5. **Never fake a locked number** — no blurred scores, no sample data
   dressed as theirs. Locked surfaces state what exists and what Pro shows.
6. **Never use manufactured urgency** — no countdowns, no "only today," no
   expiring discounts. Urgency is the user's own delta and their own goal.
7. **Never weaken the free tier to make Pro look better.** Any proposal
   that moves an item off §1.6 must beat this document in writing first.

---

## 3. Flip-day riders — rulings Timothy must make before the boolean turns

These are not challenges (nothing here contradicts a locked decision); they
are collisions and ambiguities that the flip exposes, logged now so
flip-day finds them.

1. **The Strava clause — grandfather free-era history.** Users who join in
   the free era will have *seen* their full archive, full lexicon, full
   judged history. Flipping and hiding what they've already seen is the
   Strava-2020 pattern (retroactively gating users' own past data produced
   their worst-ever backlash). Recommendation: accounts created pre-flip
   keep visibility of all pre-flip data forever; the 7-day window applies
   to post-flip recordings only. Cheap (a `created_at` comparison), and it
   converts the flip from a taking into a change of terms going forward.
   Pairs naturally with a founding-member annual offer (§6 E4).
2. **"Full pause analytics" is stale wording.** #31 (9 Aug) lists premium
   "full pause analytics"; #75 (11 Aug, later — later entries amend
   earlier) makes all measured metrics free and unlimited, and Pause is a
   measured dimension. My reading, for confirmation: the pause score,
   verdicts, and pause bar are free on every rep; what Pro sells is
   **per-dimension history and trendlines** (mechanics.md display rules:
   "Premium: full eight + history per dimension"). `Paywall.tsx`'s first
   bullet needs this rewrite (§4.3).
3. **Stress mods: premium unlock vs coin consumable.** mechanics.md's
   premium list says "stress mods unlocked for purchase"; 03 §3.3 proposes
   them as the coin economy's recurring sink (endorsed — it is the best
   sink candidate precisely because it sells challenge). These conflict at
   the flip. My monetization read: give mods to the coin economy. Pro does
   not need them (it has deep reads, Presence, archive, boss library), and
   the coin economy desperately does (03's arithmetic: catalogue exhausted
   in ~6 weeks). Timothy's ruling either way.
4. **Retries appear on both lists.** mechanics.md names "unlimited retries"
   under Premium *and* "lesson retries" under Shop. Same ruling needed;
   same recommendation and reason as rider 3 — feed the coin economy.
5. **Sequencing debts owed to 02:** `reps.scorable`/`reps.judged` (their
   §1.4 fix 1) must ship before the flip — the null-ambiguity cannot be
   backfilled; dormant `paywall_viewed`/`paywall_hit` events go live
   *before* the flip so day one has a denominator; `entitlement_era`
   labels every cohort (their §4 item 8).
6. **03's Challenge A becomes visible at flip** — XP multipliers on Pro
   surfaces make league rank quietly purchasable. Endorsed here from the
   monetization side: the cheapest reputational risk to remove pre-flip
   (one `base_amount` column now). Our 16–28 persona was raised on F2P and
   will name pay-to-win's little sibling on sight.

---

## 4. The paywall screen spec

`components/Paywall.tsx` exists and I read it. It is directionally right —
bottom sheet, annual anchored, one terracotta CTA, the no-pay-to-win footer
— and its content is one era stale. Spec first, divergence audit after.

### 4.1 Placement and entry modes

- **Proactive (once):** immediately after the day-3 progress card, as its
  own screen following the card — the card is seen in full first, always.
  Shown once. Declining is quiet and final; the sheet never proactively
  re-appears. (Peak-motivation timing: the user has just seen three days
  of their own numbers move — the product's promise, delivered, free.)
- **Reactive (always available):** on deliberate tap into any Pro surface
  (§1's map: spent-meter line, Presence card, archive line, boss library),
  and via one quiet "Ethos Pro" row in settings/you. Reactive entry
  carries the surface's context into the sheet's reason line.
- **Never:** at install, at signup, mid-rep, mid-walk, on streak surfaces,
  or as an interstitial between screens. And never a quiz before it (#11).

### 4.2 Anatomy (top to bottom)

1. **Reason line** — dynamic, names the surface that opened it (the
   existing `reason` prop is right). Coach register, user's own numbers
   where possible.
2. **Headline** — role 5 writes final copy; framing direction: name what
   *continues or deepens*, anchored to the user's own data. Directions per
   entry: day-3 proactive — "Three days of numbers. Keep all of them.";
   cap moment — "Keep today's coaching going."; archive — "Your first rep
   is still here."; Presence — "See what the camera measured." What the
   headline is never about: what the user lacks. The gap is theirs; the
   reps are ours (brand.md).
3. **What Pro is** — four to five lines, ordered by expected demand
   (deep reads first), each naming a concrete thing, no adjectives:
   - Unlimited deep reads — the judged tier on every rep (vs 1/day free)
   - Presence readout on video reps — score, moments, trendline, markers
   - Your whole history — every rep, day-1-vs-day-N cards, per-dimension
     trendlines
   - Your whole lexicon — every swap you've earned (pending §9 M1)
   - Boss library — any Cold Topic any time; Debate and Hostile Q&A
     (list mods/retries only after §3 riders 3–4 are ruled)
4. **Plans** — annual card first, bordered, selected by default; monthly
   beneath, visually quieter. The annual card leads with the per-month
   figure (the persuasion number), with "billed A$79.99 today" adjacent in
   plain sight — the honest total next to the persuasive rate, both
   always. Savings badge stated as a percentage.
5. **One terracotta CTA** — "Start with annual" (switches to the selected
   plan's verb if monthly is tapped). One orange per screen holds even
   here — the plan cards themselves never go terracotta.
6. **Quiet decline** — "Not yet", plain text, no guilt, no shrinking
   button, no "No thanks, I don't want to improve" dark-pattern decline.
7. **Footer** — keep the shipped line verbatim: "Money never buys stars,
   streaks, or scores." It is the most differentiated sentence on the
   screen and the brand's spine restated at the moment of purchase. Add:
   restore-purchases link, terms/cancel-anytime line (AU consumer law
   friendliness is on-brand; also simply required).

**What NOT to say, anywhere on this sheet:** the banned lexicon (brand.md +
#87 — the S-dimension is "Steadiness" if named); "trusted by thousands"
(false at our N — and fake social proof stays banned at every N);
countdowns or expiring prices (§2.6); anything about the user's streak;
"cancel anytime" buried — say it plainly instead; comparisons to named
competitors (positioning is format, not feature war, #85).

**No time-limited free trial at launch.** The free tier *is* the permanent
trial — that is the chess.com model's whole point. A 7-day everything-trial
would also teach new users the metered surfaces are temporary perks rather
than the paid tier, muddying the meter's appointment mechanics (03 §3.2).
Revisit as an experiment only after E1–E3 have data.

### 4.3 Divergence audit — `Paywall.tsx` as built vs this spec

| As built today | Status vs current decisions | Fix before flip |
|---|---|---|
| "Full pause analytics — the silence scores" | Stale vs #75 (measured tier free) — §3 rider 2 | Rewrite: per-dimension history/trendlines |
| No deep-reads line | Missing the #1 Pro good (#75 is the core cap) | Add as first bullet |
| No Presence line | Missing #73's headline Pro feature | Add |
| "Stress mods and unlimited retries" | Both pending §3 riders 3–4 | Hold until ruled |
| "Boss modes: Cold Topic, Debate, Hostile Q&A" | Slightly stale vs #36 (free gets weekly Cold Topic) | Rewrite as library framing |
| Annual anchored, A$6.67/mo displayed, save 55% | Correct pattern | Keep |
| One terracotta CTA, quiet "Not yet", no-pay-to-win footer | Correct | Keep |
| Both plan taps just `onClose` | No processor (open queue) — fine in free era | Stripe checkout at flip |
| No restore/terms links | Required at flip | Add |

---

## 5. Pricing structure

### 5.1 Comparable landscape (checked tonight; re-verify from an AU device at flip)

Web-sourced, approximate, and labelled as such — app-store prices vary by
region and change quietly. This satisfies the "sanity-check" brief; the
open-queue "pricing research pass" item should still be closed with an
in-store check at flip time.

| Product | Monthly | Annual | Notes |
|---|---|---|---|
| Duolingo Super (US) | ~US$12.99 | ~US$83.99 | AU family plan reported ~A$174.99/yr; AU individual unverified — check in-store ([geopriced](https://geopriced.com/cost/duolingo-super), [papora](https://www.papora.com/learn-english/super-duolingo-prices/)) |
| Elevate Pro | ~US$9.99 | ~US$39.99–74.99 (sources disagree; verify) | Free tier is 3 games/day — a real free tier, like ours ([apps.apple.com](https://apps.apple.com/us/app/elevate-brain-training-games/id875063456), [aeanet](https://www.aeanet.org/how-much-is-elevate-app/)) |
| Yoodli | Pro ~US$8/mo (annual-billed, 10 sessions/wk); Advanced ~US$20/mo (unlimited) | no monthly billing published | The funded rehearsal tool, #85 — session-metered like our deep reads ([yoodli.ai/pricing](https://yoodli.ai/pricing), [deelan](https://deelan.ai/resources/yoodli-pricing-2026)) |
| chess.com (model reference) | tiers ~US$5–14/mo annual-billed | — | Free tier genuinely useful forever; the model #75 copies |
| Speech coach (human) | ~A$150/hr | — | vision.md's stated alternative — the value anchor |

AUD divergence notes: AU app-store prices typically land near the US number
×1.4–1.6 with GST baked in, so a A$14.99 monthly is *cheaper in real terms*
than Duolingo's US monthly — appropriate for an unknown brand entering
against known ones. AU-first also means prices should be set in AUD app-store
tiers from day one, not converted later (re-pricing existing subscribers is
pain forever).

### 5.2 Three candidate price points

| Candidate | Monthly | Annual (per-month display) | Reasoning | Risk |
|---|---|---|---|---|
| **A — Penetration** | A$9.99 | A$59.99 (A$5.00/mo) | Undercuts everything; frictionless for the 16–28 persona's student wing; maximizes paid *population* for community/league health | Anchors Ethos as "an app" not "a coach"; thin unit economics leave no CAC room ever; raising later is hard, and discounting from here is impossible |
| **B — Placeholder-parity (recommended at flip)** | A$14.99 | A$79.99 (A$6.67/mo) | mechanics.md's placeholder, and it survives the comparables check: monthly at Duolingo-parity, annual undercutting Duolingo annual while sitting above Elevate; ~55% annual saving is a strong push without bargain-bin signalling | Mid prices convert neither on cheapness nor on prestige; must be sold on specific goods (deep reads, Presence) — which §4's sheet does |
| **C — Coach-anchored** | A$19.99 | A$119.99 (A$10.00/mo) | Anchors against Yoodli Advanced (~US$20≈A$30) and the A$150/hr human alternative, not against game apps; the "one hour of human coaching = 12 months of Ethos" line writes itself | The persona skews young and price-aware; premium price wants Presence + full boss suite *felt* as pro-grade, which needs Debate/Hostile Q&A built |
| ~~Lifetime~~ | — | — | **Deliberately absent.** Lifetime caps LTV on exactly the long-retention users the model depends on, and it monetises belief instead of habit | — |

**Recommendation:** flip at **B**. Then, per §6 E4's cohort logic, the first
price *test* is upward (B vs C on sequential cohorts) — never downward:
moving down later is trivially easy and universally welcomed; moving up
requires grandfathering and apology. A launched at A would foreclose C
forever. **WAITING ON DATA** — this recommendation is a prior from
comparables, not a measured willingness-to-pay; the §6 experiments and the
open-queue research pass settle it.

### 5.3 Anchoring mechanics

- **Annual anchors monthly; the displayed per-month price of annual does
  the persuasion work.** A$6.67/mo next to A$14.99/mo makes annual the
  obvious deal without a single adjective. Monthly's commercial job is to
  make annual look right — it is priced to be reasonable, not to be chosen.
- The honest total ("billed A$79.99 today") sits beside the per-month rate,
  always (§4.2.4). Persuasion by arithmetic, never by concealment — the
  brand cites numbers; so does its checkout.
- **No decoy third tier.** A fake middle plan built to be unchosen is a
  manipulation our copy rules can't survive. A real higher tier can exist
  someday only when a real distinct feature class exists (it doesn't yet).
- **No weekly plan.** Weekly pricing is the hard-sell/churn-farm pattern
  (rife in scanner-app land); one glance at it teaches users to distrust
  the whole sheet.

### 5.4 Offer laddering — discounts are a last resort, not a habit

Reflexive discounting trains users to wait for sales and tells them the
sticker price was fiction. Sanctioned offers, exhaustively:

1. **Founding-member annual, once, at flip** (§6 E4): free-era users get a
   one-time thank-you price on annual. Honest occasion, honest copy, never
   repeated, never extended. This is reciprocity, not a sale.
2. **Student pricing, maybe, later** — a standing verified-eligibility
   price (Duolingo/Spotify pattern) is a segment price, not a discount;
   fits the persona. Post-flip decision, needs verification tooling.
3. **Win-back after ≥60 days lapsed** — one offer, once per lapse, quiet
   email (#83's hello@ tone). Last resort by definition.

Banned forever: exit-intent discounts, decline-triggered "wait! 80% off"
sheets, recurring seasonal sales, price-slashing countdown banners. If the
sheet's decline button trains a discount reflex, every future full-price
customer was overcharged by our own admission.

---

## 6. Five candidate monetization experiments

**All WAITING ON DATA — none run tonight, none run pre-flip, and none run
before 01 §4.3's data gate.** Presented with mechanism and kill criteria as
candidates, not a revenue-ranked backlog — expected impact at zero users
would be fiction. All use 01 §4.1's template; all inherit 02's paywall
guardrail row (exposed-cohort W2R, days-spoken, streak survival through
`paywall_hit`, soft-wall save rate); at beta N, sequential cohorts, never
50-user A/B astrology (02 §4.1).

**E1 — Cap-moment framing: loss vs gain.** We believe loss framing ("Keep
today's coaching going") will outconvert gain framing ("Unlimited deep
reads") at the spent-meter moment, because loss aversion binds hardest to
value just experienced. Measure `paywall_viewed{surface: judged_meter}` →
`upgrade_started` by framing cohort. **Kill:** no directional difference
after ~100 sheet views per variant; or the loss variant's exposed-cohort
W2R/days-spoken dips below the gain cohort's — a framing that converts by
souring the capped experience is a loss (the LTV rule).

**E2 — Aimed deep read vs auto-spend** (03 §3.2's chooser, adopted).
We believe letting multi-rep users aim the day's deep read will raise
pre-reset return and lower cap resentment, because choice converts a limit
into a tool (chess.com's aimed daily review; agency + endowment). Measure
`deep_read_aimed` rate, pre-reset return, `paywall_hit` sentiment proxy
(follow-on rep rate after a hit). **Kill:** aim-prompt drops results-walk
completion (02's walk events), or <20% of eligible users ever aim — then
the chooser is friction cosplaying as agency; revert to auto-spend.

**E3 — Plan presentation: annual-first vs equal weight.** We believe the
annual-bordered default (as built) beats symmetric presentation on annual
share *without* raising early refunds, because anchoring does the work
honest copy can't. Measure plan mix, 30-day refund/cancel rate by cohort.
**Kill:** annual share rises but 30-day refunds/cancels rise with it —
that's regret harvesting, not conversion; grab logic loses to LTV logic.

**E4 — Founding-member annual at the flip.** We believe a one-time honest
thank-you price to free-era users (paired with §3 rider 1's grandfathering)
converts the most-retained cohort at their peak goodwill, because
reciprocity plus fair-dealing at a change of terms is the one discount that
strengthens rather than cheapens the price. Measure uptake among eligible,
12-month retention of founding vs later annual cohorts. **Kill:** uptake
<5% of eligible actives (complexity not worth it), or any sign the offer
gets read as a recurring sale (e.g. later cohorts delaying purchase —
watch time-to-upgrade drift), in which case it never repeats anyway — by
design it can't.

**E5 — One-time Presence readout sample (requires amending #73 — Timothy's
call, raised as §9 M3).** We believe showing each user their *first* video
rep's full Presence readout once, free, will raise video adoption and
Presence-surface conversion, because paywall-after-value is this product's
own doctrine — the readout's aha is currently never felt before the gate,
which is exactly the pattern #73's free ring was designed to avoid one
layer down. Measure video-rep adoption, `paywall_viewed{surface:
presence_readout}` → upgrade, sample-cohort vs control. **Kill:** adoption
and conversion unchanged (sample adds cost, no signal), or conversion
*falls* (the taste satisfies instead of selling — possible, since unlike
deep reads Presence has no daily renewal pulling users back to the gate).

---

## 7. What evidence turns the boolean — the flip checklist

The flip is Timothy's call. This is the evidence and readiness bar I'd hold
it to, so the call is made once, on purpose, with baselines that exist.

**Readiness (all required):**
1. 01 §4.3's data gate met — ≥100 rep-1 completers, one matured W2R cohort
   ≥50, ≥10 observed sessions, dogfood table full.
2. **W2R baseline recorded across ≥2 matured cohorts** — the pre-flip
   cohorts are the permanent control group; flip before a baseline exists
   and the flip's cost can never be measured (01's #96 rider).
3. 02 §1.4 fix 1 shipped (`reps.scorable`/`reps.judged`) — explicitly
   sequenced pre-flip; unfixable retroactively.
4. Dormant events live in production (`paywall_viewed`, `paywall_hit`),
   plus one addendum to 02's enum: `surface: day3_card` for the proactive
   show (§8).
5. Stripe wired end-to-end (webhook sets `profiles.premium`; open queue).
6. §4.3's divergence list fixed; §3's riders ruled by Timothy.
7. Demand signal read from the free era: judged-read views/day per user,
   archive scroll-backs, boss library taps (02's branch-C events) — the
   free-era usage curve is the only pre-flip evidence of which gates will
   bite and roughly how often the 1/day meter would have been hit.

**Timing signal (judgment, not gate):** flip when W2R is *stable or
rising* across consecutive cohorts — a paywall dropped into an unretained
product converts almost no one and contaminates the baseline while doing
it. Do not flip because money feels overdue; at these price points the
first hundred users' revenue rounds to a coffee budget, and what they're
actually worth is clean data and word of mouth.

**Post-flip watch (first 4 weeks):** exposed-cohort W2R vs pre-flip
baseline (the loss condition of record, 02's guardrail row), `paywall_hit`
frequency vs capped users' return, soft-wall save rate, refund rate. A
conversion number with a sagging W2R under it triggers rollback discussion,
not celebration — the boolean turns both ways.

---

## 8. Colleague documents — adopted and critiqued

**01 (Growth PM).** Adopted: W2R and the tree as the metric contract; the
no-conversion-work-pre-flip stance; the #96 era-labelling rider (it is why
§7.2 exists). One extension, not a disagreement: branch D's email capture
matters double for monetization — receipts, renewal notices, and §5.4's
win-back all require an owned channel; an anonymous Pro subscriber is a
contradiction the checkout resolves for us, but the *near*-subscriber who
declined the soft wall is reachable only if D-branch capture works.

**02 (Data Analyst).** Adopted: the event vocabulary including both dormant
paywall events with their surface enum; the guardrail table's paywall row
as this document's binding loss condition; the small-n banner over every
number-shaped claim here. Two addenda requested, per their no-parallel-
vocabulary rule: (a) add `day3_card` to the `paywall_viewed` surface enum —
the proactive show is a different animal from every reactive surface and
must be separable on day one; (b) `upgrade_completed` should carry
`offer: none|founding|winback` so §5.4's laddering discipline is auditable
in the data — a discount that can't be counted becomes a habit invisibly.

**03 (Behavioral Designer).** Adopted wholesale: the chess.com meter
teardown and the aimed-spend chooser (§1.1, E2); the no-meter-UI-in-free-era
rule; the coin-sink arithmetic (which powers §3 riders 3–4); Challenge A
(endorsed at §3 rider 6 — from the monetization chair, pay-to-win adjacency
is a *pricing* risk: it gives every skeptical prospect a reason to distrust
the honest sheet). One critique: their §3.3 expects the streak freeze to be
a "middle-band sink only" — post-flip, I'd go further: freeze purchases are
a *signal*, not a sink. A user buying freezes with coins is telling us
their schedule outruns their streak; that user is the archive/annual
prospect (long-horizon self-image), and the shop should never know or care,
but the §6 experiment designs can use the signal for timing reactive
surfaces. Logged as a hypothesis for the data era, not a build.

---

## 9. Formal challenges to locked decisions

Per protocol: claim, evidence, settling test. Not applied; Timothy's call.

### Challenge M1 — The 3-entry free lexicon cap gates the wrong layer (#31)

**Claim:** capping free users at 3 *stored* lexicon entries damages the
product's best retention loop more than it earns in upgrades. The lexicon
is the Hooked investment step's only uncopyable deposit (03 §1) and the
Callback loop's raw material (03 §4); a 3-entry cap means a free user's
deposits stop accruing in week one, so the loop that makes *tomorrow's rep
more valuable* goes dead for exactly the population that is the funnel.
**Evidence:** #73's own principle cuts the other way on this surface —
split on the *cost* line, not the feature line; storing a text row costs
nothing (the LLM call that generated the swap was already spent under
#75's meter). Wellspoken's supply layer is the category's most-praised
feature (mechanics.md) — ours would be the one that forgets your words
after three. And these are words from the user's own mouth: "we hold 3 of
your 19 words hostage" is a resentment surface, not an upgrade surface.
**Proposed amendment:** all entries accrue for everyone (storage free);
free tier sees the most recent 3 and true counts of the rest ("19 words
earned · showing 3"); Pro opens the archive, the flash drill over the full
set, and lexicon history — same retroactive-unlock mechanic as §1.4, which
is *stronger* the bigger the held set grows. Callback detection (03 §4, if
adopted) runs against the full set for everyone — the app noticing your
word must never be premium, or the detection's absence reads as the app
failing.
**Test that settles it:** post-flip, cohort-compare free users' supply
adoption (the branch-C gold signal: offered→spoken rate) and W2R under
cap-storage vs cap-view. Pre-flip cost of my version: nil — storage
already accrues in the free era; this only changes what the flip gates.

### Challenge M2 — Comparison cards fully premium starves the CAC≈0 engine (#17, #31)

**Claim:** gating all day-1-vs-day-N comparison cards behind Pro contradicts
the acquisition model. vision.md: "Day 1 vs day 30 comparison is the core
retention asset and the core marketing asset. Same artifact." mechanics.md's
business math explicitly depends on CAC≈0 via shared artifacts; 01's branch
E names the comparison card the first acquisition test. If only paying
users can see (and therefore share) the artifact, the growth loop runs on
the ~few-% paying minority — the free ~95% generate zero spread on the one
asset built to spread. (The few-%/95% split is an assumption at typical
freemium conversion rates, not an Ethos number — none exists.)
**Evidence:** the citations above, plus `share_card_created` already
existing in 02's plan as "the only acquisition event that exists pre-gate"
— an event whose denominator #17 would shrink to the paid tier.
**Proposed amendment:** free users get comparison cards at temporal
milestones — day 7 (already inside the free 7-day window, so arguably
compliant as-is), day 30, day 100 — auto-offered at the milestone (03 §2
flags the missing reveal moment; #51's landmark framing fits), shareable.
Pro keeps arbitrary any-day-vs-any-day comparisons and the full archive
behind them. The milestone card is the ad; the archive is the product.
**Test that settles it:** post-flip, `comparison_card_viewed` and
`share_card_created` rates for free milestone cards, and whether shared
cards produce measurable branch-E arrivals (link-tagged). If free users
don't share them either, #17 stands as written and the amendment dies.

### Challenge M3 — One first-taste Presence readout (#73; carried by E5)

**Claim:** #73 gives Pro the entire Presence readout with no felt taste of
it; the product's own paywall-after-value doctrine (#11's principle, #73's
own free-ring logic) argues each user should see their first video rep's
readout once, free. **Evidence:** the free tier's aha (measured metrics,
first deep read) is felt before every gate by design; Presence is the sole
Pro good sold entirely on description. Duolingo's timing law again: desire
peaks after felt value, and no Presence value is ever felt. **Test:** E5
as specced (§6), including its honest kill criterion — if the taste
satisfies instead of selling, #73 stands and the sample dies. Raised as a
challenge because even the experiment requires amending #73's line; not
run, not assumed, Timothy's call.

---

*End of role 4. Next roles: §4.2's headline directions are framing briefs,
not copy — role 5 owns the words, inside brand.md's bans (#87 included);
§6's experiments are candidates, not a ranking; §7 is the checklist any
future "should we flip it?" conversation starts from; and §9 is unapplied
until Timothy rules.*
