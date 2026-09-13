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

What Ethos uses, where, and what it rests on.

| # | Mechanism | Where | Concretely | Rests on |
| --- | --- | --- | --- | --- |
| 1 | Progress monitoring | Trait cards, the log | Every recording's five traits are measured, shown, and **kept**. The number is the product. | Harkin d+ = 0.40; recording moderator |
| 2 | Monitor outcomes to move outcomes | Trait cards | The five traits are outcomes, so showing them should move them. Do not expect them to move *frequency*. | The matching effect, d+ = 0.62 vs 0.14 |
| 3 | Two numbers, two jobs | Traits vs streak | Traits are the outcome channel; the streak and daily challenges are the behaviour channel. Never merge them into one score. | The matching effect |
| 4 | Spend the design on the last stretch | Ring closing | The closing animation, the buzz, the moment. Feedback below ~85% is inert. | Kivetz; Cryder (10% and 66% did nothing) |
| 5 | Resumable, scaled to closeness | Abandoned recording | An obvious unforced route back, offered when they got far enough to want it and not when they bailed at five seconds. | Ovsiankina 67%; Hemingway effect |
| 6 | Finite, costly slack | Streak freeze | Two, explicitly limited, and spending one costs you. Not unlimited, not zero. | Sharif & Shu, 52.5% vs 21.1% |
| 7 | Repair beats forgiveness | A missed day | "Six minutes today and yesterday counts" is better evidenced in exactly this domain than an outright freeze. It decays; do not lean on it alone. | Duncan & Sharif, three week-long app studies |
| 8 | Never let them blame themselves | Broken-streak copy | The line attributes the break to circumstance, because self-blame costs 21 points of continuation. | Silverman & Barasch, 56.22% vs 35.21% |
| 9 | Implementation intention | Onboarding | The daily minute is pinned to a concrete cue. Question 7 already asks the hour; it should ask the cue. | Gollwitzer & Sheeran, d = 0.65 |
| 10 | Honest, reachable targets | Daily challenge | A challenge most people close. A target four in five people miss is worse than no target. | Wang et al., 20% reached |

## 6. The reject list

| Mechanism | Why not |
| --- | --- |
| Cliffhangers, truncated results, "come back to see the rest" | The Zeigarnik memory effect is 0.99, and it inverts to 0.88 in achievement settings, which is what Ethos is |
| A pre-filled ring, endowed progress | It works *because* the head start is unearned. CLAUDE.md: stars, streaks and scores are earned |
| "Write a plan and the nagging stops" | Masicampo & Baumeister, unreplicated |
| "Loss aversion" as an argument | Contested; cannot settle anything |
| A visible streak log with no repair route | With a log, a break costs 45.21% vs 61% without one. The log is only safe with a way back |
| A stretch daily target | 80% failure rate, and failure damages the most committed most |
| One unified Ethos score doing every job | The matching effect says it cannot |
| The ring, argued as more motivating than a bar | No evidence exists. Argue it on bounded legibility or not at all |

## 7. The one thing to carry out of this

The strongest finding here is also the least decorative: **measuring
something and writing it down moves it**, d = 0.40 across 138 trials.
Ethos's premise was already right. The rings, the streak and the
challenges are worth about g = 0.25 on top of that, and every one of them
carries a documented way to make things worse.

So the order of effort is: get the measurement honest, keep it, show it,
and only then decorate it.
