# BUILT.md — what exists, so you can decide what to cut

Reverse-planning sprint, 9–10 Aug 2026. Everything below is pushed to
`main` and live at https://ethos-timmyvms-projects.vercel.app.
This file is a menu for pruning, not a brag list — each entry says what
it is, where it lives, and what depends on it.

**Deploying is a git push — but production does NOT track `main`.** The
Vercel project (`prj_sJBrm6kaPGBRUBV1t0AhnkucG9Jc`, team
`timmyvms-projects`) is linked to `timmyvm/ethos` with its production
branch set to `claude/markdown-session-7w1o76`. So:

- push that branch → **production** build, takes `ethos-tau.vercel.app`
  and `ethos-timmyvms-projects.vercel.app`
- push `main` → preview build only, `target: null`, branch alias only

Every deployment in the history follows this: `main` never once produced a
production build. Push both, or production silently falls behind the
default branch. Worth fixing in Vercel project settings — point the
production branch at `main` — but until someone does, the branch is what
ships.

**Push the production branch FIRST, and only ever a SHA it hasn't seen.**
Learned the hard way on 11 Aug. Vercel deduplicates by commit: push a SHA
to a preview branch, then push that *same* SHA to the production branch,
and it reuses the existing build instead of making a production one. The
second deployment comes back `target: null` and production silently stays
on the old code, while every branch in the repo reads as up to date and
green. Nothing in the deployment list looks wrong — you have to curl the
production host to notice.

So the order matters: `git push origin main:claude/markdown-session-7w1o76`
first, `git push origin main` second. If a SHA has already been built and
production still needs it, a fresh commit is the cheapest fix.

**Verify with the host, never with the deployment list.** `curl -s
https://speakethos.com/about | grep -o "<title>[^<]*</title>"` — the
title changed on 11 Aug, so an old title means old code, whatever Vercel
says.

**The branches are all one commit as of 11 Aug.** `main` and
`claude/markdown-session-7w1o76` both point at the same place, and the
old session branches are dead refs that just haven't been deleted — this
sandbox's git proxy returns 403 on ref deletion, so they need removing
from the GitHub UI. Deleting `claude/markdown-session-7w1o76` is the one
that is NOT safe until the production branch is repointed at `main`:
delete it first and production stops deploying entirely.

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
| Analyze route | `app/api/analyze/route.ts` | Pipeline + persistence. Coach and fact-check run in parallel; either failing never blocks the numbers. Recomputes the XP multiplier from server-side entitlement, and meters the judged tier. |
| Presence engine | `lib/presence.ts` | Pose landmarks → gesture rate, posture drift, head stability, eye-line % → Presence /1000 (4 × 250, same shape as the Index). Plus timestamped moments and the live ring state. Pure, no LLM, 21 tests. |
| Pose sampling | `lib/pose-client.ts`, `scripts/fetch-pose-assets.mjs` | MediaPipe Pose as a WASM task, ~30fps, self-hosted from `public/pose/` (staged at build, gitignored). Load failure is honest: the mode toggle says unavailable. |
| Judged metering | `lib/metering.ts` | Free 1/day, rollover capped at 3, premium unlimited. Local-date reset from a clamped client offset. Pure, 15 tests. |

## Loop (step 2)

