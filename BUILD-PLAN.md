# BUILD-PLAN.md — Step 1: the engine

Goal of the first session: a user records 60–90s in the browser and gets
back real numbers. Nothing else. No auth polish, no path, no shop.

## Pipeline

1. **Capture** — MediaRecorder (audio/webm;codecs=opus), 90s hard cap,
   waveform level meter while recording. Upload blob → Supabase storage.
2. **Transcribe** — `/api/analyze` route: Whisper API, verbose_json,
   word-level timestamps. Store raw response.
3. **Deterministic metrics** (pure TS module, unit-tested — this is the
   product's integrity, no LLM involved):
   - `wpm`: words / (duration/60)
   - `fillers`: match against list (um, uh, like*, you know, sort of,
     kind of, basically, actually, literally) with positions.
     *"like" needs a naive disambiguation pass: skip when followed by
     a noun phrase comparison — accept imperfection, log for tuning.
   - `pauses`: gaps between consecutive word timestamps.
     gap ≥ 0.8s = held pause; 0.3–0.8s = beat; classify held pauses as
     **pre-sentence** (next word starts a segment) vs **mid-sentence**
     (composed vs panic) — this classification IS the pause-bar data.
   - `stars`: fillers/min < 3 → 3★, < 6 → 2★, else 1★
4. **LLM layer** — one Claude call, JSON out, strict schema:
   - `focus`: ONE thing for tomorrow, must reference a metric
   - `supply`: ONE word/phrase swap quoting the user's own transcript
   - `coachLine`: ≤ 2 sentences, coach register (brand.md voice — short,
     specific numbers, zero hype)
   Reject/retry any output that violates voice rules or invents claims
   without a metric/timestamp basis.
5. **Results screen** — port from prototype: big filler number, WPM zone,
   held pauses, pause bar (amber = held), stars, Demos coach bubble,
   supply card.

## Schema (v1)

- `reps`: id, user_id, lesson_id, created_at, duration_s, transcript,
  wpm, filler_count, fillers jsonb[{word,t}], pauses jsonb[{t,len,kind}],
  stars, focus, supply, audio_path
- `lexicon`: id, user_id, original, upgrade, rep_id, created_at
- `streaks`: user_id, current, longest, last_rep_date, freezes_equipped

## Definition of done for step 1

Timothy records a real rep on his phone and the numbers match what he'd
count by hand from the transcript. Then he does it 13 more days in a row
before anyone builds step 3+ (vision.md: dogfood is the QA).
