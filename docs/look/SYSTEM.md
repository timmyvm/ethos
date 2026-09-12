# One system, five screens (Job 1)

Instrument layout wearing Organic colours was the starting point. What the before shots show is
one system with its seams open: a step between ground and card of 1.11:1 (four RGB units, then
masked by the grain), three border colours doing one job, five uppercase micro-registers, six
bracketed text sizes around three tokens, and no rule for which thing on a screen is lifted.

Every value below is measured, not asserted. Two independent critiques attacked the first draft
against the references and against the code; what survived is here.

## 1. Depth is a real step plus a tinted shadow

**Light**

| Token | Was | Now | Against ground |
| --- | --- | --- | --- |
| `ground` | #f5ead8 | #f5ead8 | — |
| `surface` (controls, tiles) | #faf3e3 | #fbf4e6 | 1.07:1 |
| `raised` (cards) | #faf3e3 | #fffaf1 | 1.14:1 |

`surface` and `raised` were the same hex, so a card on the ground had no step under it at all.
Now a control is one step up and a card is two, and the two are told apart before they are read.

**Dark** keeps #1a1410 → #241c15 → #2e251c: those steps already measure 1.09 and 1.12, which is
why dark read as the more finished theme.

**Shadows, with numbers.** Tinted from the ground's own hue (37°), never grey-black:

```
--shadow-card: 0 1px 2px rgba(52,40,20,.05), 0 6px 16px rgba(52,40,20,.08)
--shadow-lift: 0 2px 4px rgba(52,40,20,.06), 0 14px 32px rgba(52,40,20,.12)
```

In dark both become black (`rgba(0,0,0,.35)` / `.5`): rgb(52,40,20) has a higher luminance than
the dark ground, so a warm shadow there is a glow.

**Edges split.** The one `edge` token was doing two jobs: the hairline around a card, and the
road's thread, the log's column rules, an input's boundary. Dropping it for cards would have
erased the rules.

- `card-edge` rgba(ink, .09) light, rgba(cream, .12) dark: the hairline on a card, under the shadow.
- `edge` rgba(ink, .14) / .16 unchanged: rules, connectors, inputs.
- `hairline` .08 unchanged: list-row separators.

Light uses fill + shadow + a faint card-edge. Dark uses fill + card-edge and a black shadow, because
a step on dark carries more than a shadow does. The 1px `stone-200` outline is retired from every
box; it survives only as a glyph colour (unearned stars, the lexicon arrow).

## 2. Radius: 12 / 16 / 20

`rounded-control` 12, `rounded-card` 16, `rounded-sheet` 20. Chips are pills, Record is a circle,
the Nav is square. One step warmer than 10/12/16, where 12 beside 16 read as two sizes of the same
thing rather than two ranks.

