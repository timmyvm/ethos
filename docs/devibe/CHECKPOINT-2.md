# Ethos — Checkpoint 2: what the migration did

Date: 17 Aug 2026 · Scope: the plan in `CHECKPOINT-1.md` §"Revised plan",
plus the design kit, `COPY-RULES.md`, and the `/you` and nav mockups.
Gallery: `compare.html` (28 pairs, mobile 390px and desktop 1440px).

## Where the plan landed

| Pass | Finding | State |
|---|---|---|
| 1. Resilience | 1, 2 | **Done** — rep loop, home, log, path, shop, profile |
| 2. Keyboard & a11y | 4, 5 | **Done** — global focus ring, `<Overlay>`, aria pass |
| 3. Dark-mode visuals | 3 | **Done** — two literal palettes kept, with reasons |
| 4. Road icons | 6 | **Half** — chrome drawn, the seven unit marks await a ruling |
| 5. Desktop shell | 7 | **Not started** — needs a decision first |
| — | 8 | Badge contrast done; paywall prices still open |

Two passes the plan didn't have: the copy budgets (`COPY-RULES.md`, which
arrived after Checkpoint 1) and the structural pass on `/you`, both driven
by the mockups.

## The audit, before and after

`bash scripts/audit-tells.sh`

| Section | 14 Aug | 17 Aug | Note |
|---|---|---|---|
| A. Banned palette | 0 | 0 | |
| A. Raw hexes | 52 | 48 | The 8 real ones are 4 now, all in `PoseSkeleton`, all deliberate (drawn over a camera frame) |
| B. Gradient/glow/glass/pulse | 0 | 0 | |
| C. Emoji in JSX | 51 | 48 | The remaining ones are ▲▼●→✓ data glyphs plus the seven unit emoji in `lib/path.ts` |
| C. Bounce easing | 5 | 3 | False positives (a variable named `anticipate`) |
| D. Generic copy | 0 | 0 | |
| E. TODO/placeholder | 19 | 18 | Input `placeholder=` attributes, plus the paywall prices |

Sections A–D are at zero for every check that measures a real tell.

## Definition of Done, per screen

| Screen | Empty | Loading | Error | Focus | Keyboard | Reduced motion |
|---|---|---|---|---|---|---|
| `/rep` | n/a | ✓ | ✓ retry re-sends the audio | ✓ | ✓ | ✓ |
| `/` home | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/history` | ✓ `<EmptyState>` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/path` | n/a | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/shop` | n/a | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/you` | ✓ | ✓ | ✓ page + two per-section retries | ✓ | ✓ | ✓ |

"Error" means the screen distinguishes *nothing yet* from *didn't load*
and offers a retry; every read is capped at 8s by `lib/load.ts`, so no
skeleton can outlive its data. Focus is the one global rule in
`globals.css`; keyboard on overlays is `<Overlay>`.

## What the gallery shows

Mobile pairs differ on `/you` (boxes gone, paragraphs gone), every screen
(tab bar icons), `/path` and home (drawn padlocks), and wherever a
sentence lost an em dash. **Desktop pairs look nearly identical, and
should**: the desktop shell is finding 7, still open. That is the biggest
remaining visual gap in the product.

No screen's element count went up. `/you` is the one that dropped hardest:
eight bordered cards to one, and two explanatory paragraphs to none.

## Checks

- `npx tsc --noEmit` — clean
- `npx vitest run` — 500 passing, including 114 copy-rule assertions
  (per-screen em-dash budgets, the "which is why" ban, one mantra per
  screen, the existing "confidence" ban)
- `npx next build` — clean

## Round two (17 Aug, same day)

Timothy's call on top of the passes above:

- **Zero em dashes**, replacing the budget of one (#154). The sweep
  covered the content libraries this time, so `lib/drills.ts`,
  `lib/pause-quality.ts` and `lib/presence.ts` are clean too, and the ban
  is in the coach's system prompt so generated copy obeys it.
- **Everything shorter.** 27 drills lost their long-form tips; the rep,
  settings, boss, log, profile and marketing screens each lost a
  paragraph's worth of prose. The rule under it: someone opened this app
  to speak, and every sentence they read first is one they didn't spend
  speaking.
- **The badges became a shelf** (#153): ranked by difficulty with no tier
  labels, a mark on each, and every row a link to the drill that earns
  it. Order is asserted in `achievements.test.ts`.

That closes item 3 of the list below, which was going to be the next
content pass.

## Next, in order

1. Timothy's ruling on the seven unit marks (`needs-judgment.md` §1).
2. The desktop shell (§2) — the last big visual lift.
3. Paywall prices (open queue since §4).
