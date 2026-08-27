# vision.md

> This file is law. Every AI session building this product reads it first.
> If generated output conflicts with this doc, the output is wrong.

## One-liner

A daily gym for speech. Five minutes of reps a day until speaking clearly
under pressure is a trait, not a performance.

## The problem

Most people can speak but can't *command* — can't hold a pause, can't
compress a thought into one clean sentence, can't think out loud without
filler. There is no place to train this. Courses teach theory. Coaches cost
$150/hr. Nobody offers reps.

## The user

One persona, written as a person:

Ambitious, 16–28, self-improvement-driven. Trains their body, manages their
money, consumes podcasts — and has noticed their speech doesn't match their
ambition. They don't have a presentation next week. They have a gap between
who they are and how they sound, and it bothers them daily.

They self-diagnose. We never have to convince them the problem exists.

## What it is

The daily loop:

1. App serves one prompt (impromptu topic, 60-second explanation, argue
   against your own view, retell tighter)
   - **Cold Topic (boss-level drill):** app assigns a topic the user has
     never studied (Dunning-Kruger effect, Bretton Woods, CRISPR). Timed
     research window (3–5 min), then record a 90-second explanation from
     memory. Scored on delivery AND accuracy — the LLM knows the topic and
     flags confident wrong claims. Trains compression, not just polish.
     Longer than the daily rep, so it lives as a weekly streak-multiplier,
     not the default loop.
2. User records 60–90 seconds
3. Engine returns hard numbers: filler count + locations, words per minute,
   pause map — including whether silences land BEFORE sentences (composed)
   or inside them (panic)
4. One focus point for tomorrow. Not five. One.
5. **One supply.** Measurement tells you what to remove; supply gives you
   what to say instead. Each rep, Demos offers exactly one upgrade drawn
   from the user's OWN transcript — a word swap ("you said 'really good'
   three times — try 'compelling'") or a base phrase. Swaps accumulate
   into a personal lexicon. (Competitor research: this supply/vocabulary
   layer is Wellspoken users' single most-praised feature; pure
   measurement apps feel judgmental, measurement + supply feels like
   coaching.)
6. Streak advances. Progress graphs across attempts.

## What it refuses to be

These are hard constraints. Any copy, feature, or design that violates them
gets rejected regardless of how well it converts.

- **No manufactured insecurity.** We never tell users they're inadequate,
  low-value, or "invisible without status." The user already knows their
  gap; our job is reps, not fear.
- **No manosphere language.** No "alpha," "high-value," "dominate,"
  "top 1% of men." The product serves ambition, not contempt.
- **No guru.** The app has no personality cult. The coach voice cites
  numbers, not vibes.
- **Not deadline prep.** No "ace your presentation" positioning. This is a
  gym, not a cram session. (Deadline rubrics may come later as a mode —
  they are not the identity.)
- **No horoscope feedback.** Every piece of feedback must trace to a
  measurement or a specific moment in the recording. If the AI can't point
  to a timestamp, it doesn't say it.

## Product principles

1. **Measure, don't flatter.** The numbers are the product. Honest scores
   beat encouraging lies — our user respects hard mirrors.
2. **Comfortable silence is a feature.** Pause quality is a first-class
   metric. We are the only app that scores silence as a skill.
3. **Five minutes, daily, forever.** Any feature that pushes a session past
   ~5 minutes is fighting the habit loop and loses.
4. **Progress must be visible.** Day 1 vs day 30 comparison is the core
   retention asset and the core marketing asset. Same artifact.
5. **The founder is user zero.** The 14-day gate is WAIVED (Timothy,
   27 Aug — DECISIONS #178); dogfood remains the QA wherever a
   calibration constant needs a real recording.

## Voice & tone

Gym, not classroom. Coach, not guru. Short sentences. Specific numbers.
Zero hype adjectives.

- Yes: "11 fillers today, down from 19. Tomorrow: kill 'like.'"
- No: "Great job! You're on your way to unlocking your true potential!"

## North star metric

Day-14 retention. Not signups, not downloads, not followers.
A signup is a compliment; a 14-day streak is a business.

## Build order (violations = procrastination)

1. Recording + scoring engine (Whisper timestamps → deterministic metrics)
2. Daily drill loop + one-focus feedback
3. Streaks + progress graphs
4. Paywall (per mechanics.md)
5. Brand polish, marketing site

Logo iteration before step 3 is banned by this document.

## Open decisions — [DECIDE: Timothy]

- ~~Name~~ — DECIDED: **Ethos** (mascot: Demos the red panda,
  pending veto). Details in brand.md.
- ~~Free/paid line~~ — DECIDED: freemium (Duolingo/Elevate pattern).
  Details in mechanics.md.
- ~~Visual direction~~ — DECIDED: calm terracotta CTA + warm stone/cream
  neutrals + red panda mascot. Full system in brand.md + brand-board.html.

No open decisions remain. Next milestone: build order step 1
(recording + scoring engine).
