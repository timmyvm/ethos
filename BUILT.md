# BUILT.md — what exists, so you can decide what to cut

Reverse-planning sprint, 9 Aug 2026. Everything below is live at
https://ethos-timmyvms-projects.vercel.app and pushed to `main`.
This file is a menu for pruning, not a brag list — each entry says what
it is, where it lives, and what depends on it.

## Engine (build-order step 1) — keep, this is the product

| What | Where | Notes |
|---|---|---|
| Deterministic metrics | `lib/metrics.ts` | Fillers with "like" disambiguation, WPM, pause classification (beat / pre / mid). No LLM. |
| Ethos Index tier 1 | `lib/index-score.ts` | Pause, fillers, pace, range → /100 each. Weighted into /1000. |
| Tier-2 anchors | `lib/index-score.ts` | Hedge and restart counts fed to the judge as ground truth. |
| Coach + judge call | `lib/coach.ts` | One Claude call per rep: focus, strength, supply, coachLine, and four judged dimensions. Citation-required or rejected and re-run. |
| Whisper transcription | `lib/transcribe.ts` | verbose_json, word timestamps, disfluency-biased prompt. |
| Analyze route | `app/api/analyze/route.ts` | Pipeline + persistence. Coach failure never blocks the numbers. |

## Loop (step 2)

| What | Where | Cut cost |
|---|---|---|
| Daily drill rotation | `lib/drills.ts` | Low — path routing would take over. |
| Recording screen | `app/rep/page.tsx` | Core. |
| Results view | `components/RepResult.tsx` | Core. Shared with the log. |

## Progression (step 3) — most prunable layer

| What | Where | Cut cost |
|---|---|---|
| Path, units, star gating | `lib/path.ts`, `app/path/page.tsx` | Medium — home falls back to daily rotation cleanly. |
| Streaks | `lib/streak.ts`, `components/StreakBadge.tsx` | Low to remove, high to re-earn. |
| Streak celebration | `components/StreakCelebration.tsx` | Trivial to cut. |
| XP + levels | `lib/level.ts` | Low — nothing else reads it. |
| Weekly league | inside `app/you/page.tsx` | Trivial — it's a placeholder card until 20 users exist. |
| Achievements | `lib/achievements.ts` | Trivial. Self-contained. |
| Training log | `app/history/page.tsx` | Medium — this is the retention asset. |
| Sparklines | `components/Sparkline.tsx` | Trivial. |
| Insights | `lib/insights.ts` | Trivial to cut, genuinely differentiating to keep. |
| Filler heatmap | `components/FillerHeatmap.tsx` | Trivial. |
| Comparison card | `components/ComparisonCard.tsx` | **Don't cut.** vision.md calls this the core retention *and* marketing asset. |
| Share card export | `components/ShareCard.tsx` | Low. Canvas-drawn, no deps. |
| Audio scrubber | `components/AudioScrubber.tsx` | Low to cut; it's the most honest feature here. |
| Rep detail page | `app/rep/[id]/page.tsx` | Medium — the log needs somewhere to link. |

## Money (step 4)

| What | Where | Cut cost |
|---|---|---|
| Paywall sheet | `components/Paywall.tsx` | Prices are placeholders pending the research pass. |
| Free-tier limits | `app/history` (7 days), `app/you` (3 lexicon) | Constants at the top of each file. |
| Boss mode | `app/boss/page.tsx`, `lib/cold-topics.ts` | Research timer works; recording is paywalled and not wired to the engine yet. |
| Stress mods | `lib/stress-mods.ts` | **Data only — no UI yet.** Safe to delete. |

## Brand and shell (step 5)

| What | Where | Cut cost |
|---|---|---|
| Landing page | `app/(marketing)/about/page.tsx` | Standalone. |
| Onboarding | `app/welcome/page.tsx` | Standalone, three screens, no quiz. |
| Settings | `app/settings/page.tsx` | Reminder prefs are stored locally; **no scheduler exists yet.** |
| Bottom nav | `components/Nav.tsx` | Cutting it strands /path, /history, /you. |
| Service worker | `public/sw.js` | Trivial to cut. |
| Demos poses | `public/demos-*.webp` | 5 poses, each at one moment. |

## Honest gaps

Things that look finished but aren't:

- **Boss mode doesn't record.** The research timer and brief are real; the
  recording step opens the paywall instead of the engine.
- **Stress mods have no UI.** Data model only.
- **The league has no roster.** It shows your own weekly XP and says so.
- **Reminders don't fire.** Settings stores the preference; nothing schedules
  a notification. Needs a push service or a native wrap.
- **Freezes aren't implemented.** `streaks.freezes_equipped` exists in the
  schema, nothing reads it.
- **Premium isn't purchasable.** No Stripe, no entitlement check — the
  paywall is a sheet that closes.
- **Star thresholds and Index curve constants are v1 guesses.** They need
  calibration against real recordings (open queue).

## Test coverage

97 tests across metrics, index scoring, coach validation, drills, path,
streak, level, achievements, insights, and the analyze route. Run with
`npm test`.
