/**
 * Whisper transcription — BUILD-PLAN step 1, layer 2.
 * verbose_json with word-level timestamps; the raw response is stored
 * alongside the rep so metrics can be recomputed as the engine tunes.
 */

import type { Segment, Word } from "./metrics";

/**
 * The single most load-bearing string in the engine. Do not "tidy" it.
 *
 * Whisper is trained on cleaned subtitle text and deletes non-lexical
 * fillers by default. Measured on 11 Aug against generated speech
 * containing a known 3 "um" and 2 "uh":
 *
 *   no prompt    → um 0, uh 0   (every one deleted)
 *   this prompt  → um 3, uh 2   (every one recovered)
 *
 * The filler count is the product's core number, so without this line
 * Ethos silently scores a transcript with the evidence removed.
 *
 * It is also deliberately SHORT. A longer, denser version was tried the
 * same day on the theory that more priming would catch more — it
 * recovered exactly the same 3 and 2, and then hallucinated "Thank you
 * for watching." onto six seconds of near-silence, where the short
 * prompt returned nothing. A long prompt gives Whisper more to fall back
 * on when there's no signal, and an invented sentence would sail
 * straight through the substance gate as a real rep. Longer is not
 * safer here; it is strictly worse.
 */
export const DISFLUENCY_PROMPT =
  "So, um, I was thinking... like, you know, it's kind of, uh, basically the idea.";

export interface Transcription {
  text: string;
  durationS: number;
  words: Word[];
  segments: Segment[];
  raw: unknown;
}

interface WhisperVerboseJson {
  text: string;
  duration: number;
  words?: { word: string; start: number; end: number }[];
  segments?: { start: number; end: number; text: string }[];
}

export async function transcribe(
  audio: Blob,
  filename: string
): Promise<Transcription> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set — transcription unavailable. Add it to .env.local."
    );
  }

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  form.append("prompt", DISFLUENCY_PROMPT);
  // Deterministic. Whisper escalates temperature itself when a decode
  // fails its compression/logprob thresholds, so this is a floor, not a
  // ceiling — raising it here trades disfluency capture for hallucination.
  form.append("temperature", "0");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Whisper API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as WhisperVerboseJson;

  return {
    text: data.text ?? "",
    durationS: data.duration ?? 0,
    words: (data.words ?? []).map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    })),
    segments: (data.segments ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    })),
    raw: data,
  };
}
