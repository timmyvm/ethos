# First-session hook — the research pass

Done 12 Aug 2026, one focused pass per the CLAUDE.md protocol. Brief was:
the app lacks continuation — research a proper CTA pathway (introduction →
auth → features → do the lesson) that gets a first-time visitor to do the
rep and come back for the next one. Sister doc to
`progression-research.md`, which owns the return loop; this one owns the
first session.

Evidence grades used throughout: **[A]** measured and stated first-hand
(a real experiment, a named person) · **[B]** credible teardown or
industry benchmark · **[C]** inference. Where a finding collides with a
locked decision, the collision is flagged in §9 rather than silently
adopted or silently dropped.

---

## 1. The one lever with an A/B result at scale — and we'd half-built it

Duolingo moved signup from before the first lesson to after it:
**+20% DAU** — Gina Gotthilf (their VP Growth), first-hand **[A]**.
Refining the *wall sequence* three years later added **+8.2%** more.
Amplitude's benchmark data says time-to-value is the main separator
between top-decile retention (18.5% at 3 months) and median (3.8%)
**[B]**.

Ethos locked this pattern a while ago (DECISIONS #15, anonymous-first) —
but only the middle of it existed. `/welcome` was orphaned (nothing
routed a first visit into it), and the "save your progress" gate was
never built into the loop; it sat at the bottom of `/you`, a tab a
first-day user has no reason to open. The marketing page even promises
"No signup until you've done one" — the promise was live, the pathway
wasn't.

**What we build:** a fresh browser routes to `/welcome`; the gate fires
in the rep flow where #15 always said it should.

Sources: [First Round Review — Gotthilf](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/) ·
[Amplitude — time to value](https://amplitude.com/blog/time-to-value-drives-user-retention)

## 2. Soft walls, and how to decline one

Duolingo's mechanism, stated first-hand **[A]**: *dismissible* "create a
profile to save your progress" prompts (they run three), followed much
later by a hard wall. "Without those soft walls priming a sign-up…
those hard walls perform significantly worse." Two details that matter
as much as the wall itself:

- The ask is always **"save your progress"**, never "register" or
  "create an account". What's at stake is named: the lesson, the XP,
  the day-1 streak.
- A prominent **"Discard my progress"** decline button measurably drove
  users away. The decline must be quiet — "Not now" — not a
  self-accusation.

**What we build:** one full-screen soft wall after rep 1's debrief,
declined with a quiet "Not now" that continues to exactly where the
user was headed. A second showing when the streak reaches 3 — the
moment the stake is largest. No hard wall (see §9).

## 3. The recording is an endowment — but only if it's finished and kept

The IKEA effect (Norton, Mochon & Ariely 2012, four experiments) **[A]**:
people value what they made far more — **but only when the task
completes**. Incomplete or discarded creations kill the effect
entirely. Loss aversion (~2× — Kahneman & Tversky) and the endowed
progress effect (34% vs 19%, already locked as #45) point the same way:
the moment to ask someone to keep a thing is right after they made it,
with the thing in view.

**What we build:** the gate screen shows the just-earned number — the
Ethos Index, the day-1 streak — and asks to save *that*, not to open an
account. Rep 1 already can't fail (worst case is "not enough to score",
which still counts and still streaks).

Sources: [Norton, Mochon & Ariely](https://www.sciencedirect.com/science/article/abs/pii/S1057740811000829) ·
[Baymard — delayed account creation](https://baymard.com/blog/delayed-account-creation)

## 4. Novices need the first score framed as a floor, not a verdict

Eskreis-Winkler & Fishbach 2019 (five studies, n=1,674) **[A]**: failure
feedback undermines learning and engagement in novices — it's
ego-threatening and people tune out. Novices seek positive feedback;
experts seek negative (Finkelstein & Fishbach 2012). Elevate's EPQ is
the design precedent **[B]**: the baseline score is explicitly framed
as approximate and *movable* — earned by a test, but pointed forward.

This does NOT soften the numbers (locked: measure, don't flatter). It
changes what the first number claims to be: a starting point that only
exists so tomorrow has something to beat. The coach schema already
carries one metric-traced strength per rep — on rep 1 that line is
load-bearing, not decorative.

**What we build:** rep 1's score carries a baseline line in the slot
where the delta will live from rep 2 on. The first lesson was already
named "The baseline rep" — the frame now matches the name.

Sources: [Eskreis-Winkler & Fishbach](https://journals.sagepub.com/doi/abs/10.1177/0956797619881133) ·
[Chicago Booth Review](https://www.chicagobooth.edu/review/learn-failing-not-so-easy) ·
[Elevate teardown](https://screensdesign.com/showcase/elevate-brain-training-games)

## 5. The largest effect size in the pass: a when-plan for tomorrow

Implementation intentions — concrete "when-where" if-then plans —
carry **d = 0.65** on goal attainment across 94 tests, 8,000+
participants (Gollwitzer & Sheeran 2006 meta-analysis; a 2024 update
over 642 tests holds the effect) **[A]**. Merely *asking* about
intentions ("how many minutes a day?") is much weaker: d = 0.24 **[A]**
— which is the evidence-backed reason to keep refusing the
goal-commitment quiz screens (see §8) while still capturing the effect.
Duolingo's retention PM called changing one button from "Continue" to
"Commit to my goal" "a significant win" **[A]**.

**What we build:** one optional tap on the last results screen while no
reminder is set — morning / lunch / evening — that stores the hour and
arms the existing reminder. Not a pledge, a plan.

Sources: [Gollwitzer & Sheeran meta-analysis (PDF)](https://cancercontrol.cancer.gov/sites/default/files/2020-06/goal_intent_attain.pdf) ·
[Wood et al. 2016 — question-behavior effect](https://www.tandfonline.com/doi/full/10.1080/10463283.2016.1245940)

## 6. Ask for the notification after the value, tied to their plan

Industry data only **[B]**, but converging from several vendors:
permission asks after a first value moment run ~55–70% opt-in against
~30–40% at launch, and a priming tap before the OS dialog runs 2–3×
the grant rate. Duolingo primes the ask as protecting the goal/streak
just created, and fires the daily reminder 23.5 hours after yesterday's
practice **[A]**.

**What we build:** the when-plan tap IS the primer — the OS dialog only
ever appears after the user has picked a time, so the notification is a
reminder of their own plan, not our marketing. One a day, quiet hours,
already enforced in `lib/reminders.ts`.

Sources: [OneSignal](https://documentation.onesignal.com/docs/en/prompt-for-push-permissions) ·
[Cem Kansu on the 23.5h reminder](https://x.com/cemkansu/status/1301267132009848832)

## 7. The barriers specific to us: the mic, and your own voice

Two frictions Duolingo never faces. Permission research is unanimous
**[B]**: ask at the moment of use, primed with one plain sentence —
never at app open. And voice confrontation is real **[B]**: bone
conduction makes your recorded voice sound thinner and higher than the
voice you know, and people rate their own voices far more negatively
than strangers do. The mitigations: prime the mic ask honestly, and
lead the results with *numbers*, never with playback — the first
confrontation is with data, not with the cringe of the sound. The
results screens already do the second by construction (playback lives
behind the scrubber).

**What we build:** the rep-1 note under the prompt names what the mic
ask is and when it ends.

Source: [The Conversation — voice confrontation](https://theconversation.com/why-do-we-hate-the-sound-of-our-own-voices-158376)

## 8. What the resented first sessions share — the moat is real

The teardown pass confirmed the locked bets with named evidence:

- **Wellspoken**: what's loved is the rich, specific first score; what
  generates 1-star venom is the wrapper — *"i HATE when apps waste 30
  mins of your time with time consuming baseless 'personalizing'
  questions"*, from a reviewer who says they **would have paid**
  otherwise **[B]**. #11 (no quiz-wall) is not just ethics, it's the
  conversion play.
- **Orai**: one rep, then results locked behind email — *"Once I
  navigated away from the results, I could no longer access them."*
  Never gate a user's own results **[B]**.
- **Speeko**: users distrust the scoring itself (good grades for
  deliberate fillers) — metric credibility is a retention variable,
  which is the no-horoscope rule stated as growth advice **[B]**.
- **Calm/Noom**: trial-before-value is their single biggest documented
  falloff/resentment point **[B]**.

Activation, defined: Duolingo's growth model treats a day-1 user as
activated when they **return on day 2** (NURR), and "going from a 1 to
2-day streak is a huge jump in retention" **[A]**. Rep 1 quality is not
the goal; rep 2 is. When analytics exist, the funnel number to watch is
visitor → rep 1 finished → returned for rep 2.

Sources: [Wellspoken reviews](https://apps.apple.com/us/app/wellspoken-articulation-coach/id6752822613) ·
[Orai first-person teardown](https://shrutibeohar.medium.com/initial-impression-about-orai-public-speaking-app-ac0b45f6d439) ·
[Duolingo growth model](https://blog.duolingo.com/growth-model-duolingo/)

## 9. Findings NOT adopted — flagged, with the locked decision they touch

Three (a)-grade Duolingo results conflict with locked decisions. Per
protocol they are flagged for Timothy's call, not silently applied:

1. **Two streak freezes auto-equipped at streak start** ("increased
   retention rates"; two beat one, three added nothing). Collides with
   #38/#126: freezes are earned or bought with speech, never gifted —
   and #89 kills free sign-in gifts. The honest middle, if ever wanted:
   grant the first freeze at day 3 instead of day 7. Not built.
2. **A hard wall after ~2–3 more lessons.** Duolingo's own data says
   soft walls alone underperform walls-in-sequence. Collides with the
   spirit of #15 (the rep is never hostage to auth). If day-14
   retention of anonymous users turns out terrible, this is the first
   dial to reconsider. Not built.
3. **The 23.5-hour reminder** (fires just before yesterday's practice
   time). Ours is a fixed chosen hour. The when-plan chips approximate
   the effect by making the user choose the hour; matching Duolingo
   exactly means reminder infra changes out of scope here. Not built.

---

## The funnel this pass produces

1. Fresh browser → `/welcome` (three screens, no quiz — #11 survives
   its first contact with growth research fully intact). Returning
   device → the floor, always. Screen 1 carries "I already have an
   account" (Duolingo's splash pattern) so sign-in stops being buried.
2. "Take the floor" → rep 1. Audio always (#68), mic ask primed at the
   moment of use, un-failable by construction.
3. Results walked as before (#103), rep 1's score framed as the
   baseline, one real strength named (already in the schema).
4. Last screen: the when-plan — one optional tap, morning/lunch/evening
   → reminder armed, notification ask primed by the tap itself.
5. Exit taps route through the save gate (anonymous sessions only):
   the just-earned numbers on screen, "Save my progress" in terracotta,
   "Not now" quiet. Fires after rep 1, once more at streak 3, then
   never again — the standing surfaces take over.
6. Standing surfaces: one quiet line on home ("N recordings live only
   in this browser · keep them"), the existing card on `/you`.
7. From rep 2 on, the flow ends on "Next lesson" exactly as #105 built
   it — this pass adds nothing between a returning user and the rep.

> The rule this pass produces: **the product is the funnel.** Every
> screen between a first visit and the record button must pay rent, the
> ask to sign up comes only after the product has visibly worked, and
> what it asks to save is the thing the user just made.
