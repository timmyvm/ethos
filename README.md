# Ethos

Five minutes of speaking a day, measured, until speaking clearly under
pressure is a trait, not a performance.

## Run it

```
npm install
cp .env.example .env.local   # add keys — see below
npm run dev                  # http://localhost:3000
npm test                     # metrics engine unit tests
```

- `OPENAI_API_KEY` — required. Whisper transcription is the engine's input.
- `ANTHROPIC_API_KEY` — optional. Powers focus/supply/coach; without it a
  recording still returns real numbers with a deterministic coach line.
- Supabase vars — optional. Run `supabase/migrations/0001_schema_v1.sql`
  against a project to store recordings; without them nothing persists.
- `PREMIUM_UNLOCK_CODE` — the invite code `/api/redeem` accepts while
  there's no payment processor. Unset = codes are off.
- VAPID + `CRON_SECRET` vars — real (server-sent) reminders. Generate the
  keypair with `npx web-push generate-vapid-keys`, set all three in
  Vercel, and add `CRON_SECRET` as a GitHub repo secret so
  `.github/workflows/push-cron.yml` can tick `/api/push/cron` hourly.

Phone testing needs HTTPS for mic access — deploy to Vercel (set the same
env vars there) or tunnel localhost. Once deployed, "Add to Home Screen"
installs it as a PWA. Note: the Claude↔Vercel integration currently lacks
project-create permission, so the first deploy is manual (`npx vercel` in
this folder) or grant the integration access in Vercel settings.

## Start a build session (Cowork / Claude Code)

Drop this folder in as the project root and say:
"Read CLAUDE.md, then STATE.md, then DESIGN.md."
Step 1 (engine: record → Whisper → deterministic metrics → coach) is built;
next is dogfood on a real phone, then step 2+ per docs/vision.md.

## Map

- CLAUDE.md            — session rules + the not-average-but-best protocol
- DECISIONS.md         — 14 locked decisions + the open queue
- STATE.md             — the current system on one page (start here)
- DESIGN.md            — how the app should look and feel, and the look loop
- docs/archive/        — BUILD-PLAN, BUILT and DESIGN-RULES, kept for history
- docs/vision.md       — what this is, hard constraints
- docs/brand.md        — name, palette, type, Demos, voice
- docs/mechanics.md    — path, stars, economy, pricing, competitor intel
- design/*.html        — brand board + design direction (open in browser)
- prototype/ethos-mvp.jsx — clickable flow reference (React artifact)
- assets/demos-side-profile.png — approved Demos art (Higgsfield ref: demos-red-panda)
