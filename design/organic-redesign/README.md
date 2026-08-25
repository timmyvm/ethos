# Handoff: Ethos redesign — Organic theme (light + dark)

## Overview
A visual redesign of Ethos (timmyvm/ethos, Next.js + Tailwind) — the daily speech-practice gym — onto the "Organic" design language: Caprasimo display headings over Figtree body, warm cream ground with a terracotta primary and a sage second accent, over-rounded pill/pebble shapes. Four screens in two themes: Home ("The Floor"), Games, You (profile), Shop. Product mechanics, information architecture, and copy register are unchanged from the repo; this is a reskin plus loosened (warmer) copy.

## About the Design Files
`Ethos Remake.dc.html` is a **design reference created in HTML** — a canvas gallery of static screen mockups, not production code. Recreate these designs inside the existing ethos codebase (Next.js App Router, Tailwind v4 `@theme` tokens in `app/globals.css`) using its established patterns: semantic tokens (`--color-ground/surface/ink`), the `data-theme="dark"` root attribute, existing components (`Nav`, `PathRoad`, `StreakBadge`, etc.). Do not ship the HTML.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii and copy below are final intent. Recreate pixel-perfectly, but express values through the codebase's token system rather than hardcoding.

## Design language (what changed vs. current app)
1. **Type**: display face becomes **Caprasimo** (weight 400 — it has one weight; do not fake-bold) for wordmark, drill titles, all hero numbers and section titles. Body becomes **Figtree** (400/600/700/800). Replaces Fraunces + Inter + Space Mono. Data labels are no longer mono: Figtree 700, 10.5–11px, uppercase, letter-spacing .12–.14em.
2. **Color roles**: terracotta stays the ONE tap per screen (unchanged rule). **Everything "earned" (stars, XP, held pauses, freezes ready, trait leader) moves from amber to sage** so terracotta is purely "tap here". Amber is retired.
3. **Shape**: over-rounded. Cards 24–28px radius, buttons and inputs full pills (999px), path nodes and day-trail dots are circles ("pebbles" — Demosthenes motif).
4. **Elevation**: light theme uses soft warm shadows; **dark theme uses NO shadows** — depth comes from surface steps + 1.5px hairline borders.
5. **The score card** ("Your ethos") is deep sage, not near-black stage — the second focal point on Home in both themes.

## Design tokens

### Light theme
| Token | Value | Use |
| --- | --- | --- |
| ground | #f5ead8 | app background |
| surface | #faf3e3 | cards, nav bar |
| track | #ecdfc4 | progress-bar troughs, empty freeze slots |
| ink | #201e1d | primary text |
| ink-60 | rgba(32,30,29,.6) | body/secondary (.55–.62 range used) |
| ink-45 | rgba(32,30,29,.45) | data labels, faint |
| hairline | rgba(32,30,29,.08) | borders (1.5px) |
| accent (terracotta) | #c67139 | the one CTA fill, current-node ring, coin progress |
| accent-100 | #f6ddc9 | streak pill bg, boss card bg, warm icon wash |
| accent-700 | #8f4d24 | active nav tab, "up next" |
| accent-800 | #7c4220 | text on accent-100 |
| sage | #7a8a5e | earned fills: 3-star nodes, XP bar, trail dots, top trait bar |
| sage-100 | #eef0e2 | sage icon wash, "on your card" bg |
| sage-200 | #dde3cb | partial-star node bg |
| sage-300 | #c3cda6 | outline-button borders, dim trait bars |
| sage-700 | #4c573a | section eyebrow labels, sage icon ink |
| sage-800 | #3d4630 | text on sage washes, XP tag ink |
| sage-900 (score card) | #2f3624 | "Your ethos" card bg |
| cream-on-accent | #fdf6e7 | text on terracotta/sage fills |
| card shadow | 0 6px 18px rgba(122,90,50,.10) (hero); 0 2px 6px rgba(122,90,50,.12) (sm) | light theme only |

