# Screen-state audit — loading / empty / error / offline

Run 25 Aug against every screen. The repo's Definition of Done
(DESIGN-RULES.md) had already built most of this: page-level reads go
through `lib/load.ts` (`readable()` puts an 8s ceiling on every read and
turns rejection into a value; `readFailure()` is offline-aware), and the
EmptyState / ErrorState / Skeleton primitives are used consistently.

| Screen | Loading | Empty | Error | Offline | Verdict |
| --- | --- | --- | --- | --- | --- |
| Home (floor + road) | SkeletonScoreCard; floor paints locally | Day-1 pill, fresh road, endowed node | ErrorState + retry | readFailure copy | pass |
| Recording (idle→results) | phase machine, progressive results | n/a | ErrorState + retry; outbox keeps the audio | auto re-send on `online` | pass since launch-prep tasks 2/8 |
| Recording, mic/camera denied | — | — | **was a one-line dead end** | — | **fixed: PermissionHelp** |
| Log (/history) | Skeletons | EmptyState with first-recording nudge | ErrorState + retry | readFailure | pass |
| Recording detail (/rep/[id]) | Skeletons | n/a (404s to not-found) | ErrorState + retry | readFailure | pass |
| Games | static menu, nothing to load | n/a | premium read degrades; server re-checks entitlements | n/a | pass |
| Boss | static + local timer | n/a | reads degrade to playable defaults; engine re-checks server-side | n/a | pass |
| You (profile) | Skeletons per section | zeros with nudges | per-section ErrorLine retries (coins, freezes, name) | readFailure | pass |
| Shop | Skeleton cards | n/a | ErrorState + retry; unknown balance renders as a dash, never 0 | readFailure | pass |
| Settings | local prefs, instant | n/a | export falls back; delete flow has its own error line | local | pass |
| Welcome | static | n/a | n/a | n/a | pass |
| Sign in / up | busy states | n/a | humanised auth errors; slow email routes to check-inbox (task 4) | offline message | pass |
| Auth callback / reset / forgot | waiting state | n/a | stale-link state with a way out | n/a | pass |
| Privacy / Terms / About | static | n/a | n/a | n/a | pass |

## The one real gap, now fixed

**Mic or camera permission denied** used to collapse into the generic
error card ("Mic unavailable. Check browser permissions and try
again.") with no retry that could work. Now a refusal or a missing
device renders `components/PermissionHelp.tsx`:

- says why the mic is needed at all (no mic, nothing to measure),
- shows step-by-step re-enable instructions for THIS browser
  (iOS Safari / macOS Safari / Firefox / Chromium, detected in
  `lib/permission-help.ts`, tested),
- distinguishes a missing device from a blocked one,
- keeps a Check again button in reach, and restates that camera frames
  never leave the device when video mode asked for the camera.

## Accepted degradations (deliberate, not gaps)

- Games/Boss premium reads fail silent to the free tier; the analyze
  route re-derives entitlements server-side, so the worst case is a
  paywall sheet that needn't have appeared.
- Boss "taken this week" read failing shows the card as available; the
  stored rep still resolves correctly.
