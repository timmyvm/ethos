# Percentiles: where "58th" comes from

How Ethos turns one sixty-second recording into a position against the
general population, what that rests on, and where it is guessing.

Companion to `lib/percentile.ts` (the arithmetic), `content/norms.ts`
(the distributions and their citations) and `lib/norms.test.ts` (the
gate that stops an unsourced one shipping).

> **Status.** The per-trait sections below carry the literature review
> and the audit. Any trait still marked **provisional** has no
> distribution good enough to place somebody honestly; its ring draws a
> dashed trough and its card says "scale provisional" in words, and it
> cannot be the reason a lesson is chosen.

## Why this document exists

A percentile is a claim about everybody else. "You are at the 58th"
asserts that 58% of the population does this worse than you, and the
only thing separating that from decoration is a real distribution behind
it. An invented one would look exactly like a working feature on a
phone, which is why the numbers live in one file with their sources
attached and a test that fails when a source is missing.

The rule this whole document serves: **where the evidence will not
support a placement, say so in the interface, not in a footnote.**

## How the research was done

Four researchers, one per measurable trait, instructed to read primary
papers rather than summaries, to quote the actual reported values, and
to answer "can Ethos ship a percentile for this honestly" directly. Each
one's proposal was then handed to a separate auditor with a single job:
**verify every citation exists and says what it was claimed to say**,
redo the arithmetic, recompute the percentile points, and check whether
the population studied matches the population Ethos serves doing the
task Ethos measures. Where an audit disagreed with the proposal, the
audit wins and the disagreement is recorded.

Read-aloud data used for a spontaneous monologue model is a real
problem, and so is conversational data used for a monologue. Both are
flagged per trait rather than smoothed over.

## The model

Three decisions turn a raw measurement into a position. All three live
in `lib/percentile.ts` and each is tested against independently computed
values.

### 1. Direction

The raw scale is not the health scale. Fewer fillers is better, so the
percentile inverts: a person at one filler a minute is near the top, not
near the bottom.

- `lower` — fewer is better. Percentile = P(population value > yours).
- `higher` — more is better. Percentile = P(population value < yours).
- `band` — there is a middle, and both sides of it are worse.

### 2. Bands

Speech rate has no "more is better". Somebody at 210 words a minute
beats 97% of the population on the raw number, which is true and
useless. So a banded trait is ranked on **distance from the middle of
the band**, and the percentile answers "how many people are further from
the middle than you".

The assumption this buys, stated plainly because it is the shakiest
thing in the model: **it treats the two sides of the band as costing the
same.** Speaking 30 words a minute too slow and 30 too fast score
identically. The literature does not obviously support that symmetry,
and it is the first thing to revisit with real user data.

The band's centre is computed in the space the norm is fitted in, so a
log-normal band has a geometric middle rather than an arithmetic one.

### 3. Shape

A rate that cannot go below zero and has a long right tail — fillers a
minute, pause length — is log-normal, not normal. Fitting a normal there
puts a chunk of the population below zero, and the visible symptom is
that everybody scores above the 50th percentile. `fromMedian(median,
ratio84)` builds a log-normal from the two numbers papers usually
report.

### What the model refuses to do

- **No decimals.** A percentile is rounded to a whole number, because no
  speech norm in this literature supports more precision than that, and
  because "58th" is something a person can hold.
- **No composite percentile from provisional parts.** A blend of five
  numbers is only as honest as its weakest input.
- **No percentile as a grade.** It is a position. Nothing in the
  interface colours it by good or bad, and every card that shows one
  also shows the next concrete move — a bare descriptive norm makes
  above-average people ease off (`docs/closure.md`, the boomerang).

## What Ethos measures, and what it does not

The five traits and the raw number each one reads (`lib/trait-readings.ts`):

| Trait | Raw measure | Source field |
| --- | --- | --- |
| Pausing | landed pauses a minute | `pauses` of kind `pre` |
| Fillers | fillers a minute | `filler_count` over duration |
| Restarts | self-corrections a minute | recovered from `dimensions.tier1.repairs` |
| Pace | words a minute | `wpm` |
| Variety | distinct words per hundred | type-token ratio of the transcript |

**Pitch variation is not measured at all.** The brief named it as a
trait to place people on, and Ethos's "range" dimension is *lexical*
(distinct words and repeated phrases), not acoustic. Nothing in the app
computes fundamental frequency today. The section below records what a
pitch model would need and whether it is reachable from a phone
microphone; until it is built there is no pitch percentile, provisional
or otherwise.

**Restarts are recovered, not stored.** There is no `repairs_per_min`
column, so the rate is reconstructed by inverting `repairScore`, which
is exact to about 0.015 a minute and lower-bounded at the floor (a score
of 0 means "three a minute or worse" and cannot say which). The right
fix is a column, and it should happen before any of this reaches a real
user.

<!-- PER-TRAIT SECTIONS -->

## Open questions

1. **Is the band symmetric?** The pace model assumes too-slow and
   too-fast cost the same. Real user data will answer it faster than the
   literature will.
2. **When does this switch to live data?** Every norm here is a
   published population. Once Ethos holds enough recordings of its own
   cohort — 16 to 28, speaking a monologue into a phone — the honest
   move is to place people against that, and to say which population
   they are being compared to.
3. **Does the percentile move for the right reason?** A trait can climb
   because somebody got better or because they recorded something
   easier. Neither the model nor the interface currently distinguishes
   them.
