# Progression psychology — the research pass

Done 10 Aug 2026, one focused pass per the CLAUDE.md protocol. Brief was:
make progression the hook, reward everywhere, research it properly
rather than trusting instinct.

The literature strongly backs the instinct. It splits on exactly one
point, which is worth stating up front because it changes what we build.

---

## 1. Progress is the single strongest motivator — put it first

Amabile & Kramer ran a multi-year diary study: 238 people across 26
project teams in 7 organisations, **12,000+ diary entries**. The finding:
nothing contributed more to a good "inner work life" — the mix of
emotion, motivation and perception that drives performance — than
**making progress in meaningful work**. On days people made real
progress, they ended the day more intrinsically motivated.

**What we built:** the path moved onto the first screen (`PathRail`),
directly under the rep card. Star count and progress bar above the fold.

Sources: [HBR — The Power of Small Wins](https://hbr.org/2011/05/the-power-of-small-wins) ·
[Mindtools summary](https://www.mindtools.com/arzm8fy/amabile-and-kramers-progress-theory/)

## 2. Goal-gradient — proximity is what moves effort

Effort rises as perceived distance to a goal falls. The practical
consequence is that *ordering* matters more than *quantity*: showing the
nearest milestone beats showing all of them.

**What we built:** `nextMilestones()` sorts strictly by proximity and
`NextUp` shows the top three with an exact "N to go". A test asserts the
ordering, because the ordering *is* the feature.

## 3. Endowed progress — the reframe works, and it doesn't require lying

Nunes & Drèze (2006) gave car-wash customers loyalty cards. Group A
needed 10 stamps with 2 already filled in; Group B needed 8 from
scratch. **Identical work.** Completion: **34% vs 19%.**

The mechanism is reframing a task from "not yet begun" to "underway".
Critically, **the head start was visible and openly free** — customers
could see the two stamps were a gift. The effect came from the reframe,
not from concealment.

**What we built:** the rail opens with a filled node labelled "Showed
up" — true the moment you open the app — so the path never reads as an
empty grey row. It carries **zero stars** and contributes nothing to the
star count (asserted in tests). We get the reframe without inventing a
score.

Sources: [Nunes & Drèze, SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=991962) ·
[Coglode summary](https://www.coglode.com/nuggets/endowed-progress-effect)

## 4. Streaks work — and the thresholds are known

Duolingo has run **600+ experiments on the streak feature alone**.
Consecutive daily activity forms habits more strongly than the same
volume spread across a week. Loss aversion starts biting around **day
7**, after which churn drops sharply. Their published Streak Wager test
lifted D7 retention ~14%.

**What we built:** `STREAK_MILESTONES = [3, 7, 14, 30, 60, 100]` — the
thresholds are the researched ones, not round numbers we liked. Freezes
are earned at each 7-day block, which is exactly where the loss-aversion
cliff sits.

Sources: [StriveCloud breakdown](https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo) ·
[Digia UX breakdown](https://www.digia.tech/post/duolingo-habit-forming-reminders-retention-architecture/)

## 5. The finding that changes the brief: rewards must carry information

This is where "reward them everywhere, any time" needs qualifying.

A meta-analysis of **35 interventions, ~2,500 participants** found
gamification produced a **significant but small** overall effect — and
specifically that gamification **did not** satisfy competence needs
better than non-gamified learning. Points, badges and leaderboards raise
intrinsic motivation **when they are perceived as informational**, and
they **undermine autonomy and motivation when perceived as
controlling**.

Hattie & Timperley's review of feedback separates four levels: task,
process, self-regulation, and **self** (praise). Their conclusion on the
last one: *"Praise for task performance appears to be ineffective...
it contains such little learning-related information."* Self-level
feedback is among the **least** effective things you can give someone.

So "reward everywhere" is right in frequency and wrong in kind. Frequent
rewards that carry a number are the high-effect version. Frequent
rewards that are pure celebration are the version with a small-to-null
effect that can actively reduce motivation.

**What we built:** every `Milestone` has a required `detail` field that
names its number, and a test asserts `detail` matches `/\d/` for all of
them. `repGains()` reports what moved numerically — including **drops**,
honestly. There is no "great job" surface anywhere in the layer.

Sources: [Springer meta-analysis](https://link.springer.com/article/10.1007/s11423-023-10337-7) ·
[Hattie & Timperley, The Power of Feedback (PDF)](https://conselhopedagogico.tecnico.ulisboa.pt/files/sites/32/hattie-and-timperley-2007.pdf)

## 6. Why "even if it's not real" is the one part to reject

The brief said the feeling of progress will hook people *even if it
isn't real*. The literature says that specific move fails, and fails
worst for a product like this one.

- **Fluency illusion / illusion of competence.** When something
  processes smoothly, the brain reads smoothness as mastery. Instructor
  fluency **raises perceived learning without improving actual
  learning**. People's judgments of learning routinely diverge from
  their actual recall.
- **Desirable difficulties** (Bjork & Bjork, 1994): conditions that slow
  acquisition often *accelerate* long-term retention. Learning that
  feels harder works better. Dunlosky et al. (2013) ranked highlighting
  and re-reading — the two most popular study methods on earth — in the
  **lowest** evidence tier.
- **Variable-ratio scheduling** produces the highest, most persistent
  response rates, and the recent literature ties that same mechanism to
  addiction-shaped harm. The line drawn in the applied work is simply:
  *does the user genuinely benefit?*

The failure mode is concrete for Ethos. A manufactured sense of progress
produces someone who feels sharper and then stands up in a real meeting
and isn't. That's the exact experience the product exists to prevent,
and it's discovered in public, which is the worst possible place to
discover it. It also puts the retention asset at risk: our comparison
card works *because* day 1 and day 30 are real recordings the user can
listen to.

**The good news is that we don't need it.** Every mechanism above —
progress principle, goal gradient, endowed progress, streak thresholds —
delivers its effect on honest signals. Nunes & Drèze got 34% with a head
start people could see was free.

Sources: [Bjork — Self-regulated Learning: Beliefs, Techniques, and Illusions (PDF)](https://sanlab.psych.ucla.edu/wp-content/uploads/sites/13/2016/07/RBjork_Dunlosky_Kornell_2012.pdf) ·
[Psychology Today — The Feeling of Learning Can Be a Psychological Illusion](https://www.psychologytoday.com/us/blog/how-we-learn/202603/the-feeling-of-learning-can-be-a-psychological-illusion) ·
[Engineered highs: reward variability and behavioural addiction (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S0306460323000217)

---

# Second pass — reward everywhere

Brief was expanded: reward on every surface, any time, make everything
fulfilling. Four more mechanisms, each now shipping in `lib/rewards.ts`.

## 7. Anticipation is a separate system from delivery

Dopamine is not generated by reward itself so much as by the
**unexpected appearance of reward, or of cues that predict it** — and
only when those cues carry *new information*. Reward-anticipation and
reward-delivery have been shown to affect memory independently.

Two consequences. Showing what a rep will earn **before** the record
button is its own motivator, not a preview. And a perfectly predictable
reward stops firing — the surface has to vary with the user's state.

**Shipped:** `anticipation()` renders above the Rec button, leading with
the streak when one is on the line and the nearest milestone otherwise.

Sources: [Reward anticipation signals in the human brain (Sci Reports)](https://www.nature.com/articles/s41598-020-61257-y) ·
[Reward prediction error](https://neurosity.co/guides/reward-prediction-error-dopamine)

## 8. Near-misses recruit win circuitry

Near-miss outcomes enhance motivation to try again and activate
win-related brain circuitry rather than loss-related. The honest version
of this needs no manipulation at all: just don't hide how close the
number already is.

**Shipped:** `nearMisses()` surfaces any milestone ≥85% complete on the
home screen — "Ethos 700 — 11 to go. Best is 689. One rep could do it."

Source: [Dopamine and near-miss effects (Neuropsychopharmacology)](https://www.nature.com/articles/npp2010230)

## 9. Zeigarnik — unfinished work stays mentally active

Zeigarnik (1927): people remember interrupted tasks better than
completed ones, because the incomplete task holds psychological tension
until it closes. This is why 70%-complete progress bars pull people
back.

**Shipped:** `openLoop()` names the started-but-unfinished lesson —
"Kill 'like' is 1 of 3. 2 stars left on it."

Source: [Ness Labs — the psychology of unfinished tasks](https://nesslabs.com/unfinished-tasks)

## 10. The fresh-start effect

Dai, Milkman & Riis (Management Science, 2014): temporal landmarks — a
new week, month, year, birthday — open a new mental accounting period,
relegating past imperfection to a closed chapter. People are **33% more
likely to exercise at the start of a week**, 47% at the start of a
semester. "First day of spring" beats "the third Thursday of March"
despite being the same date.

**Shipped:** `freshStart()` fires on Mondays, the 1st, and Jan 1. The
copy points forward only — a test asserts no landmark message ever
mentions what was missed, because the mechanism is the closed chapter,
not the reckoning.

Source: [Dai, Milkman & Riis (Wharton PDF)](https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf)

## 11. The streak-end rule — the ending decides the return

The largest field experiment on prosocial behaviour to date: **14,383
volunteer crisis counsellors, 1,976,649 randomly-assigned tasks, five
years.** When people evaluate a sequence of past events they weight two
things disproportionately — **streaks** of similar events, and the
**end**. Harder tasks caused more quitting, and caused *even more*
quitting when they arrived in long runs or landed last.

This is the strongest single result in this whole pass, and it's about
the *last thing on the screen*.

**Shipped:** `endNote()` closes every results screen on something true
and good, checked in priority order — composed pauses, then a clean rep,
then the pace zone, then the streak, with "Rep N logged" as the floor.
Two tests: it always returns something, and it never ends on a
criticism.

Source: [The streak-end rule (PNAS)](https://www.pnas.org/doi/10.1073/pnas.2204460119)

---

## The rule this pass produces

> Reward as often as the research says — which is very often — and make
> every single reward name the number it measures. Frequency is the
> lever. Fabrication is not, and isn't needed to pull it.

Locked as DECISIONS #43–46.
