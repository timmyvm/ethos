# STATE.md, the system on one page (12 Sep 2026)

Read this instead of `DECISIONS.md`. When the system changes, update this file; the log keeps the history.

## Visual system

One system, since #234: Instrument's structure carrying Organic's warmth, designed as one thing rather than layered. `docs/look/SYSTEM.md` is the spec, `docs/look/` holds the before and after gallery it was judged against.

- **Depth is a step plus a tinted shadow.** Light: ground #f5ead8, surface #fbf4e6 (controls, tiles, inputs), raised #fffaf1 (cards). Dark: #1a1410, #241c15, #2e251c. `.elev-1` a card, `.elev-2` the ONE lifted thing on a screen, `.elev-3` floating. Shadows tint from the ground's 37° hue in light and go black in dark.
- **Two border jobs, two tokens.** `card-edge` (.09/.12) is a card's hairline under its shadow; `edge` (.14/.16) is a rule, a connector, an input's boundary; `hairline` (.08) separates list rows.
- **Rectangles over pills.** Chips are the only pills, Record the only circle, the nav the only square edge. Bars are square, trough and fill.
- **Colour** unchanged from #203: terracotta #C67139 is the one tap per screen, the sage ramp is earned, deep sage is the score card and the paywall, warm near-black is the stage.

Today is the first card, the clean run, then the five trait rings (#267). The lesson list is its own page at `/lessons`. The eyebrow register is Outfit 11/700/0.10em uppercase.

## Tokens (`app/globals.css`, `lib/motion.ts`)

- Radius: `rounded-control` 12, `rounded-card` 16, `rounded-sheet` 20. No concentric arithmetic: a control keeps 12 wherever it sits.
- Dark: ground #1A1410, surface #241C15, raised #2E251C, stage #120E0B.
- Text: `stone-500` secondary, `stone-400` muted, `stone-300` glyphs and dividers. `on-accent` is ink on terracotta.
- Type: Outfit 600/700/800 for numbers and UI, Figtree 400 to 700 for body. Roles: title 26/700, body 15/400, caption 12.5/400.
- Motion: 200ms ease-out default, 600 for celebration. Classes `.arrive`, `.arrive-x`, `.reveal`, `.fill`, `.star-land`, `.sheet-panel`, `.sheet-scrim`, `.rec-ring`, `.dur-*`. Reduced motion is `data-motion="reduce"` on `<html>`. `.press` scales 0.985 and veils the fill on every pointer type.
- Elevation: `--shadow-1/2/3` and `.elev-1/2/3`. Type: two uppercase registers, `.label-data` (section eyebrow) and `.label-micro` (column heads, chips, tile labels, the nav). Text sizes are body 15, caption 12.5, row title and control label 14/700, text link 13/600; numbers keep the display scale at 800, tabular.
- Rhythm, owned by the parent: section `mt-7`, eyebrow to content `mt-3`, row `py-3`, card to card `gap-3`, card `p-4`, hero `p-5`, screen `px-5 pt-7 pb-22`. Shared components carry no outer margin.
- Unit marks: `public/unit/<id>.webp`, one Demos pose per unit, cut and normalised by `scripts/cut-unit-marks.mjs` from `assets/demos-unit-*.png`. The road shows one, on the unit you are in.
- Demos poses: the introduction's full-body set is `public/demos-onboard-*.webp`, one per screen, on one baseline at one scale; the in-app set is its own crop at 512. A new pose joins either set through `scripts/cut-pose.mjs`, which measures it against a shipped one. Loops and the one-shot nod live in `components/DemosArt.tsx`.
- Icons: `components/Icon.tsx`, 24px line set. Primitives: `components/ui/` (EmptyState, ErrorState, Overlay, Skeleton), plus ScoreCard, Nav, PathRoad, DayTrail.

## Screens

Today `/`, Tools `/games`, Log `/history`, You `/you`, Shop `/shop`, the recording loop `/rep`, bosses, auth, the paywall sheet, Settings, and the introduction `/welcome`: three intro screens, seven questions (the name typed and first, the hour tapped and last), and the plan built from the answers. Demos replies where an answer moves a number or a setting and nods where it does not. Desktop is a 430px column in a cream void.

## Open, with the leaning answer. Take it unless Timothy says otherwise.

- The one tap is a rectangle at 12. A pill primary is the reference read (Headspace) and would be the only shape of its kind on Today; #201 chose rectangles. Worth one experiment.
- Desktop shell: same stage, constrained, side rail with Demos, streak and day trail.
- Carousel dots: the active dot slides along the row.
- Home card shows the celebrate pose over a pose just bought: the equipped pose wins.
- `nextLesson` pins the floor to the first lesson under three stars: advance on any star, revisit for the missing ones.
- Paywall prices.
- Intermittent React #418 hydration error on `/`, `/rep`, `/history`: needs a root cause.

## Checks

`npx tsc --noEmit`, `npx vitest run`, `npx next build`. Build with `NEXT_DIST_DIR=.next-build` while a dev server is up, or the build takes the running server's chunks with it. `scripts/audit-tells.sh` is retired; the look loop replaced it.

The look loop has a camera: `scripts/look.mjs`. Start a dev server with the Supabase host mocked, then shoot every screen at 390px in both themes against three weeks of fixture practice.

```
NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs node scripts/look.mjs after today log
```
