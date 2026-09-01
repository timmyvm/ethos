# Handoff: Ethos — "Instrument" visual system (1b)

## Overview
A ground-up visual redesign of the Ethos app (timmyvm/ethos) in the **Instrument** direction: quiet paper, hairline rules, tabular digits as the hero, one amber tap per screen, olive for everything earned. All five tabs are covered: Today (home), Tools, Log, You, Shop. Mechanics, copy, and information architecture are unchanged from the shipped app — this is a reskin, not a rework.

## About the Design Files
`Ethos Instrument.dc.html` is a **design reference created in HTML** — a canvas of static screen mockups, not production code. Recreate these designs inside the existing ethos codebase (Next.js App Router, Tailwind v4 `@theme` tokens in `app/globals.css`) using its established patterns: semantic tokens, the `data-theme` mechanism, existing components (`Nav`, `PathRoad`, `DayTrail`, `Sparkline`, `Coin`, etc.). Do not ship the HTML.

## Fidelity
**High-fidelity.** Colors, type, spacing and copy are final. Recreate pixel-perfectly with the codebase's Tailwind tokens — replace the current Organic palette values in `app/globals.css` rather than adding a parallel system.

## Design Tokens

### Color (light theme — the only theme designed so far)
| Token | Value | Use |
| --- | --- | --- |
| ground/surface | `#faf8f3` | app background AND cards — surfaces are separated by hairlines, not fill changes |
| surface-raised | `#fffdf8` | nav bar, highlighted (current) cards |
| ink | `#191713` | primary text; also the dark score-card fill |
| text-secondary | `#6d675b` | body copy |
| text-muted | `#8a8272` | eyebrows, captions |
| text-faint | `#a39b88` | inactive nav, locked/dim |
| hairline | `#e7e2d7` | row separators |
| border | `#e0dacc` | card outlines |
| border-strong | `#d5cfc0` | glyph tiles, neutral buttons |
| track | `#ece6d9` | progress troughs |
| **action (amber)** | `#E0A800` | THE one tap per screen: CTA fill, current-node ring, coin progress bar. Ink text on it (`#191713`), never white |
| action-text | `#8a6a10` | amber-family text links ("keep them →", "Unlock full history →") |
| **earned (olive)** | `#47572f` | stars, streak, earned fills, leader trait bar, Buy button |
| earned-dim | `#9dab7d` | non-leader trait bars |
| earned-border | `#c3cda6` | olive outline buttons, XP chips |
| earned-wash | `#eef0e2` | "On your card" equipped state |
| on-dark caption | `#9a927f` | captions on the ink score card |
| on-dark delta | `#a9c37f` | ▲ delta + day-trail bars on the ink card |
| mascot | `#b05038` body, `#8f3d28` ears | Demos (use real webp assets, not the placeholder SVG) |

### Typography
- **Numbers + UI**: Outfit (Google Fonts). Weights 600/700/800. ALL numerals `font-variant-numeric: tabular-nums`.
- **Body copy**: Figtree 400–700.
- Eyebrow labels: 11px / 700 / letter-spacing 0.14em / UPPERCASE / text-muted.
- Hero digits: Outfit 800, tight letter-spacing (−0.02em): 58px (home score), 26px (screen h1 uses 24px), stat numbers 18–30px.
- Nav labels: 11px / UPPERCASE / 0.06em; active = ink + weight 800, inactive = text-faint + 600.

### Shape & elevation
- Cards: 12–16px radius, 1px `border` outline, **no shadows** anywhere in-app.
- Buttons: 10–12px radius (rectangles, NOT pills — this replaces the Organic full-round language).
- Progress bars and day-trail: **square-cornered** bars (height 5–6px; trail bars 8×16px, today 8×22px with 1px outline offset 2px).
- Current/highlighted item: `1.5px solid #E0A800` border on `#fffdf8`.
- Lists: hairline-separated rows on the ground, not boxed cards (log rows, game rows, lexicon, traits).

## Screens

