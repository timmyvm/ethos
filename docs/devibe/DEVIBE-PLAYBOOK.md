# De-Vibe Migration Playbook

Removing vibe-coded tells from an EXISTING app and upgrading it to premium.
Companion to DESIGN-RULES.md + theme.css (the design kit). Run phases in order;
each phase is one or more Claude Code tasks with the prompt given verbatim.

## The two laws of prompting this migration

1. **Never use taste adjectives.** "Modern", "sleek", "clean", "beautiful",
   "premium", "polished" summon the training-data median — the vibe-code look
   itself. Every prompt names concrete transformations instead.
2. **Subtract first, add second, one screen at a time.** De-telling (removal)
   and premium (states/speed) are separate passes. Never "redesign this page".

---

## Phase 0 — Baseline (30 min, once)

Screenshot every route before touching anything (light + dark if you have it,
desktop + 390px mobile). You cannot judge "did this get better" without a before.

> **Prompt:** Using Playwright against localhost, screenshot every route in the
> app at 1440px and 390px widths into `docs/devibe/before/`. Do not change any
> app code.

## Phase 1 — Audit (automatic, no judgment)

Run `audit-tells.sh` from the repo root. It greps for every tell and writes
`docs/devibe/tells-report.txt` with per-file hits. This report IS the backlog.

Then install the design kit (theme.css palette wipe). The build now fails on
every banned color — the compiler has become the auditor.

> **Prompt:** Install the design kit per its README: import theme.css after
> tailwindcss in globals.css, add lib/motion.ts and components/ui/*. Run the
> build. Do NOT fix the resulting errors yet — output the complete list of
> files and lines that now fail, grouped by file, appended to
> docs/devibe/tells-report.txt.

## Phase 2 — Mechanical substitution sweep (repo-wide, zero creativity)

This phase is pure find→replace against the table below. It is deliberately
boring; boring is what makes it safe to run repo-wide.

> **Prompt:** Apply the substitution table in DEVIBE-PLAYBOOK.md Phase 2 across
> the repo. These are mechanical replacements — do not redesign, do not add
> anything, do not "improve" anything beyond the table. Where a case doesn't
> match the table, leave it and list it in docs/devibe/needs-judgment.md
> instead of guessing. After the sweep, the build must pass and
> audit-tells.sh must report zero hits for sections A–D.

| Tell (find) | Replacement |
|---|---|
| `indigo-*` / `purple-*` / `violet-*` / `fuchsia-*` classes | nearest semantic token: interactive → `brand` / `brand-strong`, backgrounds → `surface*`, text → `ink*` |
| `bg-gradient-to-*` on sections/heroes/cards | flat `bg-surface` or `bg-surface-sunken` |
| gradient text (`bg-clip-text text-transparent`) | `text-ink` (or `text-brand` if it was the accent) |
| `backdrop-blur*` glass panels | `bg-surface-raised border border-border` |
| decorative `blur-2xl/3xl` orb divs, aurora/mesh backgrounds | delete the element |
| glow shadows (`shadow-[0_0_...]`, colored shadows) | `shadow-sm` or none |
| `animate-pulse` outside `<Skeleton>` | delete |
| infinite animations (`repeat: Infinity`, `animate-[...infinite]`) | delete (exception: recording indicator, if semantically live) |
| inline `duration:` / `ease:` / `transition={{...}}` values | import from `lib/motion.ts` (`transitionBase`, `fadeUp`, `celebratePop`) |
| bounce/elastic easing | `EASE_OUT` |
| raw hex colors in components | nearest semantic token (add a token first if truly missing) |
| `border-l-4` accent strips on cards | delete the border; if it encoded meaning, replace with a labeled element |
| status dots that reflect no real state | delete |
| pill badges above headings ("New", "AI-powered", sparkle emoji) | delete |
| emoji in headings/nav/buttons | delete, or Lucide icon if it carried meaning |
| mixed radii | `rounded-control` (buttons/inputs) or `rounded-card` (cards) |
| scroll-triggered fade-in wrappers on multiple elements | remove all; max ONE `fadeUp` on the screen's primary element |
| toasts confirming visible UI changes | delete the toast call |

## Phase 3 — Structural pass (per screen, subtraction with judgment)

One screen per task. This handles what grep can't see: nesting, hierarchy, copy.

> **Prompt template:** De-vibe the [SCREEN] screen per DESIGN-RULES.md.
> Subtraction only — the screen must end this task with FEWER elements, not
> more. Specifically:
> 1. Collapse nested cards to one container level per content block.
> 2. Establish hierarchy by size/weight/spacing from the theme scale — not by
>    boxes, borders, or color.
> 3. Rewrite generic copy ("Seamless", "Everything you need to...") to
>    specific Ethos voice: what the user gets, second person, references
>    speaking/reps/progress.
> 4. Remove any remaining decoration that communicates nothing.
> Do not add features, states, or animation in this pass. Screenshot before
> and after into docs/devibe/phase3/ and list every element you removed.

Screen order: rep loop first (highest traffic), then home, results, history,
onboarding, settings, marketing pages last.

## Phase 4 — Premium pass (per screen, addition)

Now, and only now, the upgrade. One screen per task, driven by the Definition
of Done — not by adjectives.

> **Prompt template:** Bring the [SCREEN] screen to the Definition of Done in
> DESIGN-RULES.md. Add exactly: (1) designed empty state via `<EmptyState>`
> with one primary action; (2) skeleton loading via `<Skeleton>` mirroring the
> real layout, optimistic UI for user-initiated writes; (3) `<ErrorState>`
> with retry for every fetch/mutation; (4) hover/focus-visible/active/disabled
> on every control; (5) full keyboard operability, Escape closes overlays;
> (6) mobile reconfiguration, 44px targets; (7) reduced-motion fallback.
> Nothing visual beyond this list. End by listing each DoD item and how it is
> satisfied, with file/line references.

Then the app-wide premium layer, each as its own task: optimistic scoring
result (measured tier renders instantly, judged tier streams in), undo instead
of confirm dialogs, autosave/draft recovery for pre-rep notes, deep links to
every rep and lesson.

## Phase 5 — Verify (trust nothing)

> **Prompt:** Run audit-tells.sh (must be zero hits, sections A–D). Run the
> build and eslint-plugin-jsx-a11y with zero errors. Re-screenshot every route
> into docs/devibe/after/ and produce a before/after HTML gallery at
> docs/devibe/compare.html pairing each route. Flag any route where an element
> count went UP during Phase 3 or a DoD item is unverifiable.

Then YOU look at the gallery. The model executes; the taste check is yours —
that judgment is the one step that can't be delegated.

## Guardrails for every session

- Add to CLAUDE.md: "During the de-vibe migration: never use or act on the
  words modern/sleek/clean/beautiful/premium — they are banned as
  instructions. All visual changes must trace to a DEVIBE-PLAYBOOK.md phase,
  a substitution-table row, or a DESIGN-RULES.md rule. When a decision isn't
  covered, STOP and add it to docs/devibe/needs-judgment.md rather than
  choosing."
- Review needs-judgment.md yourself between phases — those items are where
  the median sneaks back in.
- Commit per screen, never per phase, so any regression is one revert.
