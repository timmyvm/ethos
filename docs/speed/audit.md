# Speed audit: the baseline (18 Nov 2026)

Timothy, 18 Nov: "I wanna really optimise for speed like really well." This is the measure before anything changes: what a phone on mobile data waits for, where each second goes, and the fixes ranked by what a person on an iPhone feels. No app code changed to make it. The numbers are in `docs/speed/baseline.json`; `scripts/measure-speed.mjs` makes them again against any build.

## The waits

| The wait | Now, phone on mobile data | Where it goes | First fix |
|---|---|---|---|
| **Today, the day's first open** (the app on the phone, its code cached, yesterday's token) | **2.6 s** to a drawn Today | 460 ms waiting on the network for a page the worker already holds; the JS run from cache; then the token refresh (a preflight and a POST, 725 ms here) before any read can leave; then a preflight and the reads | a longer access token (9); the page from the worker (4); Today's numbers kept on the phone (5) |
| **Today, a later open the same day** | **1.6 s** | the same, without the refresh | the same |
| **Today, a first open** (nothing cached; the installed app shows the splash) | **5.5 s** in a tab; the app's splash lifts at 4.3 s onto a skeleton, Today drawn at 5.5 s | 569 KB of JS before anything is live, then the reads, sharing the link with the service worker's 1.27 MB install | zod out of the client (2); the worker's install after the first screen (3) |
| **Tab to tab** | 49 ms to 186 ms; You the first time **649 ms** | quick because each tab is prefetched and draws what the visit already read; You's first open waits on reads Today never made, each behind a preflight | You's reads held from Today's (12) |
| **The wait after Stop** (60 s take) | **10.3 s** before the server hears the take; Whisper and Claude after that | the take is recorded at 128 kbps: 897 KB a minute over a 750 kbps uplink | record speech at 32 kbps (1): 170 KB, heard at 2.5 s |
| **The room's first frame** (first open) | **3.7 s**; from the home-screen icon (`/`) **4.7 s** | the server sends an empty `<main>`; nothing is drawn until 415 KB of JS has run; `/` loads Today's JS first, then redirects | the door drawn by the server (13); the redirect before Today's JS (14) |

## How this was measured

`scripts/measure-speed.mjs` against a production build of this worktree (`54204ca`, `next start`), Chromium 153.0.8010.12 at 390x844 and 3x with an iPhone user agent, the CPU slowed 4x through CDP. Every request goes through a proxy in the script that is the phone's mobile data: each request held for a 150 ms round trip, two more for a new connection's handshake, and 1.6 Mbps down and 750 kbps up shared between everything in flight. The proxy, not CDP's throttle, so the service worker's own fetches are slowed too and the bytes are counted on the wire. Supabase is the look loop's mock (`scripts/look-fixtures.mjs`, three weeks of practice), answered by the proxy after 40 ms of server time and cut to the columns each read selects, as PostgREST does. Medians of 3 runs.

- **Cold**: empty cache, no service worker, a returning account's storage (signed in, introduction done). **Warm**: the same screen opened again in the same browser with the worker installed (a new connection, as the next open of the app is).
- **ready** is the first frame in which the screen's own data is drawn and React has taken the page over (no skeleton, the screen's mark of its data present; `READY` in the script). FCP and LCP are the browser's.
- **Tabs and doors** are timed in the page from the tap to the destination's ready frame.
- **The wait after Stop** is the recorder's own send (`Accept: application/x-ndjson`) over the link, to a second server whose Whisper, Claude and Supabase are stubs with set delays (`scripts/speed-stubs.mjs`: Whisper 6.0 s, Claude 12.0 s, Supabase 20 ms). The stubs time the route's own waiting exactly; Whisper's and Claude's real times are estimates until production logs them (needs Claude, below).

What this does not capture, each a reason the phone may be faster or slower: the link is HTTP/1.1 (six connections a host) where Vercel serves HTTP/2, which slightly penalises the many small chunks; the container's CPU slowed 4x is not an iPhone (a recent iPhone parses and hydrates faster, so those costs here are on the slow side); real Supabase may answer preflights with a long `Access-Control-Max-Age` (the mock sends none, so Chrome keeps each for 5 s); the function and Supabase regions are unknown (needs Claude). Another agent shared the machine's four CPUs during the runs.

To run again:

```
NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon NEXT_DIST_DIR=.next-build npx next build
NEXT_DIST_DIR=.next-build npx next start -p 3951 &
# the wait after Stop needs a second, stubbed server (see scripts/speed-stubs.mjs for its env)
LOOK_BASE=http://localhost:3951 STOP_BASE=http://localhost:3952 STUB_LOG=/tmp/stubs.jsonl \
  PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs node scripts/measure-speed.mjs after-<fix>
# one scene or a few screens, kept beside the rest: ONLY=routes ROUTES=today,you MERGE=1
```

## 1. JS per route

Every page loads the root layout's JS before it can do anything; the pages that matter carry twice that again. Bytes from `.next-build` (gzip 9, the wire is within a few per cent).

| Route | JS gz | JS raw | beyond the layout (gz) |
|---|---|---|---|
| every page (root layout) | 225.7 KB | 762.6 KB | – |
| `/` | 425.4 KB | 1449.4 KB | 199.7 KB |
| `/rep` | 482.8 KB | 1629.5 KB | 257.1 KB |
| `/rep/[id]` | 422 KB | 1439.1 KB | 196.3 KB |
| `/welcome` | 409.1 KB | 1398.9 KB | 183.4 KB |
| `/history` | 400.6 KB | 1379.6 KB | 175 KB |
| `/hostile` | 368.1 KB | 1283.6 KB | 142.4 KB |
| `/lesson/[unit]` | 369.8 KB | 1286.5 KB | 144.1 KB |
| `/you` | 327.3 KB | 1035.3 KB | 101.6 KB |
| `/games` | 303.9 KB | 966.1 KB | 78.2 KB |
| `/boss` | 291.2 KB | 933.3 KB | 65.5 KB |
| `/settings` | 285.4 KB | 913.2 KB | 59.8 KB |
| `/lessons` | 263.5 KB | 854.8 KB | 37.8 KB |
| `/shop` | 254.2 KB | 833.9 KB | 28.5 KB |
| `/signin` | 236.8 KB | 792.2 KB | 11.1 KB |

