# BUILT.md — what exists, so you can decide what to cut

Reverse-planning sprint, 9–10 Aug 2026. Everything below is pushed to
`main` and live at https://ethos-timmyvms-projects.vercel.app.
This file is a menu for pruning, not a brag list — each entry says what
it is, where it lives, and what depends on it.

**Deploying is `git push origin main`.** The Vercel project
(`prj_sJBrm6kaPGBRUBV1t0AhnkucG9Jc`, team `timmyvms-projects`) is linked to
`timmyvm/ethos`. Each push to `main` produces two builds from the same SHA
— a preview on the branch alias, and a production one that takes
`ethos-tau.vercel.app` and `ethos-timmyvms-projects.vercel.app`. There is
no separate deploy step.

**The Supabase asset bridge is vestigial — do not treat it as required.**
`scripts/vercel-fetch-assets.mjs` and `scripts/push-brand-assets.mjs` date
from before the git link, when deploys went through MCP file upload and
binaries had to come from the `brand` bucket. `package.json`'s build is
plain `next build`, so the fetch script is not wired into the build and the
bucket is not read at deploy time; `public/` ships from git. Keep them as a
fallback if the git link is ever removed, but a changed image needs only a
commit. (An earlier version of this file claimed the opposite. It was
wrong — verified against the deployment list, where every SHA appears
twice, once `target: production`.)

## Engine (build-order step 1) — keep, this is the product

| What | Where | Notes |
|---|---|---|
| Deterministic metrics | `lib/metrics.ts` | Fillers with "like" disambiguation, WPM, pause classification (beat / pre / mid). No LLM. |
| Substance gate | `lib/metrics.ts` | Stars are `min(fillerRate, substanceCap)`. Under 20 words, or too repetitive, caps at 1 star. Without it, "I don't know" eight times scored 3 stars — fluency measured on an empty answer. |
| Ethos Index tier 1 | `lib/index-score.ts` | Pause, fillers, pace, range → /100 each. Weighted into /1000. |
| Tier-2 anchors | `lib/index-score.ts` | Hedge and restart counts fed to the judge as ground truth. |
| Coach + judge call | `lib/coach.ts` | One Claude call per rep: focus, strength, supply, coachLine, and four judged dimensions. Citation-required or rejected and re-run. |
| Boss fact-check | `lib/accuracy.ts` | Second, independent Claude call on boss reps: extracts each claim verbatim, marks it against the topic's ground truth. Score is arithmetic over the verdicts. |
| Whisper transcription | `lib/transcribe.ts` | verbose_json, word timestamps, disfluency-biased prompt. |
| Rep resolver | `lib/rep-config.ts` | One pure function answers "what is this rep" — prompt, cap, mods, multiplier — for the screen, the route and the log. |
| Analyze route | `app/api/analyze/route.ts` | Pipeline + persistence. Coach and fact-check run in parallel; either failing never blocks the numbers. Recomputes the XP multiplier from server-side entitlement. |

## Loop (step 2)