### Dark theme (warm — never pure black, never cool grey)
| Token | Value | Use |
| --- | --- | --- |
| ground | #211a13 | app background |
| surface | #2d241b | cards, nav bar |
| track | #3b2f22 | progress troughs, empty slots |
| ink | #f3ecdd | primary text |
| ink-55 | rgba(243,236,221,.55) | secondary (.5–.58 range) |
| ink-45 | rgba(243,236,221,.45) | labels, faint |
| hairline | rgba(243,236,221,.08) | card borders (1.5px) — replaces shadows |
| accent | #c67139 | unchanged (CTA fill, ring, coin bar) |
| accent-wash | #3f2716 | streak pill, boss card (+ border rgba(230,180,140,.18) on boss) |
| accent-text | #e6b48c | active nav, delta ▲, boss body text, streak pill ink |
| sage-lifted | #8a9b6b | earned fills (dots, XP bar, 3-star node, Buy button — with #211a13 ink) |
| sage-wash | #343c27 | icon washes, "on your card", ready freeze |
| sage-dim | #4a5536 | dim trait bars, outline-button borders, score-card border |
| sage-text | #c3cda6 / #aab88a / #b6c19c | sage-tinted text: tags/buttons / eyebrows / score-card captions |
| score card | #313a24, border 1.5px #4a5536 | "Your ethos" card |

### Type scale (both themes)
- Wordmark "ethos": Caprasimo 25px
- Page titles (Games/You/Shop): Caprasimo 27–29px
- Drill title: Caprasimo 31px, line-height 1.08, max-width 76%
- Hero score: Caprasimo 58px, line-height .9; "/1000" 13px beside it
- Stat numbers: Caprasimo 25–27px; small stats 19–21px
- Section titles (Traits, Coins…): Caprasimo 16.5px
- Body: Figtree 13.5–14px / 1.5–1.55; row titles 14.5–15px weight 800; blurbs 12.5px / 1.45
- Eyebrow/data labels: Figtree 700, 10.5–11px, uppercase, tracking .12–.14em
- Nav labels: 12px, weight 600 (700 active)

### Spacing & radii
Phone width 390px. Screen padding 22–24px sides; cards inset 18px from screen edge. Card padding 16–26px. Card radius 24–28px; small tiles 20px; pills 999px. CTA padding 16px 24px (16.5px/700 label); secondary pills 11–12px 20px (13.5–14px/800). Nav: border-top hairline, surface bg, 4 equal flex tabs, icon 21px above 12px label, padding 10px 8px 16px.

### Icons
Lucide-style strokes at **stroke-width 2.75**, round caps/joins. Used: flame (streak), sun (Today), zap (Games), book (Log), person (You), snowflake (freezes), arrow-right. The path gate is a custom 96×72 stroke SVG (from repo `PathRoad.tsx` Gate, closed state) drawn at 2.75.

## Screens

