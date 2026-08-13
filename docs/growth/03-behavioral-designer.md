# 03 — Behavioral / Gamification Designer: Mechanic Audit, Loop Map, the Missing Loop

**Role:** Senior behavioral product designer (F2P live-ops background, since reformed) · **Date:** 2026-08-12
**Mandate:** Audit every mechanic for whether its loop actually closes, name the biggest missing loop, and spec it — under the constraint that Ethos only wins when the user actually gets better.

---

## 0. Operating stance

I design habit loops, and I spent years designing compulsion loops, which is
why I can tell them apart. The test I apply to everything below:

> **The endorsement test:** would the user, on reflection, endorse this
> mechanic as serving them? A mechanic that spikes short-term engagement but
> predicts burnout or resentment fails, whatever it does to the charts.

At Ethos this test is not ethics vs revenue — it IS the revenue model. The
user pays (post-flip) because they are visibly getting better; a burned-out
user churns and pays $0. Aligned incentives are a luxury; use them.

Stage facts and contracts:

- Pre-launch, zero usage data. Every behavioral claim below is a mechanism +
  a named product that proved it at scale — never an Ethos result. Any
  voice-of-customer line is marked **UNVALIDATED HYPOTHESIS**.
- **Everything is currently free (DECISIONS #96).** All metering/paywall
  reasoning in this doc is design-for-the-flip, not currently-live.
- I adopt 01's metric contract (W2R north star, §1.1 there; activation §2.1
  there) and 02's event vocabulary (§1.2 there) verbatim. Every loop I spec
  names its tree branch and its events; where an event doesn't exist, it's
  in the addendum (§8), not silently assumed.
- **ASSUMPTION (intake unfilled): ~15 focused founder-hours/week.**
  **ASSUMPTION (intake unfilled): soft launch / public beta within ~4–6 weeks.**
  Every recommendation is sized against that budget.
- Where I disagree with a locked decision, §7 raises it formally. Nothing is
  silently contradicted.

A preliminary compliment that is also a finding: DECISIONS #43–52 already
cite goal gradient, endowed progress, Zeigarnik, fresh-start, peak-end and
implementation intentions by name, with sources, and #45 applies endowed
progress *honestly* (a visibly-free "Showed up" node, zero stars — the Nunes
& Drèze mechanism with the deception removed). This log is better behavioral
hygiene than most funded gaming studios I've worked in. The audit below is
therefore mostly about loops that are *half-built*, not principles misapplied.

---

## 1. The Hooked map of Ethos today

Hooked loop (Eyal): **trigger → action → variable reward → investment.** The
investment step is the one amateurs forget — what does today's session
deposit that makes TOMORROW'S session more valuable?

