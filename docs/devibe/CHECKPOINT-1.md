# Ethos — Checkpoint 1 Audit Report

Date: 14 Aug 2026 · Scope: full repo (read-only) · App booted live, 28 baseline screenshots captured (14 routes × desktop/mobile) in `docs/devibe/before/`.

## The verdict up front

**Ethos is not littered with vibe-coded tells. It's the opposite — this is one of the cleanest codebases the audit could hope to hit.** Zero purple/indigo, zero gradients-as-decoration, zero glassmorphism, zero glow, zero generic SaaS copy, zero `<div onClick>`, semantic tokens already in place (ground/surface/ink/stage), a real brand voice, Demos empty states, per-screen skeletons, reduced-motion handled, dark mode via token remapping. The "not average but best" protocol clearly worked.

**Consequence: Phases 2–3 of the playbook (the de-vibe sweep) are unnecessary. The whole opportunity is Phase 5 — premium hardening.** The plan below replaces the original phases.

## Audit numbers (and what they really were)

| Section | Hits | Reality |
|---|---|---|
| A. Banned palette | 0 | Clean. |
| A. Raw hexes | 52 | Mostly legit (token definitions in globals.css, manifest colors, canvas). **8 real**: see Finding 3. |
| B. Gradients/glow/glass/pulse | 0 | Clean across all six checks. |
| C. Emoji in JSX | 51 | Mostly ▲▼●→✓ data glyphs (deliberate, fine). **Real**: 🔒 + emoji lesson-node icons on the Path road — see Finding 6. |
| C. Bounce easing | 5 | All false positives (a variable named `anticipate`, comments). |
| D. Generic copy | 0 | Copy is genuinely yours — specific, second person, no "Seamless" anywhere. |
| E. TODO/placeholder | 19 | Mostly input `placeholder=` attributes (legit). Real: Paywall prices are placeholders (already in your open queue). |

## The real findings (priority order)

### 1. Errors are swallowed silently — the biggest gap
Pages `catch` fetch failures but never tell the user: home (5 catches, 0 surfaced), history (2/0), you (6/0), shop (4/0), path (1/0). Only the rep flow partially surfaces errors (4 surfaced, 1 retry). A failed load = stale or blank UI with no explanation and no retry anywhere.
**Fix:** thread `<ErrorState>` with retry through every data fetch. This is the single highest-leverage change in the repo.

### 2. Skeletons never resolve when the backend is unreachable — observed live
Booted without Supabase keys (your "degrades gracefully" path): the You page renders permanent skeletons on Level/XP, stat cards, coins, and freezes; the stage card on Today does the same. Graceful degradation works for scoring but the read paths wait forever.
**Fix:** timeout → resolve to empty-state or offline notice ("Your log lives on this device until we can reach the server"). Same machinery as Finding 1.

### 3. Hardcoded light-theme hexes break dark mode in data visuals
`Sparkline.tsx`, `DayTrail.tsx`, `PoseSkeleton.tsx` hardcode light-mode colors (`#F5F0E8` fills, `#78716C` strokes, `#F59E0B` dots). In dark mode these render light-on-dark artifacts. (`ShareCard.tsx` canvas is arguably correct — a shared image should stay brand-light — your call; `manifest.ts`/`layout.tsx` themeColor should follow theme.)
**Fix:** read from CSS variables / pass theme-aware props.

### 4. Zero `focus-visible` styling anywhere
Not one focus-visible rule in the codebase; inputs use `outline-none` with only a border-color shift. Keyboard users can't see where they are. Also thin `aria-` coverage overall (~17 attributes total; the tab nav, icon buttons, and the Rec button deserve a pass).
**Fix:** one global `:focus-visible` rule in globals.css (2px terracotta outline, offset 2) + aria pass on Nav/controls.

### 5. Only Paywall has dialog semantics
Paywall handles Escape/role correctly — good. Other overlays (ModPicker, StreakCelebration, shop confirm if modal) show no Escape/`role="dialog"`/focus-trap handling.
**Fix:** extract Paywall's pattern into a shared overlay wrapper.

### 6. The Path road uses emoji as lesson-node icons (🔒, 😐, 🔥, 📕…) — judgment call
This is the one visible "tell" in the app, and it's borderline: they're functioning as game iconography, but they're OS emoji, so they render differently per platform and clash with an otherwise fully custom brand. Options: (a) keep deliberately as a casual-game choice; (b) replace with a drawn icon set on one grid; (c) tiny Demos poses per unit — most on-brand, most work.
**Decision needed from you — this goes to needs-judgment.md.**

### 7. Desktop is a centered phone column on a 1440px cream void
Phone-first is right for the product, but on desktop every screen floats in empty ground with no reconfiguration. Cheapest premium fix: a deliberate desktop shell (constrained stage with side rail — Demos, streak, day trail live in the rail) rather than true multi-column redesign.

### 8. Small stuff
`app/page.tsx` and welcome→home hand-off could use a View Transition; achievements grid shows weak locked/earned contrast in the logged-out state; Paywall prices placeholder (known).

## What's already premium (don't touch)
Anonymous-first rep before signup; streak freezes with the "never money" rule; the coins philosophy copy ("It can't sell you a streak, a star or a point of your Ethos"); sleeping-Demos empty state on the log; per-screen skeletons with anti-layout-shift reasoning *documented in comments*; serif display / Inter body / mono data type system; one-CTA-per-screen rule; league smallness ("the only person to beat is last week's you"); grain texture; dark mode as token remap with contrast-corrected mid-tones.

## Revised plan (replaces Phases 2–5)

1. **Resilience pass** — Findings 1+2: ErrorState + retry on every fetch, skeleton timeouts. One PR per page, rep loop first.
2. **Keyboard & a11y pass** — Finding 4+5: global focus-visible, aria on nav/controls, shared overlay semantics.
3. **Dark-mode data visuals** — Finding 3.
4. **Your ruling on the road icons** — Finding 6 (blocks nothing).
5. **Desktop shell** — Finding 7 (biggest visual lift, do last).

Estimated: passes 1–3 are mechanical enough for Claude Code with the playbook prompt style; pass 5 needs a design decision from you first.