### 1. Today (`app/page.tsx`)
- Header: "ETHOS" wordmark (Outfit 800, 19px, 0.02em) left; right: `★ 12` and `STREAK 6` as plain olive text (13px/600) — no pill backgrounds.
- Lesson block under a hairline: eyebrow `TODAY'S LESSON · THE PAUSE`, title 26px/700, prompt in Figtree 14px secondary, decay note 12.5px muted.
- CTA row: amber button (flex:1, 14px padding, 12px radius, ink text 15px/700) beside Demos art 52px.
- Sub-links: "Not feeling it? Spin a new topic →" / "Make it harder" — 13px/600 action-text.
- Score card: ink-filled (#191713), 16px radius, cream text; eyebrow + `▲ +131 SINCE DAY ONE` (on-dark delta); 58px score + `/ 1000`; recordings + stars as small right-aligned stats; hairline (#35302a) above the square day-trail bars + "Day 12 of speaking · best day yet".
- Anon gate: centered 12px muted line, amber-text link.
- The road: eyebrow `THE ROAD`; vertical list — completed rows (olive number + 3★), current lesson in the amber-bordered card, unit checkpoint between 1px ink rules, future rows at 40% opacity; footer line "29 lessons, end to end…".
- Bottom nav on `#fffdf8` with hairline top: TODAY ● / TOOLS ◆ / LOG ▤ / YOU ◉ (keep existing `Icon.tsx` marks at 21px; the glyphs in the mock are placeholders).

### 2. Tools (`app/games/page.tsx`)
- h1 "Tools" 24px/800.
- Boss card = the screen's ONE amber element: 1.5px amber border on `#fffdf8`, Demos 46px, eyebrow `THIS WEEK'S BOSS` in action-text, name + blurb, → in action-text.
- Games as hairline rows (NOT boxed): 38px bordered glyph tile (10px radius, border-strong), name 14.5px/700, blurb Figtree 12.5px secondary, XP chip = olive outline pill `×2 XP` (only when multiplier > 1).
- Section eyebrows: `GAMES · REAL REPS, ROLLED CONDITIONS`, `MORE DOORS` (Hostile Q&A, Upload a recording — same row grammar with →).

### 3. Log (`app/history/page.tsx`)
- h1 "The log", count line in Figtree muted.
- Sparkline cards: bordered 12px-radius, eyebrow + range (`512 → 643` olive 13px/700), 48px line — olive stroke for Ethos Index, `#9a927f` for fillers/min.
- Presence (free tier): same card, blurb + `PRO` outline chip — no padlock.
- `WHAT THE NUMBERS SAY`: eyebrow + plain Figtree insight text on the ground (no box).
- `EVERY RECORDING`: hairline rows — date column (mon eyebrow + 18px day), score 16px/800 + `/1000`, meta line Figtree 12px muted (`4 fillers · 132 wpm · 4 held · 84s`), olive stars right (earned solid, rest border-strong).
- Archive gate: hairline-framed row, "10 older recordings archived." + amber-text "Unlock full history →".

### 4. You (`app/you/page.tsx`)
- Header: "You" + Settings link (muted).
- The ONE card: name row (18px/800 + Edit), Demos 48px, `LEVEL` eyebrow in olive + 30px number, `TOTAL XP` right; olive square progress bar + `310/500 TO LEVEL 5` caption.
- Stats: three bare columns (STREAK/LONGEST/THIS WEEK), 24px numbers, no boxes.
- `TRAITS`: label 92px, square 5px track, leader bar olive, others earned-dim, unleveled at faint with border-strong bar; right-aligned level numbers.
- `COINS`: balance 26px + `1 A DAY`; right `3` + `TO THE FIRST ITEM`; **amber** square progress bar (the only amber on this screen); "Open the shop" bordered rectangle button.
- `YOUR LEXICON`: hairline rows `struck-through original → bold upgrade`; olive outline button "Test yourself on these →".
- Keep freezes/earned shelf/share card sections in the same grammar (hairline rows, olive-earned/faint-locked washes → use bordered tiles instead of washes).

### 5. Shop (`app/shop/page.tsx`)
- "← You" back link muted; "Shop" + coin ring (2px amber circle) + 20px balance; "One coin a day you speak." Figtree secondary.
- Item cards: bordered 14px radius; 46px art (Demos webp / olive-bordered freeze tile); name 15px/800 + price `◦ 14` tabular right; blurb Figtree 12.5px.
- Button states: **Buy** = olive fill `#47572f` + paper text; **can't afford** = border-strong outline, muted text, `N more to go`; **equipped** = earned-wash fill + earned-border, "On your card"; owned-but-not-equipped = olive outline, "Put it on the card".
- Footer line: "Nothing here buys a star, a streak, or a score." — 12px muted, centered.

## Interactions & Behavior
Unchanged from the shipped app — this redesign touches classNames/tokens only. Keep: press/lift micro-interactions (`lib/motion.ts`) but tune lift to a border-color shift instead of shadow (system has no shadows); skeletons/error states per existing `ui/` components restyled to these tokens; paywall triggers; one-amber-tap-per-screen rule replaces the one-terracotta-tap rule everywhere brand.md enforces it.

## State Management
None new. All data flows (`fetchReps`, `syncFreezes`, `syncCoins`, etc.) unchanged.

## Assets
- Demos webp poses already in `/public` (demos.webp, -celebrate, -workout, -speaking, -listening, -asleep). The flat SVG panda in the mock is a stand-in only.
- Fonts: Outfit + Figtree via Google Fonts (replaces the current display/body pairing).

## Not yet designed
Rep flow (recording + results steps), dark theme, paywall, onboarding, settings, boss/hostile screens. Extend by the token table above; ask the designer before inventing new accents.

## Screenshots
`screenshots/01-home.png … 05-shop.png` — 2x captures of each screen, in tab order.

## Files
- `Ethos Instrument.dc.html` — all five screens, side by side (open in a browser).