| Step | What Ethos has | Grade |
|---|---|---|
| **External trigger** | One reminder/day, only if the user tapped a when-plan (#136); streak-at-risk state visible in-app only (#26) | Thin by design — one notification/day, quiet hours (mechanics.md). Correct call; makes the internal trigger do the work |
| **Internal trigger** | The persona self-diagnoses the gap (vision.md: "we never have to convince them the problem exists") — the itch is pre-installed | Strong. The best internal trigger is one you didn't manufacture |
| **Action** | One rep, ≤5 min, one terracotta tap, anonymous-first | Strong. Fogg's B=MAP: ability is maximised; nothing to fix |
| **Variable reward** | The Index delta (unknowable before you speak), star outcome, the supply word (novelty), near-miss surfacing (#49), milestone fanfares (#140) | Strong AND honest — see §3.4: the variance is caused by the user's own performance, not a random-number generator |
| **Investment** | Streak, day counter, XP, coins, lexicon, rep history, path position | **Rich deposits, weak payout.** The lexicon — the one deposit unique to Ethos — never visibly pays interest. This is the missing loop; §4 specs it |

Diagnosis in one line: Ethos's loop is complete on trigger/action/reward and
half-built on investment — today's session deposits plenty, but the deposit
that should make *tomorrow's speech itself* better (the supply word) is never
detected, never celebrated, and therefore never felt.

---

## 2. The mechanic audit

Columns: the principle each mechanic exploits · whether the loop actually
CLOSES (trigger→action→reward→investment all wired) or is decoration ·
what's missing · severity of the gap.

| Mechanic | Principle exploited (named) | Loop closed or decoration? | What's missing | Severity |
|---|---|---|---|---|
| **Streaks** (#26, #38, #76) | Loss aversion (Kahneman & Tversky; Duolingo's publicly-credited #1 retention mechanic) | **CLOSED.** At-risk state → rep → extension + the one celebration (#34) → longer streak = more staked. #76's guardrail (streaks count reps, never analyses) protects it from the meter | A rescued-streak surface: when a freeze auto-spends (#38), the save is silent. A quiet morning line ("A freeze bridged Tuesday — 1 left") turns the safety net into felt value (operant reinforcement of *keeping* freezes; Duolingo shows the freeze-used moment explicitly) | Low |
| **Streak freezes** (#38, #39, #126) | Forgiveness mechanic — loss-aversion pressure with a relief valve (Duolingo's streak freeze measurably extends streak survival without collapsing motivation) | **CLOSED**, and unusually well-reasoned: earned weekly, capped at 2, auto-spend only when the whole gap closes (#39), buyable with coins at the same two-week price as earning (#126) | Equipped freezes are barely visible as a held asset. Endowment effect (Thaler) only works on things you can see you own — show the 0/1/2 shields near the streak flame, always | Low |
| **XP + levels** (#16, #27, #37) | Fixed-ratio effort reinforcement; separates effort from quality (the product's own stars-vs-XP doctrine) | **Accounting closed, motivation DECORATION.** XP accrues and levels compute (#27's curve), but levelling gates nothing, grants nothing, celebrates nothing. A number that changes with no consequence is furniture | A consequence per level, priced in effort not money: a coin grant on level-up (coins buy decoration only, so no pay-to-win contact), a Demos beat, a named level in coach register. Habitica and chess.com both attach *something* to every level tick; Duolingo eventually demoted bare levels for exactly this reason | Medium |
| **Leagues** (#16; unbuilt per 02 §0) | Social comparison (Festinger 1954; Duolingo leagues at scale) | **NOT CLOSED — surface unbuilt, population zero.** Festinger's mechanism requires *comparable others*; a league of 2 is a dead room broadcasting "this product is empty" | 01's Challenge 1 (density-gate visibility, personal weekly XP target below threshold) is the right fix — endorsed in §7 with behavioral evidence. Plus my own challenge on XP multipliers post-flip (§7, Challenge A) | High if shipped at launch density; resolved by the gate |
| **Stars** (#10, #28, #54, #110) | Competence satisfaction (SDT — Deci & Ryan); mastery-gated progression (unit gates at #28); goal gradient on "N stars to the next unit" (#44) | **CLOSED.** Thresholds → stars → unit unlocks; replay-for-stars is a genuine mastery loop; the substance cap (#54) stops empty reps faking quality | Little. Near-miss surfacing exists (#49). One watch-item: with #100/#108 measuring more disfluencies, thresholds are due recalibration — a silent difficulty spike reads to users as regression (attribution error: they'll blame themselves). Recalibrate *with* an in-app note | Low (Medium if recalibration ships silently) |
| **Coins** (#78–79, #125–126, #131–132) | Token economy (Ayllon & Azrin; every F2P soft currency since); endowment via the ledger | **CLOSED as of #125** — earn (1/day spoken, DB-enforced) → shop (freeze 14, poses 8/8/12). #131's un-terracotta'd Buy button is the anti-dark-pattern version of a shop | Sink runway. Full analysis §3.3: a daily user out-earns the entire catalogue in ~6 weeks, then coins inflate into meaninglessness | Medium (time-boxed: becomes real ~week 6 of any retained cohort) |
| **Boss modes** (#13, #36, #40) | Appointment mechanic (weekly reset — WoW raid lockouts, chess.com daily puzzle); flow-channel difficulty spike (Csikszentmihalyi); streak multiplier as earned bonus | **CLOSED for Cold Topic** (weekly free run per #36, library behind Pro at flip). Debate/Hostile Q&A are spec, not surface | The *anticipation* half of the appointment: nothing counts down to the next topic. "New topic Monday" + a countdown chip converts the weekly reset from a fact into an appointment (fixed-interval schedules produce anticipatory behavior right before reset — Ferster & Skinner; chess.com's daily puzzle streak works this way) | Low–Med |
| **Supply layer / lexicon** (#12, #31, #63) | Investment step (Hooked — stored value); endowment (it's built from YOUR transcript, not a word list) | **HALF-CLOSED — the deposit works, the payout is missing.** Entry per rep accrues; LexiconFlash on /you (#63) adds retrieval practice (testing effect — Roediger & Karpicke 2006). But nothing ever detects the word coming back OUT in later speech | The full missing loop. §4 specs it. This is the product's single strongest natural investment mechanic doing half its work | **High** |
| **Judged-analysis cap** (#75–77) | Appointment mechanic + scarcity (Cialdini; Worchel's cookie-jar scarcity effect) — post-flip only | **DORMANT** (free era = unlimited, correctly). As currently designed for the flip it is a *meter*, not an *appointment* — the distinction chess.com masters. §3.2 | The allowance shown as a held asset, and spent by *choice* — see §3.2. Design-for-flip work, zero urgency today | Medium (at flip) |
| **Rep history / log** (#17, #30, #53, #95) | Endowed progress (the archive is the asset); personal-best loop (#53); peak-end on "best day yet" (#95) | **CLOSED as reference, OPEN as payoff.** vision.md names the day-1-vs-day-N comparison as "the core retention asset" — and no decision says when a user first *sees* it without going looking | A surfacing moment: the comparison card auto-offered at day 7/14/30 (temporal landmarks, Dai-Milkman-Riis, already in the log as #51). 01 branch C flags the same gap (`comparison_card_viewed` — "is it ever SEEN unprompted"). The asset exists; the reveal doesn't | Med–High |
| **Day counter** (#93–95) | Endowed progress that cannot be lost — the anti-streak: only up, never resets. Counters the streak's cruellest morning | **CLOSED**, and genuinely novel. Duolingo has no equivalent; this is the humane half of the loss-aversion pair, designed on purpose | Milestone texture: Day 30/50/100 are natural fanfare moments (#140's escalation ladder exists; point it here too). Otherwise leave alone | Low |
| **Path road** (#141, #43–45, #50) | Goal gradient (Hull 1932; Kivetz's coffee-card acceleration); endowed progress node (#45, honest); Zeigarnik open loop (#50); visible-progress principle (#43, Amabile & Kramer) | **CLOSED** — and the road's grammar (proximity ordering, "N to go", one terracotta ring) is textbook goal-gradient implementation | The runway. 29 lessons ÷ 1/day ≈ 4 weeks; goal gradient *concentrates* motivation toward an end and then dumps it at the end. 01's Challenge 2 owns this; §7 endorses it and adds the behavioral rider: the infinite progression (Index trendline + PBs) must be visibly seated *before* anyone finishes the road | High (already formally challenged by 01) |
| **Celebration + chime** (#34, #52, #138–140) | Reward salience; peak-end rule (#52 — Kahneman; the PNAS 1.97M-task ending study already cited in the log); arousal-tiered audio (#140) | **CLOSED.** One celebration per rep, sound only on real earned events, milestones escalate register not just volume | Nothing structural. One monitoring duty inherited by 02's mechanics guardrail row: sound/haptics opt-out rate is the canary for #140's jackpot-profile fanfare — see §5 | Low |
| **Micro-mechanics cluster** — anticipation surface (#48), near-miss (#49), open loop (#50), fresh start (#51), streak-end rule (#52), when-plan (#136) | Reward-prediction cues; near-miss win-circuitry; Zeigarnik; temporal landmarks; peak-end; implementation intentions (Gollwitzer, d=0.65) | **CLOSED**, each one deliberately, each with its mechanism cited in the log | Nothing. This cluster is the strongest part of the design. The anticipation surface (#48) is also the natural home for two things specced below: the equipped supply word (§4) and the deep-read allowance (§3.2) | — |

---

## 3. Deep dives the brief demands

### 3.1 The investment step: what the lexicon deposits and never pays

The Hooked investment step exists so that each session *loads the next one*.
Ethos's deposits, ranked by how much they actually change tomorrow's session:

1. **Streak/day counter** — changes tomorrow's *stakes*. Works.
2. **Path position** — changes tomorrow's *content*. Works.
3. **History/PBs** — changes tomorrow's *meaning* (a number to beat, #135). Works.
4. **Lexicon** — supposed to change tomorrow's *speech itself*. **Doesn't, yet.**

The lexicon is the only deposit no competitor can copy-paste, because it is
built from the user's own transcript (#12) — and it currently terminates in a
list on /you plus a flash drill (#63). Storage plus retrieval practice, no
transfer. The moment that makes vocabulary training feel like magic — the app
*noticing you used the word* — does not exist. Wellspoken's users praise the
supply; nobody's product closes the loop back into detected speech. That's
the open goal. Full spec in §4.

### 3.2 The judged cap: appointment mechanic or paywall? (chess.com teardown)

chess.com's free daily game review is the best-in-class proof that a cap can
be the *habit* rather than the *wall*. Why it works, mechanism by mechanism:

1. **Fixed-interval reset → check-in ritual.** The allowance renews daily, so
   checking becomes time-anchored behavior (Ferster & Skinner: fixed-interval
   schedules produce reliable pre-reset return).
2. **The user chooses what to spend it on.** You pick WHICH game gets the
   review. Choice converts a limit into a decision, and the decision is
   itself engaging (effort justification; perceived agency). A cap that
   auto-spends is a tax; a cap you aim is a tool.
3. **The scarce good is the deepest value moment.** The review is the best
   thing chess.com makes; the daily free one renews desire instead of gating
   it. Scarcity raises perceived value (Cialdini) — of the *judged tier
   itself*, which is exactly the thing the flip will ask money for.
4. **Unused allowance feels like waste** — loss aversion on the grant, not on
   the user's progress.

Ethos post-flip, scored against those four: (1) yes — #77's local-midnight
reset is right; (3) yes — the judged tier with cited moments is the deepest
read; (4) partly — rollover-to-3 (#75) softens use-it-or-lose-it, and I
**endorse the softening**: pure expiry punishes returning users, and the
3-cap stockpile is a comeback gift (forgiveness beats punishment for
long-horizon retention — the same logic as Duolingo's freeze). The gap is
**(2): nothing in the decisions specifies that the user aims the spend.** If
the first scored rep of the day silently consumes the allowance, the cap is
experienced as a meter that ran out — a paywall with a timer.

**Recommendation (design-for-flip, build nothing now):**
- Show the allowance as a held object on the pre-rep anticipation surface
  (#48): "1 deep read ready · renews tonight" — endowment framing, an asset
  not a limit. (Mechanism: endowment; proof: chess.com's visible daily
  review token, Clash Royale's chest slots as held objects.)
- On a *second-plus* rep of the day, ask before spending: "Use today's deep
  read on this one?" — one tap, default respects the single-rep case (first
  and only rep of the day auto-spends; there's nothing to aim).
- Never render any meter UI during the free era (#96) — a gauge on an
  unmetered good is noise, and it would teach users to see a wall that
  isn't there.
- Measurement at flip: `paywall_hit{surface: judged_meter, rollover_balance}`
  is already specced dormant in 02 §1.2; add `deep_read_aimed` only if the
  chooser ships (§8).

**WAITING ON DATA — do not act:** whether the cap functions as appointment
(returning *for* the read) vs resented meter is answerable only post-flip,
via `paywall_hit` frequency vs W2R of capped users (02's paywall guardrail
row already defines the loss condition).

### 3.3 Coins: the earn/sink ledger, and what's next

Current economy (all shipped): earn 1/day-you-spoke, DB-enforced (#78–79,
grant bug fixed in #132). Sinks: streak freeze 14, three Demos poses 8/8/12
(#125–126). Total catalogue: 42 coins.

The arithmetic, stated as design math not a prediction: a perfectly daily
user earns 7/week; the entire catalogue is exhausted in ~6 weeks even buying
the freeze once. After that, income with no goods — and a token economy
whose tokens stop trading stops meaning anything (the standard live-ops
failure: currencies inflate, then the earn moment stops registering as a
reward at all — Zynga-era games died of this weekly). The freeze is the only
recurring sink, and it has a built-in irony: the users who most need bought
freezes (streak-breakers) earn coins slowest, while the daily users
accumulating coins are earning free freezes anyway (#38) and rarely need
more. Expect the freeze to be a *middle-band* sink only.

**What's next, in order (each: mechanism + at-scale proof, none violating
no-pay-to-win because coins never touch stars/streaks/scores):**

1. **Stress mods as coin-priced consumables** (~3–5 coins/run). mechanics.md
   already lists mods as shop items; #37 locks them to XP-multiplier only.
   This is the ideal recurring sink because it sells *challenge* — the user
   spends earned currency to make their own rep harder, the single most
   endorsement-test-proof purchase possible. Mechanism: effort
   justification + optimal-challenge seeking (flow); proof: every roguelite
   difficulty-modifier economy (Hades' Heat system — players pay difficulty
   *for* reward, at scale, and love it). **Flip-day flag, not a challenge:**
   mechanics.md's premium list says "stress mods unlocked for purchase" — if
   mods become coin consumables for everyone, that premium line needs
   Timothy's ruling when #96 reverses. Logged here so flip-day finds it.
2. **Cosmetic cadence, not catalogue.** One new Demos pose or progress-card
   theme per month beats ten at once: scarcity + novelty keep the shop worth
   checking (fixed-interval again; proof: Fortnite's item-shop rotation —
   the cadence, not the content, is the mechanic). Fits founder budget:
   poses are generated, not commissioned (#84 precedent).
3. **Lesson retries** (mechanics.md's own shop list) — re-record without
   losing the attempt log. Convenience, never truth; small recurring sink.
4. **Coin grant on level-up** (from §2's XP row) — closes the XP loop and
   feeds the sink economy from the effort side. Effort in, decoration out.

Anti-recommendation, explicitly: no randomized sinks (mystery boxes, pose
gacha). #89 already killed chests; a gacha on a trust product is the fastest
way to fail the endorsement test, and variable-ratio purchases are the one
Zynga export I will not carry in. §3.4 explains where variability rightly lives.

### 3.4 Variable reward: where Ethos's variance lives, and why to add none

Eyal's taxonomy: rewards of the tribe (social), the hunt (material), the
self (mastery). Ethos is nearly all rewards-of-self — and its variability is
**endogenous**: the Index delta, the star outcome, the near-miss, tomorrow's
supply word. You genuinely cannot know your score before you speak, so every
rep pulls the variable-reward lever — but the variance is *caused by the
user's own performance*, which means it carries information (SDT: rewards
motivate when informational, undermine when controlling — the log already
cites this at #46).

This is the same structure as chess.com's elo: massive-scale proof that
honest, self-caused variance drives "one more rep" with zero manufactured
randomness. The slot-machine feel without the slot machine.

Therefore: **add no exogenous randomness.** No random bonus XP, no mystery
rewards, no surprise multipliers. Every proposal in this doc keeps the
variance where it belongs — in the user's own numbers. (The one place
anticipation is deliberately engineered — the #48 pre-rep surface — predicts
a *knowable* reward, which is a dopamine cue, not a gamble; that distinction
is the whole game.)

---

## 4. The single biggest missing loop: **the Callback**

> Today's supply word becomes tomorrow's detected, named, celebrated moment.
> The lexicon stops being a museum and starts being equipment.

Chosen over two runner-ups: the comparison-card reveal (§2, Med–High — one
surfacing decision, not a loop) and boss-countdown anticipation (§2, small).
The Callback wins because it completes the Hooked investment step on the
product's only uncopyable asset, it serves branch C of 01's tree (supply
adoption — their own "gold signal"), and its reward is the product's promise
happening out loud.

### 4.1 The loop, step by step

**Trigger.** Two placements, both existing surfaces:
- Post-rep: the supply card (already in the results walk, #103) gains one
  line of intent-priming: "Tomorrow, work it in." (Implementation-intention
  lite — Gollwitzer d=0.65, the same mechanism #136 already uses; proof at
  scale: Duolingo's daily-goal commitment prompts.)
- Pre-rep: the anticipation surface (#48) shows the one equipped word:
  "In play: *compelling*." This is not the LexiconFlash drill and not a home
  checklist, so it does not touch #63's placement ruling — it is the deposit
  surfacing at the moment of use, on the surface #48 built for exactly
  "what this rep can earn." Flagged anyway for Timothy since #63's rationale
  was about copy-adjacency; if he reads the chip as flash-creep, it drops
  and the post-rep trigger stands alone.

**Action.** The user speaks. No obligation, no target, no penalty. The rep
is unchanged.

**Reward.** Detection is deterministic — lemma/normalized string match of
lexicon entries against the new transcript, pure arithmetic, fully #30
compliant (no LLM), fully #19/no-horoscope compliant because the reward
*names the timestamp*: results walk, words screen, one line —
"*Compelling* — 0:42. That's yours now."
- The reward is naturally variable-ratio: the user doesn't know mid-rep
  whether they'll land it, and the app only ever speaks on success. Honest
  variance, per §3.4.
- **No synthetic points.** A better word genuinely moves Range (distinct-word
  ratio, crutch-density) and often Credibility — the score improvement is
  real and already measured. Paying extra Index/stars for it would be paying
  twice and would let word-planting fake mastery. At most: a fixed small XP
  grant (effort-class, never quality) — Timothy's call, default none.

**Investment.** The lexicon entry flips state: *offered → spoken*, with
`first_used_at` recorded. The lexicon becomes a two-state collection —
"Words in your speech: 7 of 19" on /you — and set-completion pressure starts
doing quiet work (endowment + collection mechanics; proof at scale: Panini
sticker albums, Pokémon, Duolingo's badge sets). Each landed word makes the
lexicon more valuable, which makes tomorrow's supply card more interesting:
the loop feeds itself.

### 4.2 Edge cases (the part that decides whether it ships honest)

| Case | Ruling | Why |
|---|---|---|
| Word used without conscious intent | Counts | Behavior is behavior; the goal is the word in their speech, not obedience |
| Inflections/plurals ("compellingly") | Counts (lemma match) | The upgrade transferred; exactness is pedantry |
| Multi-word phrases | Normalized contiguous match | Same rule, longer string |
| User recites their lexicon as a rep | Self-defeating, no special code | The substance floor (#55) and Range's repetition measures already price a word-salad rep at what it's worth; #54's precedent (substance caps stars) covers it |
| Word never comes back | **The app never mentions it.** No "unused words" list framed as debt, no "you still haven't used…" | The absence-side of detection is a guilt mechanic; vision.md bans it. Positive-only detection, structurally (see §5) |
| Whisper mis-transcribes the word | Silent miss, no reward | Costs one celebration, claims nothing false; a false "you said it" would be horoscope feedback |
| Word was already common in the user's speech | Supply generation should avoid offering words present in recent transcripts (it already draws FROM the transcript; add the exclusion) | An "upgrade" you already use is not an upgrade; detection of it would be flattery, #47's perceived-progress rule applies |
| Same word landed twice | First time celebrates; repeats accrue a quiet count on the lexicon row | One celebration per moment; #34's spirit |

### 4.3 Endorsement test & dark-pattern check

Reflective user's description (**UNVALIDATED HYPOTHESIS** — no user has
said this): "It taught me a word from my own mouth, then noticed when I
used it." That is the product's promise, verbatim
(vision.md step 5). Passes. Dark-pattern risks: completionism anxiety on the
collection (mitigated: collection only ever grows, unused words are never a
deficit list); word-planting to farm rewards (mitigated: no score payout —
the only prize is the thing itself).

### 4.4 Measurement (per the 02 contract)

- Loop health: % of lexicon entries reaching `spoken` state, and median
  days offered→spoken. Both are SQL over `lexicon` — **needs one column**
  (§8, fix 1). This *is* 01 branch C's "gold signal," given a home; 02
  already ruled the detection is a server-side job over `lexicon` ×
  `reps.transcript`, never an event (transcripts stay out of analytics) —
  adopted; my spec just runs that job inline at scoring time and stores the
  result on the lexicon row.
- Behavior change: W2R of users with ≥1 Callback vs none (WAITING ON DATA —
  correlation at beta N, directional only, 02 §4 item 1 binds me here).
- Build size: detection is string matching in the existing scoring path plus
  one results line and one chip — roughly a day inside the **~15 h/week
  assumption**, and it should not ship before the engine/dogfood gates in
  BUILD-PLAN.md are met. This is a step-2/3 addition, not tonight's work.

---

## 5. Compulsion-vs-habit ledger (dark-pattern honesty)

Verdict per pressure-bearing mechanic, against the §0 endorsement test:

- **Streak pressure** — PASS. The pairing of resettable streak + never-
  resetting day counter (#93, designed explicitly as "the right pressure and
  the wrong memory" fix) is the most humane loss-aversion implementation
  I've seen shipped. Duolingo does not have this; keep it loud in marketing.
- **#137 "reps live only in this browser" line** — PASS. Factual loss
  framing at low volume, twice-capped soft wall (#134). This is loss
  aversion used *for* the user (their data really is at risk).
- **#140 jackpot-profile fanfare** — PASS WITH A CANARY. The decision
  correctly keeps Dixon et al.'s fraud half banned (no sound on non-wins);
  arousal on real wins is Duolingo's lesson-complete fanfare, fine. The
  canary: sound opt-out rate (02's mechanics guardrail row). If opt-outs
  climb after any audio change, the fanfare got ahead of the product.
  **WAITING ON DATA.**
- **Judged cap at flip** — CONDITIONAL PASS, conditions already locked:
  #76's two guardrails (cap never breaks a streak; never charged unless
  delivered) are precisely the resentment-preventers. §3.2's chooser makes
  it a tool. Watch `paywall_hit` vs W2R post-flip.
- **League** — FAILS at launch density (dead room ≠ social comparison);
  passes at Duolingo-density. The density gate (01 Challenge 1) converts
  fail to pass.
- **Callback collection (§4)** — PASS by construction (positive-only
  detection, no deficit framing).
- **Nothing in the current product** manufactures insecurity, buys scores,
  or guilt-trips a miss. The #26/#38/#52 lattice is clean. I looked for the
  Zynga tells; they are not here.

---

## 6. Colleague documents: adopted and critiqued

**01 (Growth PM).** Adopted: W2R, the activation contract, the tree, the
data gate, no-A/B-pre-gate. Both formal challenges endorsed and extended in
§7. One critique: branch C's "supply adoption" tracks kept entries and the
gold signal but misses the *priming* half of the loop (equip/intent — the
thing that makes adoption non-random). §4 supplies it; no tree change
needed, the gold signal simply gets a mechanism that manufactures it.

**02 (Data Analyst).** Adopted: the event vocabulary, DB-derived-over-
duplicated principle, the small-n banner (which binds every number-shaped
claim in this doc), the transcripts-never-in-analytics floor. Two critiques:
(a) **LexiconFlash (#63) is invisible** — no table, no event; a shipped
retention surface neither doc can see. One event fixes it (§8). (b) The
mechanics guardrail row measures celebration changes by "next-day return of
exposed users" — at pre-gate N that cell will be empty for months; the
sound/haptics **opt-out rate** in settings is the earlier-moving canary and
deserves promotion to primary for audio experiments. Minor, flagged for
their next pass.

---

## 7. Formal challenges

### Challenge A (mine) — XP multipliers make the post-flip league quietly purchasable (#16, #36, #37; mechanics.md leaderboard rationale)

**Claim:** mechanics.md justifies the league with "because it ranks XP
(effort) not stars (quality), competing hard can't corrupt the scores." True
for scores — but post-flip, XP itself stops being pure effort: boss library
(#36) and stress mods (mechanics.md premium list) are Pro surfaces, and both
*multiply XP* (#37). Two users doing identical daily work rank differently
because one paid. League rank is a status good; money buying status-good
position is pay-to-win's little sibling, and sharp-eyed users (ours are
16–28 and raised on F2P) will name it.
**Evidence:** #37 (mods multiply XP), #36 (boss library premium), mechanics
premium list ("all boss modes," "stress mods unlocked for purchase"), #16
("XP unbuyable" — unbuyable directly, multipliable via purchase). Free era
(#96) hides this today; the flip exposes it the day leagues render.
**Test that settles it:** rank leagues on **base XP** (multiplier-stripped —
one extra column on `xp_events`, `base_amount`); multiplied XP still feeds
levels and totals, so mods/bosses keep their reward. If Timothy prefers the
current design, the cheap empirical check post-flip: premium vs free league
placement at equal rep counts — if premium users systematically out-rank at
equal effort-days, the leaderboard is measuring wallet.
Cost of the fix: one column now (free era, nothing rendered), zero UX change.

### Challenge B (endorsement + extension) — 01's Challenge 1, league density gate

Endorsed with the behavioral evidence added: Festinger's social-comparison
mechanism requires comparable others; below ~15 active users a league
surface *actively signals product death* — worse than absent. The
replacement (personal weekly XP target) is self-referenced competition,
which SDT predicts is the safer motivator anyway. Same settling test as 01.

### Challenge C (endorsement + extension) — 01's Challenge 2, path runway

Endorsed, with the goal-gradient rider: gradient effects *concentrate*
motivation approaching an endpoint and collapse after it (Kivetz: café
customers accelerate to the free coffee, then lapse). A 4-week road doesn't
just run out of content — it schedules a motivational cliff for the
best-retained cohort simultaneously. Additional mitigation to 01's content
trigger: seat the endless progression (Index trendline, PBs, "best day
yet") visually adjacent to the road *before* anyone nears the end, so road
completion hands motivation to a metric that has no end — mechanics.md's
"nobody finishes a gym" made structural. chess.com is the at-scale proof:
rating is the road that never ends.

---

## 8. Addendum to the Data Analyst — missing instrumentation

Per your rules: no parallel vocabulary, decisions named, DB-derived where a
row can exist. For founder review, not for building tonight.

1. **Column** `lexicon.first_used_rep_id uuid null` + `first_used_at
   timestamptz null` (+ optional `times_used int default 0`) — written by
   the Callback detection at scoring time. Makes loop health (§4.4) plain
   SQL; keeps transcripts out of analytics per your privacy floor. Decision
   informed: does the supply loop close (branch C gold signal).
2. **Event** `lexicon_flash_completed {cards: int, correct: int}` — the #63
   drill currently leaves no trace anywhere. Decision: is retrieval practice
   used at all, and does flash usage correlate with Callback rate.
3. **Event** `deep_read_aimed {rep_number_today: int}` — dormant, ships only
   if §3.2's chooser ships at flip. Decision: is the cap being used as a
   tool (aimed) or hit as a wall (complements your dormant `paywall_hit`).
4. **Event** `supply_card_viewed` — NOT requested; your
   `results_step_viewed{step: words}` already covers it. Noted so nobody
   re-adds it.
5. **Column** `xp_events.base_amount` — only if Challenge A is accepted;
   costs nothing now, cannot be backfilled honestly later (same argument as
   your §1.4 fix 1).

---

*End of role 3. Next roles: §4's Callback is a spec for founder review, not
tonight's build; §7's challenges are Timothy's calls, not settled facts; and
every behavioral claim here rides on named mechanisms and named products —
the first real cohort outranks all of it.*
