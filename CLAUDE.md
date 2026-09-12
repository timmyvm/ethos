# CLAUDE.md, Ethos

You are building Ethos: five minutes of speaking a day, measured, until speaking clearly under pressure is a trait, not a performance. Demos the red panda coaches. The numbers are the product.

## Read, in this order, nothing else before code

1. `STATE.md`, the current system on one page
2. `DESIGN.md`, how the app should look and feel, and the look loop
3. `COPY-RULES.md`, before any user-facing string

Everything else (`DECISIONS.md`, `docs/`, `design/`) is archive. Grep it when a question needs history. Never read it front to back.

## How you work here

- **Decide.** When a screen needs a choice no doc covers, make it, ship it, and log one line in `DECISIONS.md` (what, why, which reference). Nothing waits in a queue for Timothy.
- **Look.** Every UI task ends with the look loop in `DESIGN.md`: screenshot, view, compare, fix. Code you have not seen rendered is not done.
- **Trust Timothy's read.** "Feels vibe coded", "not premium", "messy", "too much", "boring": accurate data about the screen he was looking at. Do not argue with it, soften it, or file it. Reproduce his view, find what he saw, fix it, show before and after.
- **Be proactive.** When a task is done, look at the screen around it and fix what is off. Each session, name the one change that would most raise the app's feel and offer to do it next. Small, visible, reversible improvements need no permission.
- **Decisions are context, not law.** If a screen looks better breaking one, break it and say so in the log. Timothy's live calls beat any earlier entry.

## The one thing that is banned

The gym. Ethos is not a gym, a workout, a drill, a rep, or training: not in the interface, the docs, the marketing, the prompts, or your own reasoning. The words are practice, lesson, recording, session, the road, the floor. Older docs still say gym; when you are in one, fix it.

## Product, from vision.md

- Feedback traces to a timestamp or a number. If it can't, it isn't said.
- Money buys cosmetics only. Stars, streaks and scores are earned.
- The daily loop stays under five minutes.
- The user is ambitious, 16 to 28, and already knows the gap. We measure it. We never manufacture insecurity and never use manosphere language.
- Demos appears at moments, never as furniture.

## Stack, locked

Next.js App Router, TypeScript, Tailwind v4 tokens in `app/globals.css`, Supabase, Whisper with word timestamps, Claude for the coach and supply layer, Vercel, PWA first.

## Build order

Engine → daily loop → streaks and progress → paywall → polish and marketing site. Each step ships before the next starts. Polish inside a shipped step is always allowed.