Next's own table under-reports: it leaves out the root layout's chunks (it prints `/calibrate` at 120 KB; the browser fetches 235). What weighs most, attributed from a source-map build of the same code:

- **zod, 358 KB raw (chunk `6434`, 90 KB on the wire, 385 KB to parse), on Today, the recorder, a stored recording, the Log, the introduction, Hostile and the unit page.** Nothing in the browser parses with it except Hostile's record in the games log. It arrives through `lib/hostile.ts` (`import { z } from "./zod"` for `QuestionSchema`, `HostileVerdictSchema` and `HostileRecordSchema`), which the client imports for its constants: Today through `lib/home-modes.ts`, the Log through `lib/log.ts` and `lib/games-log.ts`, the recorder through `components/ComparisonCard.tsx` and `lib/log.ts`, the introduction through `lib/practice-family.ts` and `lib/log.ts`. `z` is one namespace object, so none of it shakes out.
- **The Supabase client, 209 KB raw in the layout**: auth-js 101, realtime-js 31, phoenix 25, storage-js 21.5, postgrest-js 15, supabase-js 10, iceberg-js 5. The browser never opens a channel or touches storage (`grep` finds `.channel(` and `.storage` only in server files), so realtime, phoenix, storage and iceberg (83 KB raw) ride along unused because `lib/supabase-browser.ts` calls `createClient`.
- **Next and React, 237 KB raw** (`0937d497`, `89`): the floor.
- **`lib/topics.ts`, 28 KB raw, in the layout**: `components/CommandMenu.tsx` imports `commandsAllowed` and `tabForKey` from `lib/commands.ts`, which imports `content/lessons.ts`, which imports the 365 topics. A phone never opens the command menu.
- **The layout's quiet components**: `components/AuthNote.tsx` pulls `lib/auth-landing.ts`, `lib/answers-sync.ts`, `lib/portfolio.ts`, `lib/path.ts`, `lib/drills.ts` and `lib/client-data.ts`; `components/GoogleTakenSwitch.tsx` pulls `lib/auth.ts` (12 KB); `components/tester/TesterLayer.tsx` and `lib/tester-boot.ts` pull the tester copy. Each renders nothing on almost every open.
- **The paywall on every tab**: `components/Paywall.tsx` (10.6 KB raw), `components/ui/Overlay.tsx` (9.7), `components/premium/Stair.tsx` (7.6) and `components/premium/PlanCard.tsx` (5.8) are imported eagerly by Today, the Log, You, Practice and the recorder, and shown only on a tap.
- **`/rep` is the heaviest page** (482.8 KB gz): `app/rep/page.tsx` alone is 48 KB raw, `components/RepResult.tsx` 22, `lib/carried-cue.ts` 13, `lib/glance.ts`, `components/WordSheet.tsx`, `components/rep/RoundCard.tsx` and `lib/round-copy.ts` 9 each: the results' code loads before Record can be pressed.
- **41 of 50 pages are `"use client"` at the top.** Every tab reads its data in the browser after hydration, so the server's HTML is a skeleton: fast to arrive, and nothing the person came for can be drawn before the JS has run.

## 2. Load per route

Cold and warm, medians. "On the wire to ready" is every byte the link carried before the ready frame.

| Screen | TTFB | FCP | LCP | ready | TBT | CLS | on the wire to ready (JS) | warm FCP | warm ready | warm bytes |
|---|---|---|---|---|---|---|---|---|---|---|
| today `/` | 456 ms | 1.4 s | 6.4 s | **5.5 s** | 460 ms | 0 | 935 KB (569 KB) | 708 ms | **1.6 s** | 97 KB |
| recorder `/rep?ready=1` | 458 ms | 1.3 s | 4.2 s | **4.2 s** | 385 ms | 0.03 | 643 KB (503 KB) | 660 ms | **924 ms** | 13 KB |
| result `/rep/rep-22` | 473 ms | 1.3 s | 4.8 s | **4.7 s** | 527 ms | 0 | 799 KB (534 KB) | 660 ms | **1.7 s** | 48 KB |
| log-daily `/history` | 461 ms | 1.4 s | 5.1 s | **4.9 s** | 465 ms | 0 | 843 KB (525 KB) | 756 ms | **1.7 s** | 80 KB |
| log-games `/history?view=games` | 458 ms | 1.4 s | 4.8 s | **4.2 s** | 391 ms | 0 | 772 KB (480 KB) | 764 ms | **1.4 s** | 86 KB |
| you `/you` | 457 ms | 1.4 s | 3.5 s | **5.5 s** | 760 ms | 0.032 | 953 KB (549 KB) | 868 ms | **2.5 s** | 93 KB |
| lessons `/lessons` | 457 ms | 1.5 s | 4.8 s | **4.2 s** | 295 ms | 0 | 812 KB (389 KB) | 724 ms | **1.9 s** | 85 KB |
| practice `/games` | 461 ms | 1.3 s | 3.3 s | **3.9 s** | 293 ms | 0.001 | 844 KB (339 KB) | 720 ms | **1.9 s** | 94 KB |
| boss `/boss` | 458 ms | 1.5 s | 2.2 s | **3.4 s** | 235 ms | 0 | 558 KB (311 KB) | 668 ms | **909 ms** | 12 KB |
| hostile `/hostile` | 459 ms | 1.5 s | 2.0 s | **3.9 s** | 318 ms | 0 | 625 KB (388 KB) | 936 ms | **1.2 s** | 12 KB |
| settings `/settings` | 459 ms | 1.3 s | 1.3 s | **3.8 s** | 345 ms | 0.008 | 644 KB (367 KB) | 752 ms | **1.7 s** | 100 KB |
| shop `/shop` | 458 ms | 1.3 s | 6.0 s | **5.4 s** | 265 ms | 0 | 964 KB (537 KB) | 752 ms | **2.7 s** | 86 KB |
| signin `/signin` | 459 ms | 1.3 s | 4.1 s | **4.1 s** | 277 ms | 0 | 688 KB (402 KB) | 836 ms | **1.6 s** | 72 KB |
| today-next-day `/` | 460 ms | 1.3 s | 6.9 s | **6.2 s** | 471 ms | 0 | 1.07 MB (617 KB) | 788 ms | **2.6 s** | 97 KB |

