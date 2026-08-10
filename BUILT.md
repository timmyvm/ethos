# BUILT.md — what exists, so you can decide what to cut

Reverse-planning sprint, 9–10 Aug 2026. Everything below is live at
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
| Demos poses | `public/demos-*.webp` | 5 poses, each at one moment. |

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
- **Star thresholds and Index curve constants are v1 guesses.** They need
  calibration against real recordings (open queue). Same for the boss
  accuracy penalties (18 confident / 6 hedged) and the XP multipliers.
- **Boss topics are a hand-written list of seven.** Fine for two months
  of weeklies; the supply layer for topics is not built.

## Test coverage

143 tests across metrics, index scoring, coach validation, boss accuracy,
rep configuration, stress mods, drills, path, streak and freezes, level,
achievements, insights, reminders, and the analyze route. Run with
`npm test`.

The engine tests that matter most: the analyze route proves a forged
form can't buy XP, that a boss rep is fact-checked and a daily one isn't,
and that a failed fact-check still returns the rep.
