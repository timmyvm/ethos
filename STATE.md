# STATE.md, the system on one page (25 Sep 2026)

Read this instead of `DECISIONS.md`. When the system changes, update this file; the log keeps the history.

## Visual system

One system, since #234: Instrument's structure carrying Organic's warmth, designed as one thing rather than layered. `docs/look/SYSTEM.md` is the spec, `docs/look/` holds the before and after gallery it was judged against.

- **The ground is plain since #289**, Timothy's call: white in light, neutral near-black in dark, in place of the cream and the amber-tinted dark. Light: ground #ffffff, surface #f4f4f4 (controls, tiles, inputs), raised #ffffff (cards, told apart by shadow and hairline). Dark: #121212, #1c1c1c, #262626. `.elev-1` a card, `.elev-2` the ONE lifted thing on a screen, `.elev-3` floating. Shadows are neutral black in both themes. The accents and the ink stay warm.
- **Two border jobs, two tokens.** `card-edge` (.09/.12) is a card's hairline under its shadow; `edge` (.14/.16) is a rule, a connector, an input's boundary; `hairline` (.08) separates list rows.
- **Rectangles over pills.** Chips are the only pills, Record the only circle, the nav the only square edge. Bars are square, trough and fill. The trough (`sand`) is #e4e4e4 light and #333333 dark (#287, #289), firm enough that a zero bar still reads as a trough.
- **Colour** unchanged from #203: terracotta #C67139 is the one tap per screen, the sage ramp is earned, deep sage is the score card and the paywall, warm near-black is the stage. Plum #62336c joined in #280 and means one thing: paid. One mark, `components/PremiumMark.tsx`, never a tap and never earned.
- **Picture colour** since #300, #305 and #311 to #315: tones that are ground, wash and label only, never a tap, never earned, never paid. **Trait tones** (`[data-trait]` → `--tone`, `--tone-wash`, `--tone-ink`; Pausing blue, Fillers pink, Restarts amber, Pace green, Variety violet since #317) go wherever a trait is shown, on Today, Lessons, Log and You alike, so a colour always means a trait and a trait always wears its colour; `lib/lesson-up-next.test.ts` and `lib/today-colour.test.ts` hold their contrast. The **introduction's tones** (`--pop-*`: sun, sky, mint, coral) are app-wide picture colour for stages and icon tiles (the boss card, the profile header, game tiles, freezes, lexicon labels); Demos never stands on coral, it is his coat. The recording flow's warm ground is an amber wash (the topic card, the tip tiles, the scoring panel, Today's first card). Earned marks use `--earned-gold` beside sage.