Bytes and requests by type on the cold open, to the ready frame (requests / bytes), and everything the link carried after it:

| Screen | doc | js | css | font | img | media | rsc | data | preflight | api | after ready |
|---|---|---|---|---|---|---|---|---|---|---|---|
| today | 6 / 55 KB | 45 / 569 KB | 2 / 38 KB | 2 / 51 KB | 10 / 154 KB | – | 7 / 36 KB | 6 / 54 KB | 7 / 0 KB | – | 64 / 1.16 MB |
| recorder | 2 / 14 KB | 39 / 503 KB | 2 / 38 KB | 2 / 51 KB | 1 / 37 KB | – | – | – | 5 / 0 KB | – | 70 / 1.35 MB |
| result | 7 / 68 KB | 47 / 534 KB | 2 / 38 KB | 2 / 51 KB | 5 / 81 KB | – | 5 / 25 KB | 3 / 2 KB | 3 / 0 KB | – | 56 / 1.25 MB |
| log-daily | 6 / 55 KB | 47 / 525 KB | 2 / 38 KB | 2 / 51 KB | 7 / 103 KB | – | 4 / 20 KB | 3 / 51 KB | 3 / 0 KB | – | 55 / 1.16 MB |
| log-games | 7 / 64 KB | 43 / 480 KB | 2 / 38 KB | 2 / 51 KB | 3 / 60 KB | – | 4 / 20 KB | 6 / 59 KB | 6 / 0 KB | – | 58 / 1.24 MB |
| you | 6 / 55 KB | 50 / 549 KB | 3 / 39 KB | 2 / 51 KB | 13 / 173 KB | – | 7 / 30 KB | 8 / 55 KB | 10 / 0 KB | 1 / 0 KB | 59 / 1.11 MB |
| lessons | 6 / 55 KB | 32 / 389 KB | 2 / 38 KB | 2 / 51 KB | 16 / 206 KB | – | 11 / 21 KB | 2 / 51 KB | 2 / 0 KB | – | 73 / 1.27 MB |
| practice | 6 / 55 KB | 37 / 339 KB | 2 / 38 KB | 2 / 51 KB | 4 / 97 KB | 1 / 182 KB | 6 / 30 KB | 3 / 51 KB | 3 / 0 KB | – | 74 / 1.45 MB |
| boss | 2 / 16 KB | 34 / 311 KB | 2 / 38 KB | 2 / 51 KB | 2 / 138 KB | – | 1 / 5 KB | – | 2 / 0 KB | – | 67 / 1.52 MB |
| hostile | 2 / 16 KB | 34 / 388 KB | 2 / 38 KB | 2 / 51 KB | 2 / 127 KB | – | – | – | 2 / 0 KB | – | 73 / 1.58 MB |
| settings | 7 / 63 KB | 41 / 367 KB | 2 / 38 KB | 2 / 51 KB | 5 / 87 KB | – | 7 / 35 KB | 5 / 3 KB | 5 / 0 KB | – | 87 / 1.46 MB |
| shop | 7 / 63 KB | 48 / 537 KB | 2 / 38 KB | 2 / 51 KB | 16 / 212 KB | – | 5 / 25 KB | 5 / 54 KB | 6 / 0 KB | – | 54 / 1.06 MB |
| signin | 7 / 62 KB | 36 / 402 KB | 2 / 38 KB | 2 / 51 KB | 5 / 81 KB | – | 1 / 5 KB | 2 / 49 KB | 2 / 0 KB | – | 60 / 1.25 MB |
| today-next-day | 6 / 55 KB | 49 / 617 KB | 2 / 38 KB | 2 / 51 KB | 19 / 249 KB | – | 7 / 36 KB | 7 / 54 KB | 8 / 0 KB | – | 49 / 1.02 MB |

What the waterfalls show (the median run of each is in `baseline.json`, `routes.<name>.cold.medianRun.waterfall`):

- **The first byte costs three round trips** (456 ms): a new connection's handshake and the request. Every static page is served from Vercel's cache, so this is the floor for a cold open over this link.
- **FCP waits on the CSS and the fonts** (1.4 s): one 191 KB CSS file (37 KB gz) and two preloaded fonts (52 KB), with `/splash-demos.webp` (38 KB) asked for at high priority beside them on every page, because React 19 preloads the `<img>`s in the server's markup (this one with `fetchPriority="high"`) and the splash's image is in every page's markup even where the splash never shows (`components/Splash.tsx`).
- **Nothing the person came for is drawn before hydration.** On Today the JS takes the link from about 1.2 s to 3.5 s, the load event lands at about 3.7 s, and the first Supabase read leaves at about 4 s.
- **Then the reads share the link with things that can wait.** The service worker registers on `load` and starts precaching 61 files (1.27 MB) exactly while Today reads; Next prefetches seven routes' payloads from the links on Today's card and tiles; the tab swipe's stand-ins fetch the neighbouring tabs' HTML; Demos's idle clip starts as soon as he is on screen (182 KB of video before Practice is drawn; the boss and Hostile fetch theirs just after). Today's ready frame and its hero art (the LCP, `/lessons/large/<id>.webp`, known only once the reads land) arrive behind all of it.
- **Every Supabase read pays a preflight first.** The browser's reads go cross-origin with `apikey`, `authorization` and `x-client-info` headers, so each new URL is an `OPTIONS` round trip before its `GET`: 7 on a cold Today, 10 on You.
- **A daily user's token has always expired.** The access token lasts an hour, so the day's first open refreshes it before the first read: Today with yesterday's token is drawn at 6.2 s cold and 2.6 s warm, against 5.5 s and 1.6 s with a fresh one.

## 3. Moving between tabs

Warm: the worker installed, Today opened again, then a tap on each tab in turn and back.

