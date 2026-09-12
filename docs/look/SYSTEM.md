# One system, five screens (Job 1 draft, 12 Sep 2026)

The starting point was Instrument layout wearing Organic colours. What the before shots show is
not two systems but one system with its seams open: an ink outline around every box on a
paper that is almost the same colour as the ground, three border colours doing one job, six
bracketed text sizes doing three, and no rule for where the eye should land first. The pass
below closes the seams. It changes tokens first and classes second, and nothing about
mechanics, copy or routes.

## The five choices

### 1. Depth is a step and a soft warm shadow, never an ink outline

- Light: `ground` #f5ead8 → `surface` #f9f1e1 (rows, controls, chips) → `raised` #fdf7e9
  (cards). The steps are now visible, which they were not (`surface` and `raised` were one hex).
- A card is `raised` + `border-edge` at 0.07 alpha (a hairline, not an outline) + `shadow-card`,
  a shadow tinted with the theme's ink (`rgba(70, 45, 22, …)` in light). One shadow for now; Job 2
  turns it into the four-level scale (0 rest, 1 card, 2 important, 3 floating), so the token is
  named for level 1 and level 2 already exists for the three things that hold the primary action
  (today's lesson, the score card, the results hero).
- Dark: the step is the depth (`#1a1410` → `#241c15` → `#2e251c`) plus the same shadow at low
  alpha so the card still detaches. The edge lifts to 0.10 alpha because a dark step needs it.
- The 1px `stone-200` outline is retired from every control and tile. `edge` is the only
  neutral border. The two semantic borders stay: `sage-300` on earned tiles and buttons,
  `terracotta-500` 1.5px on the road's current lesson.
- Deep surfaces keep their material: the score card and the paywall on `sage-900`, the pause
  bar and comparison card on `stage`.

### 2. Radius: 10 / 14 / 20, chips are pills, Record is a circle

`rounded-control` 10 (buttons, inputs, tiles), `rounded-card` 14 (every card), `rounded-sheet`
20 (the score card, sheets, the results hero card). One step softer than 10/12/16: the Organic
warmth is in the corners as much as the colour, and 12 next to 16 read as two sizes of the same
thing rather than two ranks. Nested things use the next size down: a button inside a card is a
control, a card inside a sheet is a card.

### 3. Type: one eyebrow, three text jobs, the locked display scale

- The eyebrow is `.label-data`: Outfit 11 / 700 / 0.14em / uppercase / `stone-400`. No size
  overrides anywhere (`!text-[9.5px]`, `!tracking-[0.1em]` go). Colour overrides only where the
  surface demands it: `sage-mist` on the deep sage card, `sage-700` on an earned label.
- Three text jobs, three sizes, no other bracketed sizes for UI text:
  - `text-body` 15 / Figtree 400 for prose, `text-caption` 12.5 / 400 for fine print.
  - Row titles and control labels: Outfit 14 / 700. Primary button 15 / 700. Text links 13 / 600.
  - Row meta and blurbs: Figtree 12.5 / `stone-500`.
- Numbers keep the locked display scale (58 score-card hero, 64 results hero, 54 clock, 30 / 26
  / 24 / 20 / 19 stats), Outfit 800, tabular.
- The wordmark, the tab labels and the coach's name are not eyebrows and keep their own sizes.

### 4. Fills say what a thing is

| Thing | Fill | Edge | Shadow |
| --- | --- | --- | --- |
| Card | `raised` | `edge` | `shadow-card` |
| Card holding the primary action (today's lesson, results hero) | `raised` | `edge` | `shadow-lift` |
| Score card, paywall | `sage-900` | none (dark: `sage-300`) | `shadow-lift` |
| Secondary button, input, neutral tile | `surface` | `edge` | none |
| Earned button (outline) / earned tile | `surface` | `sage-300` | none |
| Earned button (filled), the shop's Buy | `sage-700` | none | none |
| Equipped / earned wash | `sage-100` | `sage-300` | none |
| Chip (mod, PRO, filler timestamp) | `stone-100` | none | none |
| List row | ground | `hairline` above | none |
| The one tap | `terracotta-500`, ink label | none | `shadow-lift` (light only) |
| Demos speaking (the coach bubble) | `terracotta-50` | none | none |

`bg-surface` on a card and `bg-raised` on a control were both in the tree. Now a card is always
`raised` and a control is always `surface`, so the step tells you which is which before you read it.

### 5. Rhythm: 28 between sections, 12 inside, 16 in a card

- Screen: `px-5 pt-7 pb-24`.
- Section to section: `mt-7`. A section that opens with an eyebrow puts `border-t border-hairline
  pt-4` above it when it sits on the ground, and nothing when a card carries it.
- Eyebrow to content: `mt-3`. Row to row: hairline, `py-3`. Card to card: `gap-3`.
- Card padding: `p-4` (16). Hero cards (score card, floor, results hero): `p-5` (20).
- Buttons: primary `min-h-12`, everything else `min-h-11`. The bottom-anchored primary sits above
  the safe area.

## What changes on each screen

**Today.** The floor becomes a card: today's lesson, its line and note, Demos and the tap, on
`raised` at `rounded-sheet` with `shadow-lift`, so the first thing on the screen is the thing that
is lifted. The score card keeps deep sage and moves to the same radius; the day trail's caption
wraps under the bars instead of overflowing the card (the page rendered 808px wide at 390). The
road's current lesson keeps its terracotta edge on `raised`; the checkpoints keep their ink rules.
Spin and Make-it-harder stay text links.

**The recording loop.** Idle: the mode toggle stops being an ink block (the loudest thing on a
screen whose one job is Record) and becomes a segmented control on `surface` with a `raised`
thumb. Record stays the circle, with `shadow-lift`. Recording: unchanged except the step in the
timer's secondary text. Results: the Index, the stars and the gain chips sit in one `raised`
hero card at `rounded-sheet` with `shadow-lift`; the coach bubble keeps the terracotta wash and
loses its 4px corner in favour of the card radius; Demos loses the bordered tile; the metric
tiles, supply card and transcript card are cards (`raised`, `edge`, `shadow-card`), not `surface`
boxes with hairlines; the step bar's label is the eyebrow.

**Log.** The score card as on Today. The tables keep hairline rows; the column heads take the
eyebrow at its one size and the grids widen to fit. The PRO chip and the archive gate use the
chip and row grammar above. The stored result (`/rep/[id]`) inherits the results changes.

**You.** The level card is a card (`raised`, `edge`, `shadow-lift`: it is the screen's hero).
Every `stone-200` outline goes: Open the shop, Ethos Premium and Test yourself are secondary
buttons on `surface` + `edge` (Test yourself keeps `sage-300`); freeze and earned tiles are
`surface` + `edge`, earned ones `sage-300`. The sections keep their hairlines and move to the 28
rhythm. The save-progress card and the name form use the card and input grammar.

**Shop.** Item cards are cards: `raised`, `edge`, `shadow-card`, `p-4`, `gap-3`. The freeze tile
keeps its `sage-300` edge; the double outline is gone because the card around it no longer has
one. Buy is `sage-700`; not-yet is `surface` + `edge`; On your card is the `sage-100` wash;
Put it on the card is the `sage-300` outline. The note toast is a card.

**Shared.** `Nav` on `raised` with a hairline (unchanged). `ErrorState` and `EmptyState` are cards.
`Skeleton` tiles match the new radii. `Paywall` on `sage-900` at `rounded-t-sheet` 20. `Overlay`
unchanged. Tools (`/games`) and the boss card follow the same table without a separate pass.

## Not in this job

Elevation levels 0 to 3 as a scale, press-drop and release-spring (Job 2). Motion (Job 3).
Demos (Job 4). Copy stays as it is.
