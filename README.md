# Ethos

A daily gym for speech. Five minutes of reps a day until speaking clearly
under pressure is a trait, not a performance.

## Run it

```
npm install
cp .env.example .env.local   # add keys — see below
npm run dev                  # http://localhost:3000
npm test                     # metrics engine unit tests
```

- `OPENAI_API_KEY` — required. Whisper transcription is the engine's input.
- `ANTHROPIC_API_KEY` — optional. Powers focus/supply/coach; without it the
  rep still returns real numbers with a deterministic coach line.
- Supabase vars — optional. Run `supabase/migrations/0001_schema_v1.sql`
  against a project to store reps; without them nothing persists.

Phone testing needs HTTPS for mic access — deploy to Vercel (set the same
env vars there) or tunnel localhost.

## Start a build session (Cowork / Claude Code)

Drop this folder in as the project root and say:
"Read CLAUDE.md and start on BUILD-PLAN.md step 1."
Step 1 (engine: record → Whisper → deterministic metrics → coach) is built;
next is dogfood on a real phone, then step 2+ per docs/vision.md.

## Map

- CLAUDE.md            — session rules + the not-average-but-best protocol
- DECISIONS.md         — 14 locked decisions + the open queue
- BUILD-PLAN.md        — step 1 engine spec (start here)
- docs/vision.md       — what this is, hard constraints
- docs/brand.md        — name, palette, type, Demos, voice
- docs/mechanics.md    — path, stars, economy, pricing, competitor intel
- design/*.html        — brand board + design direction (open in browser)
- prototype/ethos-mvp.jsx — clickable flow reference (React artifact)
- assets/demos-side-profile.png — approved Demos art (Higgsfield ref: demos-red-panda)
