# STATE.md, the system on one page (12 Sep 2026)

Read this instead of `DECISIONS.md`. When the system changes, update this file; the log keeps the history.

## Visual system

Instrument layout wearing Organic colours. The layout is the 1 Sep handoff (`design/instrument-redesign/`): hairline rows on the ground, 1px-edge cards with a fill, rectangles over pills, square progress bars, the road as a list, one eyebrow register (Outfit 11px/700, 0.14em, uppercase). The colours came back the same day (#203): terracotta #C67139 as the tap, the sage #7a8a5e ramp as earned, cream ground #f5ead8, surface and raised #faf3e3, deep sage score card, warm near-black stage.

Nobody has yet designed the two as one system. That pass is open and it is the highest-value visual task in the repo.

## Tokens (`app/globals.css`, `lib/motion.ts`)

- Radius: `rounded-control` 10, `rounded-card` 12, `rounded-sheet` 16.
- Dark: ground #1A1410, surface #241C15, raised #2E251C, stage #120E0B.
- Text: `stone-500` secondary, `stone-400` muted, `stone-300` glyphs and dividers. `on-accent` is ink on terracotta.
- Type: Outfit 600/700/800 for numbers and UI, Figtree 400 to 700 for body. Roles: title 26/700, body 15/400, caption 12.5/400.
- Motion: 200ms ease-out default, 600 for celebration. Classes `.arrive`, `.arrive-x`, `.reveal`, `.fill`, `.star-land`, `.sheet-panel`, `.sheet-scrim`, `.rec-ring`, `.dur-*`. Reduced motion is `data-motion="reduce"` on `<html>`.
- Icons: `components/Icon.tsx`, 24px line set. Primitives: `components/ui/` (EmptyState, ErrorState, Overlay, Skeleton), plus ScoreCard, Nav, PathRoad, DayTrail.

## Screens

Today `/`, Tools `/games`, Log `/history`, You `/you`, Shop `/shop`, the recording loop `/rep`, bosses, auth, the paywall sheet, Settings, the introduction carousel. Desktop is a 430px column in a cream void.

## Open, with the leaning answer. Take it unless Timothy says otherwise.

- Design the hybrid as one system, five screens, one pass.
- Desktop shell: same stage, constrained, side rail with Demos, streak and day trail.
- The seven unit marks on the road are still emoji: seven Demos poses.
- Carousel dots: the active dot slides along the row.
- Home card shows the celebrate pose over a pose just bought: the equipped pose wins.
- `nextLesson` pins the floor to the first lesson under three stars: advance on any star, revisit for the missing ones.
- Paywall prices.
- Intermittent React #418 hydration error on `/`, `/rep`, `/history`: needs a root cause.

## Checks

`npx tsc --noEmit`, `npx vitest run`, `npx next build`. `scripts/audit-tells.sh` is retired; the look loop replaced it.