| Tap | tap to painted | long tasks in it |
|---|---|---|
| Today to Log | 140 ms | 71 ms |
| Log to You | 649 ms | 71 ms |
| You to Lessons | 97 ms | 0 ms |
| Lessons to Practice | 49 ms | 0 ms |
| Practice to Lessons | 173 ms | 56 ms |
| Lessons to You | 93 ms | 0 ms |
| You to Log | 76 ms | 0 ms |
| Log to Today | 186 ms | 130 ms |

The doors off the tabs a day goes through, warm:

| Door | tap to painted |
|---|---|
| Today > Start (`/rep?topic=t337&item=pause-1-151&trait=pause&ready=1`) | 540 ms |
| Today > trait (`/practice/pause`) | 470 ms |
| Lessons > lesson (`/lessons/the-landing`) | 461 ms |
| Log > recording (`/rep/rep-22`) | 1.1 s |

- Tab to tab is quick because every tab is a static page whose payload Next prefetched, and each draws from what the visit already read (`lib/held.ts`, #433, #467).
- **You blocks on data the first time** (649 ms): nothing Today read covers it, so it waits on the auth server (`db.auth.getUser()`, a network call, `app/you/page.tsx` 357), the plan, the lexicon, every XP event and the coin ledger, each behind its own preflight. Back on You later it draws at once.
- The pages off the tabs that a day goes through are dynamic (`ƒ`): `/practice/[trait]`, `/lessons/[id]`, `/lesson/[unit]` and `/rep/[id]` are rendered by a function per open, and Next prefetches only their loading state, so a tap waits on a function call. All four are client pages whose server HTML does not depend on the id.

## 4. The room

A first open of `/welcome`: FCP 1.3 s, the room's first frame (its door, "Hold to step in") at **3.7 s**, LCP 3.9 s (a.room-link "Tester code"). Warm: 986 ms. From the home-screen icon, which opens `/`: **4.7 s**.

- **Media.** The room has none to wait for: nine flat SVG layers drawn in React (`components/room/art/`), sounds made by WebAudio (`lib/room-sound.ts`), no video, no audio file. Its only images are the splash's (38 KB, preloaded) and Demos for the next screen, `/demos-onboard-hello.webp` at 1024 px (100 KB), fetched once the room is up (`app/welcome/page.tsx`, `preloadPose`).
- **What blocks the first frame is the JS.** `app/welcome/page.tsx` 371 returns `<main className="px-5 pt-7" />` until an effect has read the phone's storage, so the server's HTML is empty and the door waits for 415 KB of JS (zod's 90 KB among it, through `lib/practice-family.ts`), plus the introduction's questions, `components/LessonScreen.tsx` and `components/AuthForm.tsx`, which the room does not use.
- **From `/` it is a second trip.** A phone that has never opened Ethos lands on `/` (the manifest's `start_url`), loads and runs Today's 569 KB, fires Today's first reads, then `router.replace("/welcome")` (`app/page.tsx` 355) fetches the introduction's payload and code: 986 ms more than opening `/welcome`.

## 5. Images and the 3D icons

Every image drawn in the first viewport on the cold opens, against what a 3x screen needs:

| Image | on | natural | drawn at | 3x needs | verdict | next/image |
|---|---|---|---|---|---|---|
| `/demos-bust/speaking.webp` | today | 256 | 44 | 132 | 1.9x larger than needed | no |
| `/icons/3d/streak.webp` | today | 192 | 20 | 60 | 3.2x larger than needed | no |
| `/lessons/large/inside-or-after.webp` | today | 560 | 222 | 666 | under 3x (soft) | no |
| `/demos-512/demos-onboard-speaking.webp` | result | 512 | 114 | 342 | right | no |
| `/icons/3d/best.webp` | you | 192 | 22 | 66 | 2.9x larger than needed | no |
| `/icons/3d/xp.webp` | you | 192 | 22 | 66 | 2.9x larger than needed | no |
| `/lessons/closed-mouth.webp` | lessons | 360 | 132 | 396 | right | no |
| `/lessons/the-landing.webp` | lessons | 360 | 44 | 132 | 2.7x larger than needed | no |
| `/lessons/inside-or-after.webp` | lessons | 360 | 44 | 132 | 2.7x larger than needed | no |
| `/lessons/the-long-one.webp` | lessons | 360 | 44 | 132 | 2.7x larger than needed | no |
| `/lessons/the-cold-open.webp` | lessons | 360 | 44 | 132 | 2.7x larger than needed | no |
| `/demos-512/demos-onboard-clock.webp` | practice | 512 | 133 | 399 | right | no |
| `/demos-onboard-clock.webp` | boss | 1024 | 235 | 705 | right | no |
| `/_next/image?url=%2Fdemos-onboard-speaking.webp&w=1080&q=75` | hostile | 512 | 264 | 792 | under 3x (soft) | yes |
| `/icons/3d/freeze.webp` | shop | 192 | 44 | 132 | right | no |
| `/demos-bust/clock.webp` | shop | 256 | 56 | 168 | right | no |
| `/demos-bust/celebrate.webp` | shop | 256 | 56 | 168 | right | no |

- The 3D stat icons (`public/icons/3d/*.webp`, #487) are 192 px WebP, 6 to 11 KB, plain `<img>`, drawn at 20 to 22 px: three times what 3x needs, and so small it does not matter. They are precached.
- Lesson art is a plain `<img>` (#274) at 360 px for the list and 560 px for the lesson; Today's hero draws the 560 cut at 222 px, which a 3x phone wants at 666: slightly soft, as #448 found for the lesson page.
- Demos's big poses are 1024 px (90 to 115 KB) where the stage draws them at 235 px (the boss) or less; a 768 cut would be 3x and about half the bytes. Hostile uses `next/image` (`/_next/image?w=1080`) for the same art.
- Demos's idle clips (`public/idle/*.mp4|webm`, 100 to 260 KB) start as soon as a 120 px Demos is on screen and are not cached by the worker (`public/sw.js` skips `/idle/`).

## 6. Fonts

Outfit and Figtree through `next/font/google`, self-hosted: four WOFF2 files, two of them (the Latin subsets, 32 KB and 20 KB) preloaded, `font-display: swap`, metric-matched Arial fallbacks (`size-adjust`), the Latin Extended subsets (15 KB and 10 KB) fetched only for a character that needs them. Both are variable fonts, so 600, 700 and 800 cost nothing more. Nothing to fix here; the splash waits on `document.fonts.ready`, which on a cold open is about as long as the CSS.

## 7. The service worker

`public/sw.js` (`ethos-v19`):

- **Precache: 61 requests, 1.27 MB** (80 KB of pages, 1.19 MB of images), started on the page's `load` event (2.7 s into a cold open here), so it shares the link with the first screen's reads and art. The largest: `/icon-512.png` 371 KB, `/icon-192.png` 58 KB, `/demos-listening.webp` 47 KB, `/demos-speaking.webp` 44 KB, `/demos-asleep.webp` 35 KB, `/demos-practice.webp` 34 KB. `icon-512.png` and `icon-192.png` are the manifest's icons; the phone fetches those itself at install and the app never draws them.
- **Navigations are network-first.** A warm open asks the network for the page every time and waits for it (warm TTFB 460 ms; `fromWorker` true, the document still came over the link as a revalidation). The cache answers only when the network fails: offline, the cached page painted at 180 ms, and its frame settled at 8.3 s once the reads had failed.
- **Static assets are cache-first** (`.js`, `.css`, fonts, images), so a warm open's JS comes from the phone: Today's warm open carried 97 KB, almost all of it data and Next's prefetches.
- **Data is never cached** (`/api/`, every other origin), as it should be; RSC payloads (`?_rsc=`) are kept network-first like pages, so every prefetch goes to the network on every open.

## 8. Data: Today's and You's reads

Both screens read everything in the browser, after hydration, through `supabase-js`.

**Today** (`app/page.tsx` 293 to 390, `lib/client-data.ts`):

1. `fetchReps()` (the newest 90 whole rows, transcripts included) and `fetchRepSpine()` (every recording's date, lesson, stars and Index, paged by 1000) in parallel. **These two decide the ready frame.** Each first awaits `db.auth.getSession()`, which on a day's first open refreshes the token over the network before either read leaves.
2. Beside them: `fetchProfile()`, then `syncOnboarding()` after it (sequential, for the name and the pool); `usePlan` reads `billing`; the coin chip reads `coin_ledger`; `sessionState()` (`lib/auth.ts` 397) calls `db.auth.getUser()`, a round trip to the auth server, only to learn whether the session is a guest.
3. After those two land, `syncFreezes()` (`lib/freeze-sync.ts` 76 to 111) reads `streak_freezes`, then `coin_ledger` again, then `streaks`, **one after another**, and may write twice. The streak chip settles only after these three round trips (each behind a preflight).
4. Then `armReminder()`.

**You** (`app/you/page.tsx` 277 to 366): the 90 rows and the spine in parallel, the lexicon, every XP event (`fetchXp`, paged), the profile then `syncOnboarding()`, `db.auth.getUser()` for the guest flag, `/api/avatar`; after those land, `syncFreezes()` (three sequential reads) and `syncCoins()` (reads, then up to two writes) side by side. "Level" waits on the XP read.

What could run in parallel or be kept: the three freeze reads have no dependency between them (`Promise.all`); `getUser()` for a guest flag can be `getSession()` (local); Today's spine, profile and streak hold no words and could be kept on the phone between opens so a warm open draws them at hydration (today `lib/held.ts` keeps them in memory only, by design, #433); You's XP total could come with the profile. The reads themselves are small once PostgREST cuts them to their columns; it is the round trips that cost: on this link each is about 190 ms, and every new URL pays two (preflight and read).

## 9. The wait after Stop

Read end to end, then timed with the server's outside calls stubbed. The take: `MediaRecorder` on the mic's audio track, `audio/webm;codecs=opus` with no bitrate set (`app/rep/page.tsx` 1426 to 1431; Hostile the same, `app/hostile/page.tsx` 428 to 433), so Chromium records at 128 kbps: **897 KB for 60 s**. Safari's default was not measured here (needs Claude).

**On the phone, from Stop:** the recorder's `onstop` (the last chunk), the blob into IndexedDB (`outboxPut`, local), `currentSession()` (local), `ensureSession()` (local, or a refresh), then one `POST /api/analyze` with the whole take as multipart form data. Nothing goes up until Stop.

**On the server** (`app/api/analyze/route.ts`), in order, with the stubs' clock (Supabase 20 ms a call):

| At | What |
|---|---|
| 0 to 10283 ms | the take goes up (897 KB over 750 kbps). `req.formData()` waits for the last byte; the first line, `received`, is written only then |
| 10243 to 10264 ms | supabase `GET /auth/v1/user` |
| 10265 to 10288 ms | supabase `GET /rest/v1/reps` |
| 10288 to 10312 ms | supabase `POST /rest/v1/rpc/consume_rate_limit` |
| 10314 to 10335 ms | supabase `GET /rest/v1/profiles` |
| 10315 to 10336 ms | supabase `GET /rest/v1/profiles` |
| 10315 to 10336 ms | supabase `GET /rest/v1/reps` |
| 10315 to 10340 ms | supabase `GET /rest/v1/reps` |
| 10315 to 10340 ms | supabase `POST /storage/v1/object/audio/reps/<take>` |
| 10313 to 16324 ms | whisper `POST /v1/audio/transcriptions` |
| 16329 to 28335 ms | claude `POST /v1/messages` |
| 28342 to 28362 ms | supabase `POST /rest/v1/reps` |
| 28364 to 28384 ms | supabase `POST /rest/v1/xp_events` |
| 10283 ms | the phone gets `transcribing` |
| 16303 ms | the phone gets `measured` |
| 28299 ms | the phone gets `saving` |
| 28341 ms | the phone gets `done` |

- **Before Whisper, three Supabase calls one after another**: `resolveAuthHeader` (`db.auth.getUser(token)`, a call to the auth server, route 341), `findRepByClientId` (369), `consumeRateLimit` (381); a guest adds two more (`guestip` 401, `guestall` 416). Then the plan, the meter, the delta's two reads, a game's count and the audio's trip into Storage start beside Whisper (#472).
- **Whisper** (`lib/transcribe.ts`): `whisper-1`, `verbose_json` with word and segment timestamps, the disfluency prompt, temperature 0, the whole file re-sent from the function to OpenAI. Not streamed (word timestamps need the whole answer).
- **Claude, the coach** (`lib/coach.ts` 592 to 623): `claude-opus-5`, `effort: "low"`, `max_tokens: 3000`, structured JSON output (the coaching copy, the upgrade and the four judged dimensions with citations), the system prompt cached, **not streamed**, up to **three attempts in sequence** when the reply fails validation, inside a 45 s budget. A boss take runs `judgeAccuracy` beside it.
- **After Claude**: the row insert, then the lexicon row and the XP in parallel (`lib/db.ts` 433 to 463), the meter write beside them; two round trips, then `done`.

**Where the seconds go for a 60 s take on this link**: the upload 10.3 s (measured), three Supabase round trips (about 60 ms if the function sits beside the database; about 0.5 to 0.8 s if it does not), Whisper (estimate 3 to 8 s for a minute), Claude (estimate 8 to 15 s for about 500 output tokens from Opus at low effort; a failed validation doubles it), two more round trips. The cohort's median from Stop to saved was 76 s before #472 (DECISIONS #472), which these parts do not add up to: retries, resends and the real model times are the gap, and only production logs can say which.

**What would cut them, largest first**: record speech at 24 to 32 kbps (the same 60 s is 170 KB at 32 kbps and 173 KB at 24, so the upload drops from 9.9 s to 2.0 s; measured end to end, the 180 KB take reached `received` at 2.5 s); show the measured numbers as the result at `measured` and let Demos's read land into it (the person stops waiting on Claude at all, as DESIGN.md's "the judged read streams in" asks); stream the coach's reply and validate per field so a retry does not start from nothing; a faster model for the four judged dimensions or the copy (measure first); send the take in pieces while it is spoken so Whisper starts at Stop; the three calls before Whisper as one (verify the token locally, the duplicate check and the limiter in parallel).

## 10. Config

- `next.config.ts`: `distDir` from the environment, `poweredByHeader: false`, the security headers on every response. No `images` settings, no `experimental.optimizePackageImports`, no `staleTimes` (Next 15's default: a dynamic page's payload is never reused, static ones for 5 minutes).
- **No `vercel.json`** and no `preferredRegion` or `regions` anywhere, so the functions run in the project's default region (`iad1`, Washington, unless the project's settings say otherwise). The users are in Melbourne and Sydney (the fixtures, DECISIONS #77 and 0018).
- **The Supabase project's region is not in the repo.** If it is not the function's region, every server call in `/api/analyze` (eight or nine on a take) crosses an ocean. Both are under "needs Claude".
- `/rep/[id]`, `/lessons/[id]`, `/practice/[trait]` and `/lesson/[unit]` are dynamic (`ƒ`) though their output does not depend on the server.

## A sketch of three fixes, measured

To put measured numbers on the top of the list, three fixes were sketched into a scratch copy of this tree (never committed) and measured the same way: zod out of the browser (fix 2), the worker registered 8 s after `load` (fix 3, the timing only, `SHELL` untouched), and `fetchPriority="high"` dropped from the splash's image (half of fix 6b: React still preloads it, at a lower priority). `docs/speed/sketch.json` holds the run.

| Screen | | baseline | sketch |
|---|---|---|---|
| today | cold ready | 5.5 s | **4.8 s** |
| today | cold LCP | 6.4 s | **5.8 s** |
| today | cold FCP | 1.4 s | 1.4 s |
| today | cold JS on the wire | 569 KB | 482 KB |
| today | warm ready | 1.6 s | 1.8 s |
| log-daily | cold ready | 4.9 s | **4.3 s** |
| log-daily | cold LCP | 5.1 s | **4.7 s** |
| log-daily | cold FCP | 1.4 s | 1.3 s |
| log-daily | cold JS on the wire | 525 KB | 426 KB |
| log-daily | warm ready | 1.7 s | 2.0 s |
| you | cold ready | 5.5 s | **4.8 s** |
| you | cold LCP | 3.5 s | 3.6 s |
| you | cold FCP | 1.4 s | **1.3 s** |
| you | cold JS on the wire | 549 KB | 467 KB |
| you | warm ready | 2.5 s | 2.1 s |
| the room | cold first frame | 3.7 s | **3.1 s** |
| the room from `/` | cold first frame | 4.7 s | **4.3 s** |

First-load JS from the sketch's build: Today 336.6 KB gz (was 425.4), the recorder 394.2 (was 482.8), the introduction 320.9 (was 409.1), the Log 312.4 (was 400.6). Warm opens barely move: the JS was already on the phone, and the warm open is the network-first page and the reads (fixes 4, 5, 9).

## Ranked fixes

Ranked by what a person on an iPhone feels: the seconds, times how often they are felt. Every take waits on its upload (1). Every day opens Today, first open or later (2 to 11). The tabs are already quick but for You's first open (12). The room is felt once, by everyone (13, 14). The model's wait after Stop needs production's timings before it can be ranked against the rest (15, 16), and the remaining fixes are smaller or riskier. Each "measured cost" is from this baseline; "expected gain" is what the fix removes on this profile, measured where the sketch below tried it. Line numbers are at `54204ca`.

| # | What | Measured cost | Expected gain | Files | Risk |
|---|---|---|---|---|---|
| 1 | **Record speech at 32 kbps.** Pass `audioBitsPerSecond: 32000` with the mime type. | 897 KB a minute at 128 kbps; the server hears nothing for 10.3 s after Stop on a 60 s take | the same take is 170 KB: `received` at 2.5 s, **about 8 s off every take** on mobile data, about 1 s on Wi-Fi | `app/rep/page.tsx` 1426 to 1431, `app/hostile/page.tsx` 428 to 433 | Low to medium: check Whisper's filler recall at 32 kbps on three real takes (the um and uh test in `lib/transcribe.ts`'s note) and that Safari honours the setting; stored takes play back at speech quality |
| 2 | **zod out of the browser.** Move `QuestionSchema` and `HostileVerdictSchema` into `lib/hostile-server.ts`, keep the types as interfaces, and read a stored Hostile record with a hand-written guard (or `zod/mini`) | 90 KB on the wire and 385 KB to parse on Today, the recorder, a recording, the Log, the introduction, Hostile and the unit page | sketched with 3 and 6b: Today cold ready 5.5 s to 4.8 s, the room 3.7 s to 3.1 s | `lib/hostile.ts` 18, 157 to 177, 269 to 281; `lib/hostile-server.ts` 10 to 19; tests in `lib/hostile*.test.ts` | Low |
| 3 | **The worker's install after the first screen, and lighter.** Register once Today's reads are drawn (or on idle a few seconds after `load`); drop `/icon-512.png` and `/icon-192.png` from `SHELL` and cache the 15 `/lessons/large/*.webp` on first view; bump `CACHE` | 1.27 MB in 61 requests starting at `load`, while Today reads; the icons alone are 430 KB the app never draws | the first screen's reads and art get the whole link: sketched (with 2 and 6b): Today's LCP 6.4 s to 5.8 s; the install itself drops by a third | `components/ServiceWorker.tsx`, `public/sw.js` `SHELL` and `CACHE` | Low: the offline shell is built a few seconds later |
| 4 | **Static pages from the worker, the network behind them** (stale-while-revalidate for navigations without a query) | warm TTFB 460 ms on every open, before any JS runs | about 0.4 s off every warm open of every tab (TTFB to tens of ms) | `public/sw.js`, the navigation branch at the end of the `fetch` handler | Medium: a deploy shows on the second open, not the first; the old page's chunks are still cache-first, so it runs |
| 5 | **Today's numbers kept on the phone between opens**: the spine (dates, lessons, stars, Index), the profile's name and plan, the freezes; never a transcript | warm Today ready 1.6 s, of which about 0.9 s is the preflights and reads after the JS has run | warm Today drawn at hydration: about 0.8 s off (with 4, a warm Today in well under a second) | `lib/held.ts` (a persisted store for `SPINE_KEY`, `PROFILE_KEY`, `FREEZES_KEY`), `app/page.tsx` (already draws from held when `useWarm`) | Medium: bends #433's "memory only" (dates and scores on the device, no words); log it |
| 6 | **The splash lands on a drawn Today.** (a) Lift when Today's data is drawn, capped (say 2.5 s), with a lower floor than 900 ms. (b) Stop React preloading the splash's image on every page: it preloads any `<img>` in the server's markup (the sketch dropped `fetchPriority="high"` and React still preloaded it, at a lower priority), so draw the image only once the head script has turned the splash on (a CSS `background-image` under `:root[data-splash="on"]`, or the `<img>` without `src` until then) | installed app, cold: splash gone 4.3 s, Today drawn 5.5 s; warm: 2.1 s and 2.5 s; 38 KB beside the CSS on every cold page | no skeleton after the brand moment; (b) about 0.2 s off FCP on a cold page | `components/SplashLift.tsx` (`MIN_MS`, the condition), `components/Splash.tsx` 35, a drawn signal from `app/page.tsx` | Low |
| 7 | **The tabs' reads without preflights.** Same-origin rewrite of the Supabase REST and auth paths (`next.config.ts` `rewrites`, `lib/supabase-browser.ts` pointed at it), or confirm Supabase's `Access-Control-Max-Age` | 7 preflights before Today's reads, 10 before You's, one round trip each (about 190 ms here) | one round trip off each wave of reads (Today has three: reads, auth, freezes) | `next.config.ts`, `lib/supabase-browser.ts`, `lib/security-headers.ts` | Medium: sign-in and Google return paths use the project URL; test them |
| 8 | **Freezes read in parallel**: `fetchFrozenDays`, `purchasedFreezes` and `fetchStreakRow` have no order between them | three reads one after another, each behind a preflight, after the recordings land, on Today, You, the Shop and every result | two round trips off the streak chip settling (0.4 to 0.8 s here) | `lib/freeze-sync.ts` 76, 77, 109 | Low |
| 9 | **A longer access token.** In Supabase, Authentication, JWT expiry: from one hour to a day or more, so the day's first open does not refresh before its first read (or start the refresh from a head script, before the JS) | the day's first open: Today drawn at 2.6 s against 1.6 s later the same day; the refresh is a preflight and a POST before any read | about 970 ms off the open that matters most | the Supabase project's Auth settings; nothing in the repo | Medium: a stolen access token lives longer; revocation waits for expiry (refresh tokens are unchanged) |
| 10 | **Today's 90 rows without the transcripts.** Today reads 90 whole rows to judge substance (`lib/trait-readings.ts` `measured`) and the length cost; store the substance flag (or the word count) on the row and select only what Today draws | 50 KB for this account's 22 takes, the slowest of Today's reads on every open; at 90 takes about 200 KB, a second on this link | most of that read's bytes, growing with every take | `lib/client-data.ts` 72 (`REP_COLUMNS`) and `fetchReps`, `lib/trait-readings.ts` 312 to 370, `lib/home.ts` 468, 632, a migration for the column | Medium: the stored takes need the flag backfilled; no score moves |
| 11 | **What can wait, waits for the first screen**: Link prefetch off on Today's in-card links except Start (`prefetch={false}`), the tab stand-ins after the screen's data, Demos's idle clip after the screen is drawn | 7 payloads (36 KB) and 2 neighbouring pages (19 KB) beside Today's reads; 182 KB of clip before Practice is drawn | Practice cold ready 3.9 s loses the clip's share of the link; a little off Today | `components/home/AvatarCoin.tsx`, `components/home/ModeTiles.tsx` 30, `components/home/HomeTiles.tsx` 149, 246, 337, `components/TabSwipe.tsx` 359 to 363, `components/DemosClip.tsx` | Low |
| 12 | **You's first open without the waits**: the guest flag from `getSession()` (local) rather than `getUser()` (the auth server); You's XP and lexicon read once Today is drawn, into the held store | You first time from Today: 649 ms; later ones 93 ms | the first open as quick as the rest | `app/you/page.tsx` 355 to 365, `lib/auth.ts` 397 to 408 (`sessionState`, also on Today and the introduction) | Low |
| 13 | **The room drawn by the server.** Render the door on the server and decide resume or skip after hydration (a first open is the room), or a head script like the splash's that marks the walk's state before paint; load the questions, `LessonScreen` and `AuthForm` with `next/dynamic` after the room | door at 3.7 s cold, FCP 1.3 s: the HTML is an empty `<main>` | the door at about FCP: **about 2 s off the first minute of Ethos** | `app/welcome/page.tsx` 371, `components/room/Room.tsx`, `lib/onboarding.ts` (`roomDue`) | Medium: a returning walker must never see the door flash (#497) |
| 14 | **The home-screen icon straight to the room**: a head script beside `splashBootScript` that sends a first run to `/welcome` before Today's JS loads | `/` to the room 4.7 s against 3.7 s | 986 ms off a new person's first open | `app/layout.tsx` head, `lib/onboarding.ts` (`isFirstRun` as a plain string), `app/page.tsx` 355 stays as the fallback | Low to medium |
| 15 | **The result at `measured`; Demos's read lands into it.** The numbers that need no model are on screen when the words are; the judged rows and the Index arrive with `done` | with the stubs, `measured` to `done` is the coach's whole time (12.0 s); estimate 8 to 15 s for real, doubled by a retry | the person stops waiting on Claude | `app/rep/page.tsx` (the phase on `measured`), `lib/wait.ts`, `components/rep/ScoringStage.tsx`, `components/RepResult.tsx`, `lib/glance.ts`, the testers' felt question (`content/tester.ts`) | Medium to high: the glance (#427) is built on one whole answer, and the testers are asked before the score |
| 16 | **The coach, faster**: stream the reply and check each field as it completes; on a failed check re-ask for that field, not the whole reply; try a faster model for the four judged dimensions with the same citation checks, kept only if the stored takes' scores agree (`supabase/replay/`) | not measurable here (stubbed); three attempts are possible in sequence | unknown until production times it (needs Claude) | `lib/coach.ts` 576 to 700 | Medium: no stored take is rescored (#422); the Index must not move |
| 17 | **Fewer round trips in the route**: verify the token locally (`auth.getClaims` or the JWT secret), then the duplicate check and the limiter together; the row, the lexicon and the XP in one RPC | three calls before Whisper and two after Claude, one after another | 2 to 3 round trips: tens of ms beside the database, 0.4 to 0.7 s across an ocean | `app/api/analyze/route.ts` 341 to 420, `lib/db.ts` 307 to 463 | Low to medium: a duplicate must still never spend a slot |
| 18 | **The layout lighter**: `tabForKey` and `commandsAllowed` in a module without the topics; `AuthNote`, `GoogleTakenSwitch`, `TesterLayer`, `AccountGate` and `OutboxRetry` with `next/dynamic` after idle; the paywall's components (`Paywall`, `Overlay`, `Stair`, `PlanCard`) with `next/dynamic` on the tabs; the browser's Supabase from `@supabase/auth-js` and `@supabase/postgrest-js` without realtime and storage | layout 225.7 KB gz on every page; topics 28 KB raw, Supabase's unused parts 83 KB raw, the paywall 34 KB raw on five tabs | about 30 to 45 KB gz off every page, more off the parse | `components/CommandMenu.tsx` 6, `lib/commands.ts`, `app/layout.tsx`, `lib/supabase-browser.ts`, the tab pages' imports of `components/Paywall.tsx` | Low, medium for the Supabase change |
| 19 | **Static where nothing is dynamic**: a server `page.tsx` with `generateStaticParams` around the client page for `/practice/[trait]` (5), `/lessons/[id]` (15), `/lesson/[unit]`; a static shell for `/rep/[id]` | Today > trait 470 ms, Lessons > lesson 461 ms, Log > recording 1.1 s | prerendered, prefetched whole, precacheable | the four `page.tsx` files | Low to medium |
| 20 | **Send the take while it is spoken** (recorder `timeslice`, chunks to Storage on a signed upload, the route takes the path) | after 1, the remaining 2.0 s | Whisper starts at Stop | `app/rep/page.tsx`, `lib/rep-outbox.ts`, `app/api/analyze/route.ts` | High: the outbox and its resend key, partial takes |
| 21 | **Images at what 3x needs**: 768 px cuts of the 1024 px Demos poses for the boss, Hostile and the introduction; a 720 px cut for Today's hero (sharper, a few KB more) | 90 to 115 KB poses drawn at 235 px or less; the hero 560 px drawn at 222 | 40 to 50 KB off each pose | `scripts/place-3d-demos.py`, `components/DemosArt.tsx` (`poseSrc`), `scripts/cut-lesson-art.mjs` | Low |

## Needs Claude

- **The regions.** No `vercel.json` and no `preferredRegion`, so the functions run where the Vercel project says (default `iad1`); the Supabase project's region is not in the repo. Read both in the dashboards. If they differ, or if both are far from Melbourne, that is the first fix for the wait after Stop (fix 17's round trips multiply) and for every server read.
- **Real Whisper and Claude times.** Log per stage in `/api/analyze` (upload end, Whisper ms, coach ms and attempts, save ms) and read a week of them before choosing between fixes 15, 16 and 20. The stubs here time everything else exactly.
- **Supabase's preflight.** `curl -i -X OPTIONS` against the project's `/rest/v1/reps` with the browser's headers: is there an `Access-Control-Max-Age`? It decides how much fix 7 is worth.
- **32 kbps on real takes.** Before fix 1 ships: three stored takes re-encoded at 32 kbps through Whisper with the same prompt, filler counts compared; and Safari on an iPhone honouring `audioBitsPerSecond` (iOS 18.4 and later records WebM here, STATE.md).
- **The field numbers.** Vercel Speed Insights (#285) has the real p75 FCP, LCP and INP from the testers' iPhones; this lab's CPU and link are a model of them. Compare before and after each fix ships.
- **The cohort's 76 s.** DECISIONS #472's median from Stop to saved; check how much of it was resends (the outbox) and coach retries once the stage log exists.