### 1. Home — "The Floor" (1a light / 2a dark)
Top → bottom:
1. **Header row**: wordmark left; streak pill right (flame icon + "12 days"; accent-100/accent-800 light, #3f2716/#e6b48c dark).
2. **Lesson eyebrow**: "TODAY'S LESSON · HOLD THE SILENCE" (sage-700 / #aab88a) + one-line reason under it in ink-60: "Your pauses have been landing mid-sentence lately. Today is about putting them where they belong." (from `lib/schedule` nextFocus.reason).
3. **Floor card** (surface, radius 28, hero shadow light / hairline dark, padding 26px 24px 84px): Caprasimo title "Explain it like they're five."; prompt (max-width 66%, ink-60): "Pick something you love. Make a five-year-old care about it. You get sixty seconds."; full-width terracotta pill **"Take the floor"** (the screen's only terracotta fill; light adds glow shadow 0 6px 16px -4px rgba(198,113,57,.55)); Demos (`/demos.webp`) absolute right:-6 bottom:-14, width 126px, peeking over the corner, pointer-events none.
4. **Spin line** (plain text button, ink-55): "Not feeling it? Spin a new topic →"
5. **Score card** (sage-900 light / #313a24+border dark, radius 28): eyebrow "YOUR ETHOS" (#b6c19c); "612" 58px + "/1000"; delta "▲ +48 since day one" in accent-text (#e6b48c dark, accent-300 #e6b48c-equivalent light); right column: 23 / RECORDINGS, 31 / STARS; **day trail**: 14 × 14px circles, gap 5px — spoken day = sage fill (#7a8a5e light, #8a9b6b dark), frozen day = transparent + 1.5px sage-300 border, missed = rgba(255,255,255,.12) (light) / rgba(243,236,221,.14) (dark); caption "Day 23 of speaking. The pebbles are adding up."
6. **The road** (on ground, not carded): header row "THE ROAD" + "31 of 84 stars"; vertical winding nodes (x-offsets cycle ±40/8/46/6px): done ★3 = sage fill circle 46px; partial ★2 = sage-200 bg + sage-800 ink; **current** = 56px surface circle + 2.5px terracotta ring + label "Hold the silence / up next" (up-next in accent-700); future = surface + hairline, ink-35; then the closed **gate** SVG + "Pace & rhythm · opens at 36 stars · 5 to go".
7. **Bottom nav**: Today active (accent-700 light / #e6b48c dark).

### 2. Games (1b / 2b)
1. Title "Games" + subhead "Every door here opens onto a real rep. The question comes when you're already on the floor."
2. **Boss card** (accent-100 light / #3f2716 + rgba(230,180,140,.18) border dark, radius 26): demos-workout.webp 52px left; "This week's boss: Cold Topic" 15px/800; blurb in accent-800 (light) / #e6b48c (dark): "A topic you've never touched. Four minutes to read, ninety seconds to explain it back — fact-checked."; arrow-right icon.
3. **Game rows** (surface, radius 24, gap 10): 42px circle glyph badge (Caprasimo glyph; alternating accent-wash and sage-wash) + name/blurb + optional XP pill (sage-100/sage-800 light, #343c27/#c3cda6 dark):
   - "60" · Sixty smooth seconds · "One take, zero fillers. How far can you get?" · ×2 xp
   - "↺" · Argue the other side · "Your own opinion, flipped. Convince us anyway." · ×2 xp
   - "½" · Retell it tighter · "Same story, half the words. Keep the point." · (no tag)
   - "◦" · Pebble mouth · "Over-enunciate everything. Demosthenes approved." · ×3 xp
4. Footnote (ink-45, 12px): "Games pay XP, never stars. Stars are only ever earned on the road."
5. Nav: Games active.

### 3. You (1c / 2c)
1. Header: "You" + "Settings" link (ink-50).
2. **Level card** (surface, radius 28): 64px sage-wash circle cropping demos-listening.webp (align bottom); name "Timothy" Caprasimo 21px; eyebrow "LEVEL 6" in sage; right "1,240 / TOTAL XP"; **XP bar** 10px pill trough (track) with sage fill 62%; caption "186 / 300 to level 7 · XP is effort, never money".
3. **Stat trio** (no boxes, on ground): STREAK 12 days · LONGEST 17 days · THIS WEEK 140 xp (label 10.5 / Caprasimo 25 / note 11.5).
4. **Traits** (section title): 5 rows — Composure 7 (100%, sage, leader), Pace 5 (71%), Clarity 4 (57%), Compression 2 (29%), Accuracy 0 (dim ink) — bars 8px pills, dim bars sage-300 (light) / sage-dim (dark); only the leader gets full sage.
5. **Coins**: header + right-aligned label "1 A DAY YOU SPEAK"; coin-stack.svg 42px + "18" + right "7 / TO THE FREEZE"; terracotta 8px progress bar at 72% (the only terracotta on this screen apart from active nav — acceptable: it points at the next buyable, not a tap).
6. **Streak freezes**: 38px circles — ready = sage-wash + sage ink snowflake, empty = track + faint; caption "One ready. A frozen day keeps the streak alive — it still doesn't count as speaking."
7. **Your lexicon**: rows "really good → compelling", "sort of shows → demonstrates", "a lot of people → most of us" (struck original ink-45, arrow ink-35, upgrade 800); hairline row dividers; outline sage pill "Test yourself on these →".
8. Nav: You active.

### 4. Shop (1d / 2d)
1. "← you" back link; header row "Shop" + coin.svg 24px + "18".
2. Intro: "One coin for every day you speak. Nothing here buys a score — the numbers stay honest."
3. **Item cards** (surface, radius 26): 58px art tile (snowflake in sage-wash, radius 20; or Demos pose webp) + name + price (coin.svg 15px + Caprasimo 16px) + blurb; then full-width pill:
   - Streak freeze · 25 · "Covers one missed day. The streak holds; the day still doesn't count as speaking." → **Buy** = sage FILL (#7a8a5e/#fdf6e7 light, #8a9b6b/#211a13 dark). Deliberately not terracotta (repo rule: a shop has many actions; buy is a door, not the one tap).
   - Demos, celebrating · 30 · "A pose for your floor card. Buys nothing but joy." → outline pill "12 more coins" (disabled state: sage-300/sage-800 light, sage-dim/#c3cda6 dark).
   - Demos, mid-workout · 30 · "He trains too. On your card, he never skips a day." → equipped state pill "On your card ✓" (sage-100/sage-800 light, sage-wash/#c3cda6 dark).
4. Nav: You active.

## Interactions & behavior (intent — mocks are static)
- All existing repo behavior stays: routing, streak/freeze sync, paywall, mods, roulette. This redesign adds no new mechanics.
- Press states: existing `.press` scale(0.985) on touch; hovers shift fills one ramp step (terracotta #c67139→#b2432c; sage #7a8a5e→#6b7a51-ish).
- Focus: `:focus-visible` 2px terracotta outline, offset 2px (already in globals.css — keep).
- Dark mode via existing `data-theme="dark"` toggle in Settings; re-map the semantic tokens per the dark table above. Disable `.lift*` shadows and body grain in dark (repo already does); add 1.5px hairline borders to cards in dark.
- Reduced motion: keep repo's existing prefers-reduced-motion rules.

## State management
No new state. Screens read the same data as today: reps → streak/trail/road stars, XP/level, coins ledger, freezes, lexicon, shop ownership/equipped pose.

## Implementation notes for the ethos codebase
- Swap `next/font` faces: Caprasimo (display, weight 400) + Figtree (body). Remove Space Mono; `.label-data` becomes Figtree 700 uppercase tracked (keep the class name).
- Update `@theme` in `app/globals.css`: replace cream/sand/stage values with the token tables above; add a sage ramp (`--color-sage-*`); retire amber usages in favor of sage (`StreakBadge`, `PathRoad`, XP bars, `PauseBar` earned segments, freeze slots, trait leader).
- `PathRoad`: nodes become the pebble treatment above; gate stroke-width 1.5→2.75.
- Score card (`app/page.tsx` "Your Ethos" section): `bg-stage` → deep sage token; captions #b6c19c.
- Icons (`components/Icon.tsx`): raise stroke-width to 2.75.
- Radii: 18→24-26 for cards, 26→28 hero cards, buttons 14/15→999px pills.

## Assets (bundled in `public/`)
From timmyvm/ethos@main `public/`: demos.webp, demos-celebrate.webp, demos-listening.webp, demos-speaking.webp, demos-workout.webp, demos-asleep.webp, coin/coin.svg, coin/coin-stack.svg. Caprasimo + Figtree load from Google Fonts.

## Files
- `Ethos Remake.dc.html` — the design gallery. Section id `t2` (top) = dark screens 2a–2d; section `t1` = light screens 1a–1d. Open in a browser; each option card is one 390px phone screen. (It references `_ds/organic-…/styles.css` for fonts/tokens; the hex fallbacks inline in every style attribute are authoritative if that path is absent.)
- `github.md` — source-repo mapping (screens → repo files).