| What | Where | Cut cost |
|---|---|---|
| Daily drill rotation | `lib/drills.ts` | Low — path routing would take over. |
| Recording screen | `app/rep/page.tsx` | Core. |
| Results view | `components/RepResult.tsx` | Core. Shared with the log. |
| Topic roulette | `lib/topics.ts`, `components/TopicRoulette.tsx` | Low. 20 prompts across 4 shapes; structure tips are per shape, never per topic (DECISIONS #60). Replaces the floor card rather than adding a second CTA. |
| Voice / Voice + Video | `components/ModeToggle.tsx`, `lib/prefs.ts` | Low to hide, medium to remove. Sticky per drill type, daily off / boss on, rep 1 always audio (DECISIONS #68). |
| Presence results | `components/PresenceCard.tsx` | Medium. Score beside the Index, Pro readout, moments, local playback with markers. |

## Progression (step 3) — most prunable layer

| What | Where | Cut cost |
|---|---|---|
| Path, units, star gating | `lib/path.ts`, `app/path/page.tsx` | Medium — home falls back to daily rotation cleanly. |
| Streaks | `lib/streak.ts`, `components/StreakBadge.tsx` | Low to remove, high to re-earn. |
| Streak freezes | `lib/streak.ts`, `lib/freeze-sync.ts` | Low. Earned per 7-day week, auto-spent, bridges without counting. Cutting means deleting one table. |
| Streak celebration | `components/StreakCelebration.tsx` | Trivial to cut. |
| Day counter + trail | `lib/days.ts`, `components/DayTrail.tsx` | Trivial to cut, cheap to keep. The number that never resets, plus an Index-by-day line inside the home score card. Gets better with time by construction. |
| Coins | `lib/coins.ts`, `lib/coin-sync.ts`, `components/Coin.tsx`, `public/coin/*.svg` | Low. Append-only ledger, 1/day-spoken, no shop. The earn rate is enforced by a DB constraint + partial unique index, so cutting the client doesn't unmeter it. |
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
| Judged-tier cap | `app/api/analyze/route.ts`, `lib/metering.ts` | Free 1/day, rollover 3. Server-enforced; the client can ask, only the route decides. |
| Boss mode | `app/boss/page.tsx`, `lib/cold-topics.ts` | Records through the real engine and gets fact-checked. Free = this week's topic once; premium = the library. |
| Stress mods | `lib/stress-mods.ts`, `components/ModPicker.tsx` | Four mods with real effects. Medium — the picker appears on home and boss. |
| Crowd-noise synth | `lib/crowd-noise.ts` | Trivial. Self-contained WebAudio, no asset. |

## Brand and shell (step 5)

| What | Where | Cut cost |
|---|---|---|
| Landing page | `app/(marketing)/about/page.tsx` | Standalone. |
| Onboarding | `app/welcome/page.tsx` | Standalone, three screens, no quiz. |
| Accounts | `lib/auth.ts`, `app/signup`, `app/signin`, `app/auth/{forgot,reset,callback}` | Core now. Email + password, no social. The anonymous upgrade attaches credentials to the same auth user, so nothing migrates and nothing can be lost migrating. |
| Transactional email | `supabase/auth-email-templates/`, `docs/email.md` | Templates + the dashboard config they assume. Sends from `hello@speakethos.com`, reply-to the same, never `noreply@`. |
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
- **Presence has never been pointed at a real body.** The engine is
  fully tested against synthetic landmark frames — a composed speaker, a
  slouch, a look-away, hands out of frame — which proves the arithmetic,
  not the thresholds. Every constant in `lib/presence.ts` is a v1 guess
  in the same bucket as the star thresholds. Dogfood before trusting a
  Presence number in front of anyone.
- **The pose runtime is ~30MB and downloaded at build time.**
  `npm run pose:assets` copies the WASM out of `node_modules` and fetches
  the 5.5MB model. It runs in `prebuild`, and it is deliberately
  non-fatal: a build with no network ships an app that reports Voice +
  Video unavailable rather than failing. If the toggle is greyed out on
  a deploy, check that first.
- **Supabase custom SMTP is not verified from here.** `docs/email.md`
  has the settings; the auth flows assume "Confirm email" is on and the
  redirect allow-list includes the deploy host. Both are dashboard
  settings nobody has ticked yet, and signup silently does nothing
  useful until they are.
- **The Supabase secret key needs rotating.** It transited chat during the
  10 Aug session. It lives only in `.env.local` (gitignored) and Vercel env
  settings, but it should be rolled.

## Traps — read this before debugging

Each of these cost real time on 10 Aug. They look like product bugs and
are not.

- **The uploaded rep blob must be built from `stream.getAudioTracks()`,
  never from the camera stream.** In Voice + Video the MediaRecorder has
  a video track available, and recording `stream` directly ships a video
  file to Supabase storage the moment someone flips the toggle — quietly,
  correctly, and in direct contradiction of the promise printed on the
  same screen. `app/rep/page.tsx` splits an audio-only MediaStream for
  the upload and keeps a second, local-only recorder for playback.
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
  whichever build finished last — usually the `main` *preview*
  (`target: null`, branch alias only) — so production looks stale when it
  isn't. Every SHA appears twice in `list_deployments`; check
  `target: "production"` **and** its `githubCommitRef`, which is the
  session branch, not `main`. Fastest honest check is to curl the
  production host and diff what it serves against the working tree.

## Test coverage

317 tests across metrics and the substance gate, index scoring, coach
validation, boss accuracy, rep configuration, stress mods, drills, path,
streak and freezes, level, achievements, insights, reminders, scheduling,
rewards, the analyze route, Presence, judged metering, coins, auth rules
and the copy bans. Run with `npm test`.

The engine tests that matter most: the analyze route proves a forged
form can't buy XP, that a boss rep is fact-checked and a daily one isn't,
that a failed fact-check still returns the rep, that a capped rep is
still stored (so the streak stands) and is never charged for an analysis
it didn't get, and that Presence never moves the Ethos Index.

`lib/copy.test.ts` is a linter, not a unit test: it scans every `.tsx`
under `app/` and `components/` for the banned word and asserts the two
positioning claims. A ban that lives only in a document comes back the
first time someone writes a paywall headline in a hurry.

Two tests had encoded a bug rather than a requirement — an empty
transcript asserting 3 stars ("thresholds stay objective") and an 11-word
"clean rep" fixture. If a test looks like it is defending scoring an empty
answer, it is wrong; fix the test.
