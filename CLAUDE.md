# CLAUDE.md — Ethos build sessions

You are building **Ethos**: a daily speech gym. Duolingo-style habit loop,
Elevate-style hard metrics, Wellspoken-informed drills — plus the Ethos
layer: pause-as-a-scored-skill, a supply layer, and Demos the red panda.

## Before writing ANY code or copy

Read, in order:
1. `docs/vision.md` — what this is, what it refuses to be (hard constraints)
2. `docs/brand.md` — name, palette, type, mascot, voice
3. `docs/mechanics.md` — progression, economy, pricing, competitor intel
4. `DECISIONS.md` — everything already decided. Never re-litigate a
   locked decision; never contradict one silently.
5. `design/ethos-design-direction.html` — the look (open it, actually look)

Before any UI work, also read `DESIGN-RULES.md` — the design constitution
(tokens, banned tells, the per-screen Definition of Done, motion, a11y).
Before writing any user-facing string, read `COPY-RULES.md` — the budgets
(one em dash, one negation, one mantra per screen) and the placement rule:
a mechanic is explained where it happens, or not at all. Both are
non-negotiable; a deviation needs a DECISIONS.md entry.

If generated output conflicts with these files, the output is wrong.

## The "not average, but best" protocol

Every visible micro-decision — corner radius, tap-target size, star
animation timing, empty-state copy, paywall sheet layout, haptic moments,
number formatting — gets deliberate treatment, but exactly once:

1. **Check DECISIONS.md.** Already decided → apply it, move on.
2. **Not decided →** do ONE focused research pass against best-in-class
   references only: Duolingo (habit loop, celebration), Elevate (metric
   presentation), Headspace (warmth), Linear (typography discipline),
   Airbnb (forms). The question is always "what does the best version of
   this pattern do, and why" — never "what does everyone do."
3. **Decide, record, lock.** One entry in DECISIONS.md: the decision,
   the reference, one line of rationale. Then never revisit unless user
   data contradicts it.

Anti-patterns, explicitly banned:
- Re-researching a locked decision (produces drift toward consensus mush)
- Averaging multiple references into a compromise (pick ONE best example)
- Deep-researching before checking the brand docs (taste beats consensus;
  the docs override research findings every time)

## Stack (locked)

- Next.js (App Router) + TypeScript + Tailwind (custom tokens from
  brand.md — no default palette, no Inter for display)
- Supabase: auth, Postgres, storage (audio blobs)
- Transcription: Whisper API with word-level timestamps (verbose_json)
- LLM layer: Claude API for rubric feedback + supply generation
- Vercel deploy. Web/PWA first; native wrap is an open decision.

## Build order (vision.md — violations = procrastination)

1. Recording + scoring engine (see BUILD-PLAN.md)
2. Daily drill loop + one-focus + one-supply feedback
3. Streaks + progress graphs + path
4. Paywall (mechanics.md placement: after day-3 card, never a quiz-wall)
5. Brand polish, marketing site

Logo/mascot iteration before step 3 is banned. `prototype/ethos-mvp.jsx`
is the flow reference — port its structure, replace its simulations.

## Non-negotiables (from vision.md — enforce in code review too)

- Never act on the words modern, sleek, clean, beautiful or premium as
  instructions — they summon the training-data median, which is the
  vibe-code look itself. Name the concrete change instead. Every visual
  change traces to a DESIGN-RULES.md rule, a COPY-RULES.md budget, or a
  `docs/devibe/DEVIBE-PLAYBOOK.md` phase; when a decision isn't covered,
  stop and add it to `docs/devibe/needs-judgment.md` rather than choosing
- No manufactured insecurity, no manosphere language, no guilt mechanics
- No pay-to-win: money never buys stars, streaks, or scores
- No horoscope feedback: every claim traces to a timestamp or number
- One terracotta action per screen
- Daily loop ≤ 5 minutes, always
- Demos appears at moments, never as furniture