| What | Where | Cut cost |
|---|---|---|
| Daily drill rotation | `lib/drills.ts` | Low — path routing would take over. |
| Recording screen | `app/rep/page.tsx` | Core. |
| Results view | `components/RepResult.tsx` | Core. Shared with the log. |
| Topic roulette | `lib/topics.ts`, `components/TopicRoulette.tsx` | Low. 20 prompts across 4 shapes; structure tips are per shape, never per topic (DECISIONS #60). Replaces the floor card rather than adding a second CTA. |

## Progression (step 3) — most prunable layer

| What | Where | Cut cost |
|---|---|---|
| Path, units, star gating | `lib/path.ts`, `app/path/page.tsx` | Medium — home falls back to daily rotation cleanly. |
| Streaks | `lib/streak.ts`, `components/StreakBadge.tsx` | Low to remove, high to re-earn. |
| Streak freezes | `lib/streak.ts`, `lib/freeze-sync.ts` | Low. Earned per 7-day week, auto-spent, bridges without counting. Cutting means deleting one table. |
| Streak celebration | `components/StreakCelebration.tsx` | Trivial to cut. |
| XP + levels | `lib/level.ts` | Low — nothing else reads it. |
| Weekly league | inside `app/you/page.tsx` | Trivial — it's a placeholder card until 20 users exist. |
| Achievements | `lib/achievements.ts` | Trivial. Self-contained. |
| Training log | `app/history/page.tsx` | Medium — this is the retention asset. |
| Sparklines | `components/Sparkline.tsx` | Trivial. |
| Insights | `lib/insights.ts` | Trivial to cut, genuinely differentiating to keep. |
| Decay scheduler | `lib/schedule.ts` | **Don't cut.** This is the answer to "why come back tomorrow". Half-life regression over the four measured dimensions; the reason always names the number. Half-life of 7 days is a guess (DECISIONS #66). |
| Reward layer | `lib/rewards.ts`, `lib/progress.ts`, `components/Moment.tsx`, `NextUp.tsx`, `GainsRow.tsx`, `CountUp.tsx` | Medium. Anticipation, near-misses, open loops, fresh starts, personal bests, milestones sorted by proximity. Researched in `docs/progression-research.md`. |
| Filler heatmap | `components/FillerHeatmap.tsx` | Trivial. |
| Comparison card | `components/ComparisonCard.tsx` | **Don't cut.** vision.md calls this the core retention *and* marketing asset. |
| Share card export | `components/ShareCard.tsx` | Low. Canvas-drawn, no deps. |
| Audio scrubber | `components/AudioScrubber.tsx` | Low to cut; it's the most honest feature here. |
| Rep detail page | `app/rep/[id]/page.tsx` | Medium — the log needs somewhere to link. |

## Money (step 4)

| What | Where | Cut cost |
|---|---|---|
| Paywall sheet | `components/Paywall.tsx` | Prices are placeholders pending the research pass. |
| Free-tier limits | `app/history` (7 days), `app/you` (3 lexicon), boss library | Constants at the top of each file. |
| Entitlement gate | `profiles.premium`, `lib/db.ts` `isPremium()` | Every premium check reads this one boolean. Wiring a processor is a webhook that sets it. |
| Boss mode | `app/boss/page.tsx`, `lib/cold-topics.ts` | Records through the real engine and gets fact-checked. Free = this week's topic once; premium = the library. |
| Stress mods | `lib/stress-mods.ts`, `components/ModPicker.tsx` | Four mods with real effects. Medium — the picker appears on home and boss. |
| Crowd-noise synth | `lib/crowd-noise.ts` | Trivial. Self-contained WebAudio, no asset. |

## Brand and shell (step 5)

| What | Where | Cut cost |
|---|---|---|
| Landing page | `app/(marketing)/about/page.tsx` | Standalone. |
| Onboarding | `app/welcome/page.tsx` | Standalone, three screens, no quiz. |
| Frame step | `app/rep/page.tsx`, `lib/prefs.ts` | Trivial. Opt-in 30s think-time, off by default. |
| Settings + reminders | `app/settings/page.tsx`, `lib/reminders.ts` | Medium. Reminders really schedule; the card names which tier the browser gave you. |
| Data export | `app/settings/page.tsx` | Trivial. One JSON file, every rep and lexicon entry. |
| Error + 404 screens | `app/error.tsx`, `app/not-found.tsx` | Trivial. |
| Bottom nav | `components/Nav.tsx` | Cutting it strands /path, /history, /you. |
| Service worker | `public/sw.js` | Trivial to cut. Also routes a tapped reminder to /rep. |
| Demos poses | `public/demos-*.webp` | 6 poses, each at one moment. Real alpha, cut from `assets/*.png` by `scripts/cut-demos-alpha.mjs` — re-cut from the masters, never from `public/` (DECISIONS #67). |
| Dark mode | `app/globals.css`, `components/Theme.tsx` | Medium. Semantic tokens (`ground` / `surface` / `ink` / `stage` / `hairline`) — a theme swap is a token change, not a rewrite. Opt-in toggle, light stays default (DECISIONS #64). Terracotta and amber are identical in both themes because they carry meaning (#65). |

## Honest gaps

Things that look finished but aren't. The 9 Aug list had seven entries;
four are now closed and struck through.

- ~~Boss mode doesn't record.~~ **Closed.** It records, scores delivery
  through the normal engine, and fact-checks the claims.
- ~~Stress mods have no UI.~~ **Closed.** Four mods, real effects.
- ~~Reminders don't fire.~~ **Closed, with a caveat below.**
- ~~Freezes aren't implemented.~~ **Closed.**
- **Reminders are only as good as the browser.** Chromium schedules them
  with the OS. Safari and Firefox have no Notification Triggers, so
  there we can only fire while a tab is open — settings says so in
  plain words rather than implying an alarm that won't ring. A real
  cross-platform reminder needs web push (a server) or a native wrap.
- **The league has no roster.** It shows your own weekly XP and says so.
- **Premium isn't purchasable.** `profiles.premium` is the gate every
  check reads, and it works — but nothing sets it except SQL. No Stripe.
- **Every calibration constant is a v1 guess.** Star thresholds, the Index
  curve, the boss accuracy penalties (18 confident / 6 hedged), the XP
  multipliers, the substance gate (20 words / 0.3 distinct / 0.4 repeat),
  and `HALF_LIFE_DAYS = 7`. All need real recordings (open queue). Duolingo
  *fits* their half-life from millions of traces; ours is a number someone
  typed.
- **Boss topics are a hand-written list of seven.** Fine for two months
  of weeklies; the supply layer for topics is not built.
- **The Supabase secret key needs rotating.** It transited chat during the
  10 Aug session. It lives only in `.env.local` (gitignored) and Vercel env
  settings, but it should be rolled.

## Traps — read this before debugging

Each of these cost real time on 10 Aug. They look like product bugs and
are not.

- **Never `npm run build` while `next dev` is running.** It overwrites
  `.next` chunks under the running server, the page JS silently fails to
  execute, and the browser renders a day-zero empty state. This gets
  misdiagnosed as broken auth or a broken session every time. Stop the dev
  server first, or use a separate output dir.
- **Do not set `tnum` on `.font-display`.** Tabular figures are the obvious
  choice for a changing metric, but Space Grotesk gives "1" a narrower
  advance than the glyph occupies, so "11", "111" and "1189" render as
  overlapping mush. Verified by A/B on the live element at 4x.
- **The coach's number allowlist must include raw *and* rounded forms.**
  The judge is shown `durationS: 35.58`; if only `36` is allowlisted, an
  honest citation is rejected as invention, all three attempts fail, and
  the user gets no Ethos Index at all. Floor, round and ceil are all
  allowed, and the regex is decimal-aware.
- **`sb_secret_*` keys are not JWTs.** Supabase Storage rejects them as a
  bare bearer token ("Invalid Compact JWS"); they must also be sent as an
  `apikey` header.
- **Tailwind v4 — there is no config file.** Tokens live in `@theme` in
  `app/globals.css`. Font tokens must be in `@theme inline` because they
  reference next/font variables scoped to `<body>`.
- **The 50/100 colour tints are light washes by construction.** In dark
  they are redefined as dark washes of the same hue, or any card using
  them stays cream with unreadable text on it.
- **Don't read deploy state off `get_project`.** Its `latestDeployment` is
  the *preview* build — `target: null`, aliased only to the branch — so it
  looks like production never updated. Every SHA appears twice in
  `list_deployments`; the one that matters is `target: "production"`.
  Fastest honest check is to curl the production host and diff what it
  serves against the working tree.

## Test coverage

207 tests across metrics and the substance gate, index scoring, coach
validation, boss accuracy, rep configuration, stress mods, drills, path,
streak and freezes, level, achievements, insights, reminders, scheduling,
rewards, and the analyze route. Run with `npm test`.

The engine tests that matter most: the analyze route proves a forged
form can't buy XP, that a boss rep is fact-checked and a daily one isn't,
and that a failed fact-check still returns the rep.

Two tests had encoded a bug rather than a requirement — an empty
transcript asserting 3 stars ("thresholds stay objective") and an 11-word
"clean rep" fixture. If a test looks like it is defending scoring an empty
answer, it is wrong; fix the test.
