# Closure: what actually makes a loop pull

Research for the shift (DECISIONS #259). Read before building anything
that fills, closes, counts or resets.

The short version: **the famous mechanism fails and the obscure ones
hold.** The thing everybody cites for progress rings — Zeigarnik, "an
unfinished task nags at you" — does not survive a 2025 meta-analysis.
The thing nobody cites — that measuring and recording a number moves the
number — is the best-evidenced finding in the whole area, and it happens
to be exactly what Ethos already is.

## How this was done

Three researchers, working independently on task closure, goal gradients
and rings in practice, reading primary papers rather than summaries,
with instructions to say loudly where a widely repeated claim turned out
to be poorly supported. Every number below traces to a citation. Where a
paper could not be reached, that is said rather than papered over.

## 1. What is actually supported

**Progress monitoring raises goal attainment.** Random-effects
meta-analysis of 138 randomised trials, N = 19,951: interventions that
got people to monitor progress raised monitoring frequency (d+ = 1.98,
95% CI [1.71, 2.24]) and raised attainment (d+ = 0.40, CI [0.32, 0.48]).
Publication bias was tested three ways; published and unpublished
estimates matched (0.40 vs 0.42).
Harkin et al. (2016), *Psychological Bulletin* 142(2), 198–229.
https://doi.org/10.1037/bul0000025

Two moderators inside it that change what Ethos builds:

- **Recording matters.** Monitoring that was physically recorded beat
  monitoring that was not. A score shown once and lost is weaker than a
  score written down.
- **The matching effect.** Monitoring a *behaviour* moved behaviour
  (d+ = 0.79, CI [0.50, 1.07]) but not outcomes (d+ = 0.14, CI [−0.18,
  0.46]). Monitoring an *outcome* moved outcomes but not behaviour
  (d+ = 0.17). Q tests significant in both directions: a real double
  dissociation. **One number cannot do both jobs.**

**To-date versus to-go does not matter.** The same meta-analysis coded
whether interventions compared the present to a future target or to a
past reference: d = 0.41 vs 0.43, Q(1) = 0.14, p = .71. A well-powered
null on exactly the distinction the small-area literature is built on.

**People resume interrupted tasks.** Weighted resumption rate 67.00%
across 21 publications, 66.79% excluding the original — so unlike
Zeigarnik, the founder is not carrying the result. A modern online
replication (Birk, Mandryk & Baumann 2020, N = 875) found 73.85%.
Ghibellini & Meier (2025). https://doi.org/10.1057/s41599-025-05000-w

**And the closer they got, the more they want to resume.** N = 260;
participants with 24 or fewer characters left showed significantly
higher motivation to finish than those further out.
Oyama, Manalo & Nakatani (2018). https://doi.org/10.1016/j.tsc.2018.01.001

**The goal gradient is real in the field.** Real café loyalty data, 949
completed cards, ~10,000 purchases: interpurchase times fell about 20%
(0.7 days, t = 2.6, p < .05) as the reward approached. A randomised
field experiment (N = 108) found a 12-stamp card with 2 free stamps
completed in 12.7 days versus 15.6 for a plain 10-stamp card.
Kivetz, Urminsky & Zheng (2006). https://doi.org/10.1509/jmkr.43.1.39

**But progress feedback is inert in the middle of the range.** Field
experiment on 13,500 real donors: telling people a fund was 10% complete
did nothing (p > .80), 66% did nothing (p > .90). Only 85% moved the
needle. Cryder, Loewenstein & Seltman (2013).
https://www.cmu.edu/dietrich/sds/docs/loewenstein/GoalGradBeh.pdf

**Implementation intentions work.** If-then plans naming when, where and
how produced d = 0.65 across 94 independent tests.
Gollwitzer & Sheeran (2006). https://doi.org/10.1016/S0065-2601(06)38002-1

**Finite, costly slack beats both a strict goal and an easy one.** 226
participants, seven days of real CAPTCHAs: a hard goal with two
explicitly limited "emergency reserve" days beat the strict version
52.5% vs 21.1%. The reserve was finite and spending it cost you.
Sharif & Shu (2017). https://doi.org/10.1509/jmr.15.0231

## 2. What is not supported, and should stop being repeated

**The Zeigarnik effect.** Pooled across 38 publications, interrupted and
completed tasks are recalled essentially identically: ratio 0.99, and
0.99 again with Zeigarnik's own outlying 1927 study removed. Interrupted
tasks were 49.16% of recalled tasks — slightly *less* than half.
Ghibellini & Meier (2025). https://doi.org/10.1057/s41599-025-05000-w

Worse for us: the effect goes *negative* (ratio 0.88) specifically in
achievement-scored settings. Ethos is an achievement-scored setting by
construction — we rank people against a population. Any mechanic
justified as "leave it unfinished so they think about it" is building on
a finding that inverts in our own conditions.

**Masicampo & Baumeister (2011) on plan-making.** Six studies, 20–40 per
cell, no independent replication found despite targeted searching, and
Schimmack's audit of the Baumeister corpus estimates ~20% replicability.
Do not build on it. Take the plan-making benefit from implementation
intentions instead.

**The small-area hypothesis and to-date/to-go framing.** Its parent
result (Koo & Fishbach 2008) had a study targeted by the Reproducibility
Project and came back p = .758 with the sign reversed. Harkin's
well-powered null above is the better answer.

**Loss aversion as a justification for streaks.** Gal & Rucker (2018)
argue the evidence does not support losses generally looming larger than
gains. Contested, not settled — which means it cannot settle an argument
in a design doc. https://doi.org/10.1002/jcpy.1047

**Two widely-quoted numbers could not be verified at all** and are not
used here: a "2020 CHI study" on streak anxiety, and a "63% more likely
to quit after one missed day". Neither has a traceable source.

## 3. Ring versus bar: folklore

All three researchers went looking for evidence that a closing circle
motivates differently from a straight line at the same percentage. There
is none. Not weak evidence — none. Every real finding in the
goal-progress literature is about the *proportion* and its framing, never
the geometry.

The nearest thing that exists is an HCI literature on **perceived waiting
time** during loading spinners, which is a different question with a
different dependent variable, and which points both ways depending on
texture (Nontasil & Tangmanee 2024, 101 mobile users, one 10-second video
load). Gestalt closure is a claim about the visual system completing
contours, not about motivation.

**So the ring in Ethos is not claimed to be more motivating than a bar.**
It is kept on two honest grounds: it packs a bounded remainder into a
square tile beside its own number, which a bar cannot do at 64px, and the
part that is *not* drawn is finite and in the same glance as the value. A
bar's remainder runs off the end of its track. That is a legibility
argument, and legibility is what it is allowed to claim.

## 3b. Rings in practice, and the three findings that change the design

**Apple's rings close because they are behaviours you control in the
next hour.** Move, Exercise, Stand: one personalised, two fixed
constants. Their designer's own stated rationale is boundedness, not
geometry — Jay Blahnik: "numbers continue to get bigger... but a ring is
either closed or not closed."
https://www.apple.com/watch/close-your-rings/

**A percentile is not that.** It is a rank against a population. It has
no closed state, the user does not control it in the next hour, and
100th is not a daily achievement. Everything the closure mechanic
offers belongs to things Ethos's user controls today — the session, the
daily challenge — and not to the trait rings. Note that every
non-Apple competitor (Garmin Body Battery, Whoop Recovery, Oura
Readiness) deliberately ships a *state* display that never closes, and
every one of them also ships an explicit rest mode. Apple itself lets
you pause rings for up to 90 days without losing the streak.

Three findings that are specific enough to build from:

**The boomerang, and it hits our best users.** Large field experiment on
household energy: a bare descriptive norm ("here is how you compare")
reduced consumption among above-average households and *increased* it
among below-average ones. Telling someone they are doing well is telling
them they can ease off. Adding an injunctive cue removed the effect.
Schultz et al. (2007). http://assets.csom.umn.edu/assets/118375.pdf

A percentile display is a descriptive norm by construction. **The
mitigation is that a trait card must never be only a position.** It
names the next move as well, every time, which is the injunctive half.

**Rank feedback can send effort elsewhere entirely.** Three-year
randomised experiment, n = 1,754 salespeople: *removing* private rank
feedback raised sales about 11%. What rescued it was adding explicit
benchmarks — what it takes to be top 10%, 25%, 50%.
https://faculty.wharton.upenn.edu/wp-content/uploads/2012/07/rankincentives_1.pdf

So a percentile alone is a liability. A percentile plus the named
distance to the next band is the version with evidence behind it.

**Visual at the bottom, numeric at the top.** Nine studies, N = 3,735,
with a single-paper meta-analysis: showing progress visually rather than
numerically pulls estimates toward the midpoint. At *low* progress the
visual display makes people feel further along and raises motivation; at
*high* progress the number beats the picture (d = .27). Effect sizes are
small (d ≈ .25) but this is the most directly actionable result in the
set. https://link.springer.com/article/10.1007/s11747-025-01133-1

And the reading-accuracy tax is real: angle sits below length in
Cleveland & McGill's hierarchy, so a ring is measurably harder to read
precisely than a bar. A partially-filled non-rectangular unit also gets
perceptually rounded — a 78th-percentile arc may be read as 80
(https://academic.oup.com/jcr/article/50/1/142/6717799). **Print the
number. Always.**

**Reward the comeback, not the streak.** Megastudy across 61,293 gym
members, 54 four-week programmes designed by 30 scientists, published in
*Nature*: the single best-performing intervention gave a micro-reward
for returning after a *missed* session. Standard streak design does the
opposite. https://www.nature.com/articles/s41586-021-04128-4

**Adaptive targets beat fixed ones over months.** RCT, N = 96, four
months: static goals produced a bigger initial jump but decayed nearly
two and a half times faster, and by day 110 the adaptive group was
1,030 steps a day ahead. https://pmc.ncbi.nlm.nih.gov/articles/PMC5372290/

**And the specific risk of measuring speech.** Orthosomnia is the
documented case where watching the metric degrades the thing measured
(https://jcsm.aasm.org/doi/10.5664/jcsm.6472). A user who becomes
self-conscious about filler words mid-sentence will speak worse, Ethos
will measure that, and the number will drop — which is the failure mode
this product is structurally most exposed to.


## 4. The cautions, in order of how much they could cost us

**Ethos has no finish line, and almost every result above has one.** The
goal gradient is defined on the proportion of the *original distance
remaining*. Coffee cards, car-wash stamps, charity targets — all have an
end. A percentile is a rank against other people: it has no finish, it
moves non-linearly (50th to 60th is far easier than 85th to 95th), and
nobody has studied a gradient over a rank. **The trait rings inherit the
gradient literature's look without inheriting its evidence.** Say so.

**Goal failure is not neutral.** Hotel chain, 95,532 loyalty customers,
randomised, 8 months of follow-up: only 20% reached the goal. Achievement
raised later purchasing; failure significantly *reduced* it — and hurt
the most committed customers hardest. Wang, Lewis, Cryder & Sprigg
(2016). https://doi.org/10.1287/mksc.2015.0966

The number to hold on to is **20%**. Set a stretch target and four in
five people experience it as a failure, and the people you damage most
are the ones who cared most.

**Showing the streak log makes a break worse than hiding it.** With a
visible log, an intact streak produced 92.47% continuation and a broken
one 45.21%; without the log, a break produced 61%. And attribution is the
amplifier: intact 86.39%, break blamed on circumstance 56.22%, break
blamed on self 35.21%. A 21-point penalty purely from who gets blamed.
Silverman & Barasch (2023), *JCR* 49(6), 1095.
https://academic.oup.com/jcr/article/49/6/1095/6623414

Our user is 16 to 28 and, by the product's own description, already knows
the gap. They will blame themselves by default. **The copy on a broken
streak has to do the attributing for them.**

**The post-completion slump is a real churn point.** Kivetz found
post-reward resetting in two separate datasets: people slow down right
after earning the thing. The day after a ring closes or a streak
milestone lands is the highest-risk day in the loop.

**Open loops across days manufacture stress, not motivation.** Unfinished
tasks predict rumination that impairs recovery: within-person ρ = .247,
N = 12,129. Wendsche, Weigelt & Syrek (2026).
https://doi.org/10.1080/10615806.2026.2616302

**Streak pressure corrupts the measurement.** Runners ran through injury
to keep a streak alive (N = 17, qualitative, Ingalls et al.,
https://doi.org/10.1371/journal.pone.0317254). The Ethos analogue is a
rushed, low-effort sixty seconds recorded purely to keep the number
alive, which poisons the very data the product is built on.

**Expect the middle to sag.** Motivation is high at the start, high near
the end, and lowest in between (Bonezzi, Brendl & De Angelis 2011).
Instrument the middle of any multi-step path, not just its ends.

**And the base rate.** A median 70% of users abandon a health or
lifestyle app within 100 days.
https://pmc.ncbi.nlm.nih.gov/articles/PMC11694054/
Whatever Ethos builds, most people will leave. Design so they leave
neutral rather than feeling they failed.

**Realistic ceiling.** Gamification meta-analysis: cognitive g = 0.49,
motivational g = 0.36, behavioural g = 0.25 with CI [0.04, 0.46] nearly
touching zero. Sailer & Homner (2020).
https://doi.org/10.1007/s10648-019-09498-w
A progress-visualisation layer is worth about g ≈ 0.25 and shaky. The
measurement itself is worth more than the decoration around it.

## 5. The build list

The synthesis pass, run over all three closure researchers at once: what
Ethos uses, where it lives in this codebase, what it rests on, and how
much that support is worth. **Confidence is a column** because half of
what gets repeated in this field does not survive being looked up.

| # | Mechanism | Where | Concretely | Rests on | Confidence |
| --- | --- | --- | --- | --- | --- |
| 1 | **Measure it, record it, keep it** | The recording loop → the trait cards → the Log (/history). lib/trait-readings.ts writes, TraitCard.tsx and the Log read. | Every recording's five trait readings (raw value + percentile + norm quality) are persisted on the rep row and re-readable forever. No number is allowed to appear once on a result screen and die: if the result screen shows it, the Log shows it again with its date. The per-trait sparkline over the last N recordings is part of the trait card, not a nice-to-have. | Harkin et al. (2016), Psychological Bulletin, 138 randomised trials, N = 19,951: progress monitoring raised attainment d+ = 0.40 [0.32, 0.48]. Moderator: physically recorded monitoring beat unrecorded, d = 0.43 vs 0.29 (Q(1) = 12.71, p < .001), widening to 0.57 vs 0.23 when the outcome was objectively measured. | Highest in the whole set. Large k, random effects, moderators tested. Publication bias is present: Egger significant, trim-and-fill cuts it to d+ = 0.19 [0.10, 0.28]. So build to the corrected number: real, positive, small-to-medium. Promise modest improvement in the copy, never transformation. |
| 2 | **Two channels, never merged** | Today. Trait cards = the outcome channel. StreakBadge + DayTrail + the daily challenge = the behaviour channel. | The five trait percentiles and the consistency numbers stay visually and conceptually separate on Today, and nothing ever blends them into one figure. lib/index-score.ts stays an outcome index: no XP, no streak, no consistency ever enters the /1000. A test asserts it. | Harkin et al. (2016) matching effect, a double dissociation with both Q tests significant: monitoring a behaviour moved behaviour (d+ = 0.79 [0.50, 1.07]) but not outcomes (0.14 [-0.18, 0.46]); monitoring an outcome moved outcomes (0.62 [0.26, 0.98]) but not behaviour (0.17 [-0.01, 0.36]). | High for the positive arms, moderate for the null arms (k = 8 and k = 4). The direction is not in doubt: one number cannot do both jobs, so a unified score would do neither well. |
| 3 | **A percentile is never shown alone** | components/TraitCard.tsx (already partly built: the "To reach the 62nd:" line). | Hard invariant, enforced by a test: a trait card renders a position only when it can also render the named next move in that trait's own unit ("4.1 fillers per hundred words, 38th. The 50th is 3.2"). If lib/trait-readings.ts cannot produce the step, the card shows the measurement and the band benchmarks, never a bare rank. | Schultz et al. (2007), household energy field experiment: a bare descriptive norm cut consumption among above-average households and RAISED it among below-average ones; an injunctive cue removed the boomerang. Barankay (n = 1,754, three years): removing private rank feedback raised sales ~11%; rank plus explicit benchmarks beat rank alone. | High on Schultz (large field experiment, replicated, one of APS's most-cited). Barankay is a working paper and the rank-feedback literature is mixed, but both point the same way: a rank with no next rung is a liability, and this is the cheapest possible fix. |
| 4 | **Print the number, always. The ring is never the value** | components/Ring.tsx and every surface that uses it. | Ring stays aria-hidden with its figure in text beside or inside it, at the display scale. No ring anywhere is the sole carrier of a quantity, and no trait is ever communicated by arc length alone. | Cleveland & McGill (1984): angle ranks below length in the accuracy hierarchy, forty years replicated. Jia, Wan & Zheng (2023), JCR 50(1), 7 experiments + 23 supplementary, N = 17,994: a partially-filled non-rectangular unit gets perceptually completed and rounded toward the integer. | High on the perception side, and it converges with the product's own rule that feedback traces to a number. The rounding transfer from stars to an arc is an inference, not a tested result, but it costs nothing to guard against. |
| 5 | **Ring leads at the bottom, number leads at the top** | components/TraitCard.tsx — one component, two emphasis states keyed to the fraction. | Below roughly the 40th percentile the ring is the dominant element and the numeral sits at caption scale; above roughly the 70th the numeral takes the display scale and the ring shrinks to a 24px mark beside it. Same card, same data, inverted hierarchy. Ship it with the split instrumented so the threshold can move. | Bauer, Khamitov, Isaac & Sevilla (forthcoming, JAMS), nine studies N = 3,735 plus a single-paper meta-analysis: visual-over-numerical display pulls estimates toward the midpoint, raising motivation at low progress (d = .24 [.14, .33]) and losing to the number at high progress (d = .27 [.16, .38]). | Moderate. Best-designed study in the set on display format, but effects are small (d ≈ .25, ηp² ≈ .01) and the context is loyalty rewards with an immediate purchase decision. Build the switch, instrument it, treat the crossover point as unknown. |
| 6 | **Closure belongs to what the user controls today** | The Ring tone grammar (already in Ring.tsx): measured/sage for a percentile, open/terracotta for the session and the daily challenge. | Trait rings never buzz, never celebrate, never say "closed" — they are a state readout, like Oura Readiness or Whoop Recovery. The closing moment (haptic on the edge of completion, the 600ms celebration) fires only on the session ring and the daily challenge ring, both of which are behaviours the user can finish in the next five minutes. | Blahnik's own stated rationale for Apple's rings is boundedness, not geometry: "a ring is either closed or not closed." A percentile has no closed state, moves when other people's data moves, and 100th is not a daily achievement. Every non-Apple competitor (Garmin Body Battery, Whoop Recovery, Oura Readiness) ships state displays that deliberately never close. Kivetz's goal-gradient model is defined on proportion of ORIGINAL distance remaining, which a rank does not have. | High as reasoning, not as a measured finding: nobody has studied a goal gradient over a rank. That absence is exactly why the trait rings must not inherit the gradient literature's look while claiming its evidence. |
| 7 | **Spend the design budget on the last stretch** | The session ring in /rep and the daily-challenge ring on Today. | The strongest animation, the haptic and the sound land in the final ~15% of the arc. No celebration for crossing the middle, and no "you're halfway" copy anywhere. The last segment gets the clearest one-more affordance. | Cryder, Loewenstein & Seltman (2013), randomised field experiment, 13,500 lapsed donors: telling people a fund was 10% complete did nothing (p > .80), 66% did nothing (p > .90), 85% more than doubled the donation rate (1.17% vs 0.5%, p < .05). Kivetz et al. (2006): interpurchase times fell ~20% as the reward approached. | Good. Two field datasets with real behaviour. The key cell in Cryder is a single chi-square just under .05 on a ~1% base rate, so treat the 85% threshold as indicative, not exact. The valuable half is the cleanly-estimated null in the middle. |
| 8 | **A daily target most people actually close, with an instrumented floor** | The daily challenge. | Ship the metric before the mechanic: "share of active users closing the challenge today" is on the dashboard from day one, with a floor (70%). Below the floor the target lowers automatically. The challenge is sized to be closed on an ordinary day by an ordinary user, not to be impressive. | Wang, Lewis, Cryder & Sprigg (2016), Marketing Science, randomised field experiment, 95,532 loyalty members, 24 months: only 20% reached the goal; achievement raised later purchasing, failure significantly reduced it for eight months afterwards, and the damage concentrated in the most loyal, highest-status customers. Soman & Cheema (2004): a challenging self-set deadline produced 62.86% completion vs 62.16% for no goal at all, while an easy one hit 83.33%. | Very high on the cost of failure: largest and longest study in the set, real behaviour, though the achieve-vs-fail split is propensity-scored rather than randomised. Soman & Cheema is small (cells of ~35) but points the same way. Treat 20% as the number that decides this. |
| 9 | **The target adapts, from the user's own last week, in both directions** | The daily challenge target, computed alongside lib/schedule.ts's nextFocus. | The challenge target derives from that user's trailing seven days on the focus trait (e.g. "beat 3.2 fillers per hundred words, your own last-week median"), recalculated weekly, and it can go DOWN. No fixed population target for everyone, no one-way ratchet. Self-referential, so it never collides with the percentile's job. | Adams et al. (2017), 2x2 RCT, N = 96, four months: static goals gave a bigger initial jump (+2,630 vs +2,149 steps, p = .095) but decayed 2.4x faster (−18.3 vs −7.7 steps/day, p < .001); by day 110 adaptive was 1,030 steps/day ahead (p = .028). Harkin et al.'s well-powered null on reference point (past vs future target: d = .43 vs .41, Q(1) = 0.14, p = .71) means self-reference costs nothing in efficacy. | Moderate on Adams (single RCT, N = 96, 77% female, mean age 41, steps not speech), high on the Harkin null. The ratchet risk is documented as a user complaint against Apple's monthly challenge, so the both-directions rule is non-negotiable. |
| 10 | **Resumption, scaled to how far they got** | The recording loop, surfaced back on Today. | A recording abandoned past ~30 of 60 seconds is kept and offered as a one-tap card on Today until midnight. Under ~10 seconds it is discarded silently with nothing said. Never pushed, never a notification, never a badge that nags: an unforced route back, visible where they already are. | Ghibellini & Meier (2025), meta-analysis of 21 publications: 67.00% resumption of interrupted tasks (66.79% excluding the original; modern online replication N = 875 at 73.85%). Oyama, Manalo & Nakatani (2018), N = 260: motivation to resume was significantly higher for those within 24 characters of finishing than for those further out. | Solid for the direction, soft on the numbers. The meta-analysts state 67% is "indicative" rather than absolute since it was assessed descriptively with no randomised baseline. The Hemingway threshold is task-specific and self-reported motivation, not behaviour. Our 30s/10s cut points are ours and should be tuned on our own data. |
| 11 | **Reward the comeback, not the streak** | The first recording after a missed day, on Today and on the result screen. | The biggest coin grant and the biggest moment in the entire loop lands on the session AFTER a miss, and names it ("back on the board"). The 30-in-a-row milestone gets less than the day-after-a-gap session does. This inverts standard streak design on purpose. | Milkman et al. (2021), Nature, megastudy across 61,293 gym members, 54 four-week programmes by 30 scientists: the single best-performing intervention gave a micro-reward (~$0.09 in points) for returning after a MISSED session. 45% of arms beat control, lifting visits 9–27%. | High. Pre-registered, enormous, head-to-head arms, top journal. The authors' own caveat: effects faded after the four-week window, so treat it as a re-entry mechanic rather than a permanent lift. |
| 12 | **The break is attributed to circumstance, never to the person** | The broken-streak state on Today and in components/StreakBadge.tsx. | The string does the attributing and states the number that survived: "Yesterday got away. 14 recordings still on the board." Banned: "you let it slip", "don't break it again", any second-person blame. Same rule in any notification that mentions a lapse. Asserted in lib/copy.test.ts alongside the em-dash rule. | Silverman & Barasch (2023), JCR 49(6), seven studies, Studies 4–7 preregistered with open data. Study 6, N = 802: continuation was 86.39% intact, 56.22% when the break was externally caused, 35.21% when self-caused (F(2,799) = 82.26, p < .001) — a 21-point penalty purely from attribution. Mediated by sense of accomplishment (indirect 0.49 [0.25, 0.82]), not by negative emotion (0.11, n.s.). | High. Best-evidenced streak paper available, preregistered confirmatory studies. The lab arms are single-session MTurk, but the field study (N = 980, 30 days) points the same way. Our user is 16 to 28 and already knows the gap: they will self-attribute by default. |
| 13 | **Finite, costly, earned slack** | lib/streak.ts (MAX_EQUIPPED_FREEZES = 3), the shop, lib/freeze-sync.ts. | Keep the cap at three. Freezes stay bought with earned coins, never with money, and a freeze bridges a gap without ever adding to the count (already true in computeStreak). The spend is shown at the moment it happens, once, per COPY-RULES placement. No unlimited freeze, no free frictionless skip. | Sharif & Shu (2017), JMR, Study 4, N = 226 over seven real days: a hard goal with two explicitly limited "emergency reserve" days beat the strict version 52.5% vs 21.1% bonus attainment and beat the easy goal (25.9%); model chi-square(4) = 14.76, p < .001. 62% said they would choose Reserve again. The reserve was finite and spending it forfeited that day's payment. | Strong for the mechanic as specified: real incentive-compatible behaviour, randomised. Limits: one week, ~56 per cell, students, an annoying task. The authors are explicit that the COST is load-bearing — a free unlimited skip is a different, untested thing. |
| 14 | **Repair a missed day by doing the work** | Today, the day after a miss. The freeze's honest sibling. | "Two recordings today and yesterday counts." Offered once, expires at midnight, capped at one repair per week, and it is work rather than a purchase — so it cannot violate the earned rule. Both recordings are scored normally; neither is waved through. | Duncan & Sharif (2026), Journal of Marketing: three week-long real-behaviour experiments in app contexts (N = 270 language study, N = 428 exercise, N = 249 lab exercise). The make-up nudge beat control on days met and total minutes. | Moderate, and decaying. Read from the authors' SJDM poster rather than the published effect sizes. Their own Study 3 found a significant interaction over time (p = .01) with the advantage shrinking across the week, and they conclude it works best for shorter/easier goals. Hence the weekly cap: do not lean on it as the only route back. |
| 15 | **Implementation intention at onboarding** | /welcome, question 7 — currently the hour, tapped and last. | The hour question becomes an if-then cue: hour plus one concrete trigger from a short list ("after coffee", "before the bus", "when I sit down at my desk"). Stored in answers, and the reminder copy echoes it back verbatim ("after coffee, 8am") instead of a generic nudge. One screen, no new step in the flow. | Gollwitzer & Sheeran (2006), meta-analysis, d = 0.65 across 94 independent tests on goal attainment, covering initiation, shielding from distraction, and disengagement. | Reliably positive, probably smaller than 0.65: 2006-era meta-analysis, published before bias correction was standard, no trim-and-fill reported. Still the best-evidenced plan mechanism available, and it replaces a much weaker one (see the reject list). |
| 16 | **Every day ends closed** | The end of the result flow in /rep, and any notification copy. | The last screen of a session is a finished state: the number recorded, the day's mark on the trail, nothing withheld. No "come back tomorrow to see the rest", no partially-revealed result, no cliffhanger push at night. Open loops are allowed inside a session only. | Wendsche, Weigelt & Syrek (2026), meta-analysis of unfinished tasks and off-job thoughts: within-person ρ = .247 (k = 14, N = 12,129), strongest for rumination outcomes, framed throughout as a stressor that impairs recovery. Plus Ghibellini & Meier's achievement-atmosphere inversion (recall ratio 0.88 where performance is scored). | The within-person estimate is well-powered and modern, but correlational: reverse causation is live. It is still the only part of the tension literature with solid modern support, and it says the tension is stress, not anticipation. For a nightly five-minute app used by 16-to-28-year-olds, that settles it. |
| 17 | **The next target is visible before the current one lands** | components/StreakCelebration.tsx and components/NextUp.tsx, on every completion screen. | No completion screen is a terminus. A closed ring, a closed challenge or a streak milestone always names the next close thing with its number attached. And the day after a milestone is treated as a risk day: it gets comeback-grade attention, not silence. | Kivetz, Urminsky & Zheng (2006): post-reward resetting, observed in two separate datasets — purchase rates slowed immediately after the reward was earned, then accelerated again toward the next. Used by the authors as the discriminating test against habituation and time-trend explanations. | Solid within that paper, replicated across its own two datasets, not independently replicated. It is loyalty-program behaviour rather than daily habit behaviour, so the transfer is an assumption — but it identifies a specific, cheap-to-instrument churn point. |
| 18 | **Rest mode** | Settings. | Pause practice for a chosen number of days: the streak holds, the day trail draws paused days as paused rather than missed, reminders stop, and the trait cards keep their last reading with its date. Turning it off resumes the streak where it was. No penalty, no purchase. | Category practice, unanimous: Oura's Rest Mode disables the activity goal and score outright, Whoop's Strain Coach lowers the day's target on a red recovery, Apple pauses Activity rings for up to 90 days without losing award streaks. Plus the failure cost from Wang et al.: a goal missed because someone was ill is still a goal missed, and it suppresses behaviour for months. | No controlled evidence that rest mode itself helps — this is harm reduction, argued from the failure literature and from every serious competitor shipping one. Without it Ethos is stricter than the products people already complain about. |
| 19 | **The streak can never buy a bad recording** | The analyze route's `scorable` gate (already present in lib/presence.ts and lib/metrics.ts), and the percentile aggregation. | A recording under the substance floor keeps the day (the behaviour happened) but is marked unscorable: it produces no trait readings, does not move any percentile, and never enters a population aggregate. The user is told which of the two it was, in one line. | Ingalls et al., PLOS One: run-streakers ran through injury to preserve a streak, with three documented backfire routes including abandoning the behaviour when the streak was its only motive. The Ethos analogue is a rushed sixty seconds recorded to keep a number alive, which corrupts the data the whole product rests on. | The source is qualitative, N = 17, retrospective, and about running — it supports no quantitative claim. The gate is justified by measurement integrity first and the streak literature second, and the mechanism already exists in the codebase: this is about wiring it to the streak rather than adding it. |
| 20 | **No live count of a measured trait while the mic is hot** | /rep, lib/live-tips.ts. | Live tips stay technique-level ("Decide your first sentence", "Eyes down") and never display a running filler count, a live pace readout or any percentile during the recording. All measurement lands after the clock stops. | Baron et al. (2017), JCSM, the orthosomnia case series: the perfectionist pursuit of a good score worsened the thing being scored. Ethos has the same structure — a speaker who becomes filler-conscious mid-sentence produces more self-corrections, which the engine then measures and reports as a lower percentile. | Weakest evidence in the use list: a three-patient case series. Included because the failure mode is structural rather than probabilistic, the fix costs nothing, and the current code already behaves this way. Keep it as a rule so nobody adds a live counter later. |
| 21 | **Percentiles aggregate on the population, never on averaged per-user ratios** | lib/percentile.ts, content/norms.ts, and any future norm rebuilt from our own recordings. | When the norms are eventually rebuilt from real Ethos data, the distribution is estimated on the pooled population of recordings, not by averaging per-user ratios or per-user percentiles. A test asserts the aggregation path. | Ghibellini & Meier (2025) show Zeigarnik's famous 1.90 came from averaging per-subject ratios — a statistic unbounded above and floored at zero, so one atypical subject drags the mean up. Their worked counter-example returns 1.25 where the correct metric returns exactly 1.00. Pooled across 37 later publications the true value is 0.99. | Arithmetically demonstrable, not a contested empirical claim. It is the cheapest lesson in the whole set: the most repeated number in this literature is an artefact of how it was averaged, and our percentile model is one careless aggregation away from the same mistake. |

## 6. The reject list

Eleven of these were on the first pass. The synthesis found four more,
and one of them is a rule about this document: **do not cite a company's own
engagement statistics as evidence.**

| Mechanism | Why not |
| --- | --- |
| Cliffhangers: a truncated result, a half-revealed score, "come back tomorrow to see the rest" | The Zeigarnik memory advantage does not exist — pooled ratio 0.99 across 38 publications, 0.99 again with Zeigarnik's own outlying 1927 study removed, and interrupted tasks were 49.16% of recalled items. Worse, it inverts to 0.88 specifically in achievement-scored settings, which Ethos is by construction. We would be deploying a dead mechanism in the one condition where the evidence says it reverses. |
| A pre-filled ring / endowed progress on first run | It works precisely because the head start is unearned (34% vs 19% completion in the car-wash field experiment). CLAUDE.md: stars, streaks and scores are earned, and feedback traces to a number. The only compliant version is that the first real recording establishes a real baseline, so the display is honestly non-empty from session one. Also note the evidence is thinner than its fame: one field study plus one converging field study, no independent replication found. |
| "Write a plan and the unfinished goal stops nagging" (Masicampo & Baumeister) | No independent or preregistered replication exists despite targeted searching; p-values cluster just under .05 with 20–40 per cell; Schimmack's audit of the Baumeister corpus (241 studies) estimates ~20% replicability, 95% CI [10%, 33%]. Take the plan-making benefit from implementation intentions instead, which is the same idea with a real evidence base. |
| "Loss aversion" as the argument for the streak | Gal & Rucker (2018) argue the evidence does not support losses generally looming larger than gains; it is contested, which means it cannot settle an argument in a design doc. And the mediation that actually carried the broken-streak effect was sense of accomplishment (0.49 [0.25, 0.82]), not negative emotion (0.11, n.s.). Protect the sense of accomplishment; do not write "loss aversion" anywhere. |
| A visible streak log with no route back | With a visible log, an intact streak produced 92.47% continuation and a broken one 45.21%; with no log at all the figures were 64.94% and 60.90%. The log made a break significantly WORSE than showing nothing (chi-square(1) = 7.46, p = .006, OR = 0.53). The log is only safe shipped together with the repair route and the freeze. |
| A stretch daily target, or a target framed as impressive | 95,532 loyalty customers, randomised: 80% missed the goal, failure significantly reduced purchasing for eight months after, and the damage concentrated in the most loyal customers. Four in five people experiencing our daily target as a failure would make retention worse than having no target at all. |
| One unified Ethos score blending trait percentiles with consistency | The matching effect is a double dissociation with both Q tests significant: outcome monitoring moves outcomes (0.62) and not behaviour (0.17); behaviour monitoring moves behaviour (0.79) and not outcomes (0.14). A blended score would be a mechanism that does neither job well, and it would also hide which of the two a user actually changed. |
| The ring argued as more motivating than a bar | No such evidence exists. The one study designed in a way that would have detected it ran the same manipulation as a block bar chart, a circular ring and progress markers and reported the effect robust across all three, with no main effect of display format in the ring study (F(1,458) = .14, p = .71, N = 462). Argue the ring on bounded legibility and packing, or not at all. |
| A percentile ring that "closes" or celebrates at 100 | A rank has no closed state, the user does not control it in the next hour, and it moves when other people's data moves. Every goal-gradient result is defined on proportion of original distance remaining; a percentile has no original distance. Closure belongs to the session and the daily challenge. |
| Five concentric trait rings as one dial | Angle is near the bottom of Cleveland & McGill's accuracy hierarchy and it is worst exactly when comparing values, which is what a five-ring dial asks. Circular dashboards also produced the highest reading error and were 507ms slower than horizontal bars under time pressure (N = 30). Apple shipped three rings and froze two of them as constants. Five separate cards, each printing its own number, is the arrangement the evidence supports. |
| Switching the ring label from "3 done" to "2 to go" past the halfway mark (the small-area hypothesis) | Its parent result (Koo & Fishbach 2008) was targeted by the Reproducibility Project and came back p = .758 with the sign reversed at N = 768,703 and power = .99. The 138-study meta-analysis found no difference between past-referenced and future-referenced progress (d = .43 vs .41, Q(1) = 0.14, p = .71) or between rate and distance monitoring. Spend the effort on making the number honest and recorded instead. |
| Pushing a notification about an abandoned recording | The Ovsiankina resumption rate of 67% was measured when the opportunity was PRESENT and UNFORCED. Pushed resumption is a different, untested thing, and the only robustly supported part of the tension literature says unfinished tasks predict rumination that impairs recovery. Leave the half-finished recording visible and one tap away; do not chase it. |
| Paid progress of any kind — bought freezes for money, bought streak days, bought percentile | The product rule, and the evidence agrees with it: unlimited or frictionless slack is not what was tested. The Reserve condition that beat a strict goal 52.5% to 21.1% was finite (two days) and cost the user something to spend. Keep freezes earned and capped at three. |
| Citing company engagement statistics as evidence, in docs or marketing | Duolingo's streak figures and Apple's ring-closure health associations (48% less likely to have poor sleep, 73%, 57%) are observational, self-selected, and published by the companies that sell the mechanic. People who close rings most days are healthier for a hundred reasons. Apple itself says "associations". Likewise, "unfinished tasks are remembered twice as well" traces to a single inflated 1927 statistic and must never appear in Ethos copy: repeating a debunked number inside a product whose whole promise is traceable feedback would be the one unforced error we cannot afford. |
| Showing a beginner the top 1%, or any elite comparison | Two reasons pointing the same way. A bare descriptive norm makes people move toward the norm, and the influence in the one large causal study of exercise contagion (1.1 million runners, weather as an instrument) ran UPWARD from less-active to more-active people, not downward. The reachable next band is the comparison with evidence behind it; the top of the distribution is not. |

### The ring, in one paragraph

Keep the ring, demote the claim. There is no evidence — none, not weak evidence — that a closing circle motivates differently from a linear bar at the same percentage, and the single best-designed study in this area is the one that most clearly says so: Bauer, Khamitov, Isaac & Sevilla ran their progress manipulation as a block bar chart, as a circular ring and as discrete markers across nine studies (N = 3,735) and reported the effect robust across all three, with no main effect of display format in the ring study (F(1,458) = .14, p = .71). What moderated was visual versus numerical, not round versus straight. Everything else people cite for rings fails on inspection: Gestalt closure is about the visual system completing contours, not about wanting to act; the HCI ring literature is about perceived waiting time during loading spinners and points both ways depending on texture; Apple's 48%/73%/57% ring-closure health figures are self-selected associations published by the company selling the ring; and Jay Blahnik's own justification is boundedness ("a ring is either closed or not closed"), which a bar with a defined end has too. Meanwhile the ring carries a real cost: angle sits below length in Cleveland & McGill's accuracy hierarchy, circular gauges produced the highest read error and were 507ms slower than horizontal bars under time pressure, and a partially-filled non-rectangular unit gets perceptually rounded, so a 78th-percentile arc may read as 80. So the ring earns its place on two honest grounds and no others. First, it packs a bounded remainder into a 64px square tile beside its own number — a bar's remainder runs off the end of its track, a ring's sits in the same glance as the value, and at this size in this layout nothing else does that. Second, it is the category's convention, which reads instantly as a measuring instrument; that is a genre signal, not a psychological lever, and it should never be written up as one. The conditions on keeping it: print the number every time, let the number lead above roughly the 70th percentile and the ring lead below the 40th, never celebrate a percentile ring closing, never stack five of them into one comparison dial, and delete any line in DESIGN.md or DECISIONS.md that claims closure makes people want to complete it. If we care about the answer, ring versus bar at matched percentage on daily-loop completion is a cheap A/B — and we would be running it because nobody ever has, not because we are re-testing something known.

## 7. The one thing to carry out of this

The strongest finding here is also the least decorative: **measuring
something and writing it down moves it**, d = 0.40 across 138 trials.
Ethos's premise was already right. The rings, the streak and the
challenges are worth about g = 0.25 on top of that, and every one of them
carries a documented way to make things worse.

So the order of effort is: get the measurement honest, keep it, show it,
and only then decorate it.