Today is the earned chips (stars, streak), the first card (the topic, the how, the why, each named), today's line on its trait's wash, the clean run (tappable, it opens the log), then the five traits as tiles in their tones, weakest first, each with a direction and a target from its norm (#267, #281, #293, #312). Practice (the tab, `/games`) is the boss card on a sky stage with Demos, the screen's one tap and its week state, then the doors, each with its own picture-tone tile, every row ending in the same arrow with the Premium chip beside it where the tap leads there (#292, #313). The Log (#314) and You (#315) wear the trait tones and the picture tones the same way. Lessons is its own page at `/lessons` (#305, #308): an Up next card carrying the page's one tap straight into the next practice (`lib/lesson-up-next.ts`), then the five traits, each a card with its tone's wash header and three rows (a 56px art thumbnail, the title, three segments that fill sage, the free-door arrow). The art is never a full-bleed hero, there or on `/lessons/[id]`. Unknown progress, loading or failed, is never drawn as zero. The eyebrow register is Outfit 11/700/0.10em uppercase.

## Tokens (`app/globals.css`, `lib/motion.ts`)

- Radius: `rounded-control` 12, `rounded-card` 16, `rounded-sheet` 20. No concentric arithmetic: a control keeps 12 wherever it sits.
- Dark: ground #121212, surface #1c1c1c, raised #262626, stage #0a0a0a, ink #f2f2f2. Light stage #1c1c1c.
- **The OS is the default** (#286, reverting #284). Three values: System, Light, Dark, with `system` resolved in two places that a test keeps identical, the inline boot script and `applyTheme`. `:root` declares `color-scheme` on the RESOLVED theme, so scrollbars and pickers stand in the same room whichever way it lands. The server sends no `data-theme`. Colour and motion both follow the OS until this device says otherwise.
- Text: `stone-500` secondary, `stone-400` muted, `stone-300` glyphs and dividers. `on-accent` is ink on terracotta.
- Type: Outfit 600/700/800 for numbers and UI, Figtree 400 to 700 for body. Roles: title 26/700, body 15/400, caption 12.5/400.
- Motion: 200ms ease-out default, 600 for celebration, and one motion meant to be watched: the spin (`SPIN`, 2.2s, `spinAt` in `lib/motion.ts`, #306). Classes `.arrive`, `.arrive-x`, `.reveal`, `.fill`, `.star-land`, `.sheet-panel`, `.sheet-scrim`, `.rec-ring`, `.dur-*`. Reduced motion is `data-motion="reduce"` on `<html>`. `.press` scales 0.985 and veils the fill on every pointer type.
- Elevation: `--shadow-1/2/3` and `.elev-1/2/3`. Type: two uppercase registers, `.label-data` (section eyebrow, and the tab bar's five labels since #287; the tab marks are filled on the active tab since #290) and `.label-micro` (column heads, chips, tile labels). Text sizes are body 15, caption 12.5, row title and control label 14/700, text link 13/600; numbers keep the display scale at 800, tabular.
- Rhythm, owned by the parent: section `mt-7`, eyebrow to content `mt-3`, row `py-3`, card to card `gap-3`, card `p-4`, hero `p-5`, screen `px-5 pt-7 pb-22`. Shared components carry no outer margin.
- Unit marks: `public/unit/<id>.webp`, one Demos pose per unit, cut and normalised by `scripts/cut-unit-marks.mjs` from `assets/demos-unit-*.png`. The road shows one, on the unit you are in.
- Lesson art: `public/lessons/<id>.webp`, fifteen risograph pieces at 900×585, cut by `scripts/cut-lesson-art.mjs`. Served by a plain `<img>` at that path, never `next/image` — the service worker pre-caches the file and could not pre-cache `/_next/image?url=…&w=…` (#274).
- Demos is 3D since #298: every pose re-rendered as a plush character, cutouts in `assets/3d/`, placed by `scripts/place-3d-demos.py` (the introduction's full-body set `public/demos-onboard-*.webp` on one baseline at one body height, the in-app 512 set, the unit marks, the splash head). The flat masters in `assets/` are history; `scripts/cut-pose.mjs` and the other flat cutters are for flat art only. A new pose is a Higgsfield render with the shipped 3D wave as the style reference. Loops, the one-shot nod, the disc and contact shadow live in `components/DemosArt.tsx`. Since #316 the large poses also play an idle clip over the still (`components/DemosClip.tsx`, `lib/idle-clips.ts`, `public/idle/*.webm|mp4`, built by `scripts/make-idle-clips.py`): colour stacked over alpha in a plain video, rejoined in WebGL, first and last frame equal to the still, so it only ever adds. On `/rep` he is only ever a full-body pose as a free figure, because the in-app busts are cut at the bottom. The app icon and favicon are the 3D head face on, on sky (#310, `scripts/make-icons.py`).
- Icons: `components/Icon.tsx`, 24px line set. Primitives: `components/ui/` (EmptyState, ErrorState, Overlay, Skeleton), plus ScoreCard, Nav, PathRoad, DayTrail.

## Screens

Since #317 the tab bar is floating frosted glass, icons only, with a sliding well (`.nav-glass`, `.nav-well`); Practice is Free tiles above a frosted Premium wall (`.premium-wall`), and lesson art is drawn (`LessonGlyph`), not the risograph webps.


Five tabs since #275: Today `/`, Lessons `/lessons`, Practice `/games` (Tools until #294), Log `/history`, You `/you`. The hrefs live in `lib/tabs.ts` and both `Nav` and `PageTransition` read them, because the second one used to keep its own copy and a tab missing from it slid in from the wrong side.

The app opens on a splash since #295: Demos's head on the bare ground (#296, `public/splash-demos.webp`) and the wordmark, once a tab, lifted after hydration with a 900ms floor (`components/Splash.tsx`, `SplashLift.tsx`). Automation never sees it; `?splash` forces it for the camera.

Off the bar: Shop `/shop`, the recording loop `/rep`, bosses, auth, the paywall sheet, Settings, and the introduction `/welcome`: three intro screens, seven questions (the name typed and first, the hour tapped and last) with one Demos beat before the hour, the plan built from the answers, and since #277 the account ask, which gates nothing and is skipped for a signed-in account. Since #299 the whole walk is a swipe carousel (left forward by Next's rule, right back, arrow keys too; screens arrive with `.step-in-next` / `.step-in-back`, 340ms) on coloured stages (#300). Since #288 Demos says every line from a speech bubble (`SpeechBubble`, `Says`: the words land one at a time, then he nods), Next waits for an answer on every question with Skip as the way past, the bar is one continuous fill with no count, and answers are 56px objects with a glyph, lit in terracotta when chosen. He replies in the bubble where an answer moves a number or a setting and nods where it does not. The reference is `docs/refs/duolingo-onboarding/`. Desktop is a 430px column in a cream void.

The recording loop (#301 to #304): `/rep` idle is the topic card (the prompt in display type, full-body Demos on its edge), one do-line, three tip tiles (glyph plus five words, sentence on tap, labels in `lib/tip-labels.ts`), a small Voice/Video pair, then Record. The scoring wait is `components/rep/ScoringStage.tsx` (length measured on the device, the recording's own waveform lit by the scan, the real stages stepping). Recording shows `components/rep/DemosHears.tsx`, the 3D listening pose driven by the meter's level. Results step 3's player has a header key and 44px play pills and no caption.

Google sign-in (#307): `lib/use-oauth-return.ts` owns the button's pending state on /signup, /signin and the introduction's account ask, and gives it back on any sign the person returned. `/auth/callback` tells a Google cancel, a taken Google account and an expired email link apart, and sends a cancel back to where it started (`ethos.oauth` in sessionStorage).

Every screen that hides the tab bar has a way off it, asserted in `lib/way-out.test.ts`: a bare route plus a back control that only renders when asked is how `/practice/<trait>` shipped a first screen with no exit (#279).

## The daily challenge (#281)

`lib/challenge.ts`. One line a day, in the weakest trait's own unit, drawn at the 30th percentile of the user's own trailing seven days by nearest rank: a number they already clear on about seven of every ten recordings. Self-referential, moves both ways, frozen inside a week (the window ends at this week's Monday), and absent entirely under three readings. The card is the behaviour channel and reads nothing from the outcome channel, which a test enforces. The ring is `tone="open"`, the tone reserved for it since #252. The prize is one coin for a week with five closed days (migration 0011), never one a day: the streak coin already fires for the same recording.

Not taken from `docs/closure.md`'s build list, with the inventory in #282: resumption (row 10), the comeback grant (row 11, the strongest-evidenced item in the document), the missed-day repair (row 14), the implementation intention (row 15) and rest mode (row 18).

## Lessons and the path (#269)

Two different things. **Lessons** are fifteen, three per trait, three practices each, chosen by the user; the last practice carries the free `no-notes` mod, because a lesson whose end needs a subscription is progress sold for money (#14). **The path** is `content/path.ts`, 120 pre-determined practices that the daily card draws from through `lib/next-practice.ts`, whose `choosePractice` ranks traits on the RAW measurement. The hidden tier is never rendered or named. Lesson progress is derived from `lesson_id` on recordings (`lesson:<id>:<n>`, `lib/lesson-progress.ts`), never stored beside them. A lesson practice's debrief offers the next practice of the same lesson, never the road's next unit (#273).

The road is demoted, not retired: `UNITS`/`DRILLS` still back the debrief fallback, the star map and six test files. The teardown inventory is in #272.

## Open, with the leaning answer. Take it unless Timothy says otherwise.

- The one tap is a rectangle at 12. A pill primary is the reference read (Headspace) and would be the only shape of its kind on Today; #201 chose rectangles. Worth one experiment.
- Desktop shell: same stage, constrained, side rail with Demos, streak and day trail.
- Home card shows the celebrate pose over a pose just bought: the equipped pose wins.
- `nextLesson` pins the floor to the first lesson under three stars: advance on any star, revisit for the missing ones.
- Paywall prices.
- Intermittent React #418 hydration error on `/`, `/rep`, `/history`: needs a root cause.

## Checks

`npx tsc --noEmit`, `npx vitest run`, `npx next build`. Build with `NEXT_DIST_DIR=.next-build` while a dev server is up, or the build takes the running server's chunks with it. `scripts/audit-tells.sh` is retired; the look loop replaced it.

Field numbers come from Vercel Speed Insights, mounted in `app/layout.tsx` (#285): LCP, INP and CLS from real phones, which is the only honest check on DESIGN.md's "speed is the loudest signal". The service worker skips `/_vercel/` so the telemetry script is never cached past a deploy.

The look loop has a camera: `scripts/look.mjs`. Start a dev server with the Supabase host mocked, then shoot every screen at 390px in both themes against three weeks of fixture practice.

```
NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs node scripts/look.mjs after today log
```

Five browser gates, all needing `PLAYWRIGHT_MODULE` and a server on 3123 (or `LOOK_BASE`): `scripts/check-onboarding.mjs` (72/72, the swipe included), `scripts/check-motion-layer.mjs` (12/12), `scripts/check-motion.mjs`, `scripts/check-lessons.mjs` (17 checks, the lesson flow end to end plus a failed read, the in-flight button and 320px), `scripts/check-google-return.mjs` (45/45, the Google round trip; `BASE` sets its server). While other work is editing the tree, run them against a production build on another port (`NEXT_DIST_DIR=.next-build npx next build`, then `npx next start -p 3124` with that dist dir) rather than the dev server, whose mid-edit recompiles fail them at random.