No concentric arithmetic: a control keeps 12 wherever it sits, a card inside a sheet keeps 16.
Fixed tiles (38px glyph and freeze tiles, the 36px earned tiles, the shop's 46px art tile) are all
controls at 12. **Bars are square**, trough and fill, everywhere: the instrument against the soft
corners, and today they are square in five places and pill in three.

## 3. Two uppercase registers, not five

The tree had the eyebrow at 11/0.14em, the log's month at 9/0.1em, the PRO chip at 9.5/0.06em, the
heatmap heads at 9px and the Nav at 11/0.06em: five sizes of the same idea, which reads as a broken
eyebrow rather than five registers.

- `.label-data`, the section eyebrow: Outfit 11 / 700 / **0.10em** / uppercase / `stone-400`. One
  per section. No size overrides anywhere.
- `.label-micro`, everything smaller: Outfit 10 / 700 / 0.08em / uppercase. Column heads, chips,
  the log's month, the heatmap heads, Nav labels, tile labels inside a card.

Text sizes collapse onto four: 13.5 and 14.5 → **14/700** (row titles, control labels); 11.5 and
12 → **12.5** (`text-caption`, row meta); body stays 15; the primary button 15/700; text links
13/600. Numbers keep the display scale at **800** and tabular, including the results hero, which
was the one hero at 700.

## 4. Fills say what a thing is

| Thing | Fill | Edge | Shadow |
| --- | --- | --- | --- |
| Card | `raised` | `card-edge` | `shadow-card` |
| The one lifted card per screen | `raised` | `card-edge` | `shadow-lift` |
| Score card, paywall | `sage-900` | none (dark `sage-300`) | `shadow-card` |
| Deep panel (pause bar, comparison card) | `stage` | none (dark `card-edge`) | `shadow-card` |
| Secondary button, tile, input | `surface` | `edge` | none |
| Input focus | `surface` | `terracotta-500` | none |
| Earned outline button / earned tile | `surface` | `sage-300` | none |
| Earned fill (the shop's Buy) | `sage-700` | none | none |
| Equipped wash | `sage-100` | `sage-300` | none |
| Neutral chip | `stone-100` | none | none |
| Earned chip (XP, ×2) | `sage-100` | `sage-300` | none |
| Timestamp chip | `stone-100` | none | none |
| List row | ground | `hairline` above | none |
| Row inside a card | card | `hairline` above | none |
| Segmented control: track | `surface` | `edge` | none |
| Segmented control: selected | `raised` | none | `shadow-card` |
| Disabled | `surface` | `edge` | none, text `stone-400` |
| The one tap | `terracotta-500`, ink label | none | none |
| Coach bubble | `terracotta-50` | none | none |

Rules that fall out of it:

- **One lifted thing per screen.** Today: the floor card. The score card stays flat, because deep
  sage on cream is already the second-loudest object on the page. Results: nothing is lifted, the
  64px number sits on the ground. The road's current lesson and the Tools boss card keep their
  1.5px terracotta edge and take no shadow.
- **Disabled is one value**, not the three in the tree (opacity-40, opacity-60, stone-400 text). The
  label stays `stone-400`: `stone-300` is the faint token and globals.css already says it never
  carries words, and on a 310px control a 14/700 label in it measured fainter than the 12.5px blurb
  above it.
- **Pressed is visible.** `.press` animated `border-color`, and cards no longer have a border to
  darken, so it would have shipped with no pressed state at all. It now veils the fill:
  `background-image: linear-gradient(var(--press-veil), var(--press-veil))` on `:active`, which
  layers over any background without touching the card's shadow, plus the 0.985 scale on every
  pointer type rather than touch only.
- **The coach bubble's label** moves from `terracotta-600` (2.8:1 on the dark wash, because only
  700 and 800 remap in dark) to `terracotta-700`.
- **Skeletons carry the shadow of what replaces them**, or they are the layout shift they exist
  to prevent.

## 5. Rhythm, owned by the parent

- Screen: `px-5 pt-7 pb-22`. The 96px bottom pad sat 24px below a 72px nav.
- Section to section: `mt-7` (28). **Components carry no outer margin**: `ScoreCard` hard-coded
  `mt-5`, so Today ran 20 into the score card and 28 out of it. Parents set the gap.
- Eyebrow to content 12, row `py-3`, card to card `gap-3` (12), card padding 16, hero padding 20.
- A stack of eyebrow-headed cards is a stack of sections at 28, not a 12px pile. This is what the
  results screen was.
- The road's unit checkpoints drop `border-y border-ink` for `border-edge`: eight pairs of full-ink
  rules would become the loudest lines on Today once cards lose their outlines.
- The day trail's caption gets to wrap. `shrink-0 text-right` on it is what pushed the home page to
  808px wide at a 390px viewport.

## What each screen loses

**Today.** The floor becomes the one lifted card. The road quiets: hairline checkpoints, current
lesson unchanged. The trail stops overflowing.

**The loop.** Idle: the mode toggle stops being an ink block on a screen whose one job is Record,
and becomes a segmented control with a lifted thumb. Results: six cards at 12px spacing become the
hero on the ground, the coach bubble, the dimension card, one row of three tiles, then supply,
fillers and transcript as ground sections under eyebrows.

**Log.** Column heads take `.label-micro`, which gives the grids their slack back ("INDEX" at
11/0.14em was 44px in a 44px column). Score card flat, rows unchanged.

**You.** The level card is the lifted one. Every `stone-200` outline becomes `edge`. Sections move
to the 28 rhythm.

**Shop.** Item cards get the card grammar, so the freeze tile's outline inside an outlined card
stops being a double line.

## Not in this job

The elevation scale as levels 0 to 3, press-drop and release-spring (Job 2). Motion (Job 3).
Demos (Job 4). Copy is untouched.

## Open, for Timothy

The one tap stays a rectangle at 12. The reference read says Headspace puts its warmth in a pill
primary, and a pill would be the only shape of its kind on Today, which is what "one thing is
loud" wants. #201 chose rectangles over pills. Worth one experiment if you want it.
