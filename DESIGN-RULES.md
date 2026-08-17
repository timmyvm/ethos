# Ethos Design Constitution

> Read before any UI work. These rules are non-negotiable defaults.
> Deviation requires an entry in DECISIONS.md.
>
> Where this file and `docs/brand.md` disagree, brand.md wins — it is the
> older, more specific document, and the tokens here are its tokens.

## Identity (decided — do not re-decide)

- Brand: **Ethos** — calm orange, warmth + command. Mascot: Demos the red panda.
- All colour, spacing, radius and motion values come from the tokens in
  `app/globals.css` and `lib/motion.ts`. **Never invent a hex value or an
  animation duration inline.** If a token is missing, add the token first,
  then use it. The semantic three are `ground` (the room), `surface`
  (cards in it) and `ink` (text); `stage` is the dark material the
  signature moments sit on.
- Terracotta is the one tap per screen. Amber is earned-only. Stone is
  everything holding the room. Neither of the first two is ever
  decoration.
- One icon set only: the line set in `components/Icon.tsx` — 24px grid,
  1.5px stroke, `currentColor`, no fills. No emoji as icons, no second
  icon library (DECISIONS #152).
- Typography is locked (#5, amended #135): Fraunces display, Inter body,
  Space Mono for data labels. No new faces.

## Banned (the vibe-code tells)

- Indigo/purple/violet anywhere. Tailwind's default palette is not in use;
  the only colours that exist are the tokens.
- Gradient text, glow effects, aurora/orb backgrounds, glassmorphism,
  animated borders, pulsing badges.
- Cards nested inside cards. One container level per content block.
- Colored left-border strips, decorative status dots, pill badges above
  headings ("✨ New", "AI-powered").
- Bounce/elastic easing. Entrance fade-ins on more than ONE element per
  screen.
- Emoji in headings, nav, or buttons.
- Generic copy: "Supercharge", "Seamless", "Effortless", "Everything you
  need to", "Built for modern teams", hedging ("may help you"). Ethos copy
  is specific, direct, second-person, slightly wry, and governed by
  `COPY-RULES.md` — read that too before writing a string.
- Toasts for things the UI already shows. A toast is for events the user
  can't otherwise see.
- Confirmation dialogs for reversible actions — use undo instead. Confirm
  only destructive + irreversible (delete account, delete rep history).

## Required — Definition of Done for EVERY screen

A screen is not finished until all of these exist and are hand-checked:

1. **Empty state** — designed, on-brand (Demos where appropriate),
   explains what the space is for, offers ONE primary action. Never "No
   data found". Use `<EmptyState>`.
2. **Loading state** — skeleton mirroring the real layout for loads over
   ~300ms (`<Skeleton>`), optimistic UI for user-initiated writes.
   Spinners only inside buttons. A skeleton must be able to END: every
   load resolves to content, empty or error, never a permanent shimmer.
3. **Error state** — says what happened, why (if known), and gives a
   retry/recovery action (`<ErrorState>`). Never raw error text, never a
   stack trace, never a dead end, never a silent `catch {}` on a read the
   screen depends on.
4. **Success path** — the finished, populated screen.
5. **Interactive states** — every control has visible hover,
   focus-visible, active and disabled states. Missing focus ring = bug.
6. **Keyboard** — screen is fully operable by keyboard; Escape closes
   overlays; focus is trapped in modals and returned on close (`<Overlay>`).
7. **Mobile** — layout reconfigures (doesn't squish); touch targets
   ≥ 44px; nothing depends on hover.
8. **Reduced motion** — all animation collapses to simple opacity fades
   under `prefers-reduced-motion`.

## Motion rules

- Durations and easings come from `lib/motion.ts` only. Default: 200ms,
  ease-out.
- Nothing animates longer than 300ms except celebration moments (rep
  complete, streak milestone), which may go to 600ms.
- **Never animate keyboard-initiated or high-frequency actions** (list
  navigation, tab switches inside the rep loop).
- Animate only `transform` and `opacity`.
- Motion must communicate something (origin, causality, success).
  Decoration-only motion is banned.

## Speed rules (the #1 premium signal)

- Core rep loop interactions target < 100ms perceived; anything slower
  gets optimistic UI.
- Score results render progressively: show what's measured instantly,
  stream the judged feedback in.
- No layout shift on load — skeletons reserve exact space.

## Accessibility minimums

- Semantic elements (`button`, `a`, `nav`, real headings in order). Never
  `<div onClick>`.
- Every input labelled; every icon-only button has `aria-label`;
  decorative SVGs `aria-hidden`.
- Modals: `role="dialog"`, `aria-modal`, focus trap, Escape handler —
  which is what `<Overlay>` is for. Don't hand-roll a second one.
- Text contrast ≥ 4.5:1 against its surface (check terracotta-on-cream
  and every stone mid-tone in BOTH themes).
- Data visuals read their colours from the theme, never from a hex — a
  chart is UI, and half the app is dark.

## Component discipline

- Build screens by composing the primitives in `components/ui/`
  (EmptyState, ErrorState, Overlay, Skeleton). Don't restyle them ad hoc
  — change them once, everywhere.
- If a screen needs a new primitive, build it in `components/ui/` with all
  interactive states, then use it.

## The audit

`bash scripts/audit-tells.sh` greps the repo for every tell above and
writes `docs/devibe/tells-report.txt`. Sections A–D stay at zero.
