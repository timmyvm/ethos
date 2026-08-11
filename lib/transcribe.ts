/**
 * Whisper transcription — BUILD-PLAN step 1, layer 2.
 * verbose_json with word-level timestamps; the raw response is stored
 * alongside the rep so metrics can be recomputed as the engine tunes.
 */

import type { Segment, Word } from "./metrics";

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
  /*
   * Whisper is trained on cleaned subtitle text and removes disfluencies
   * by default. That would gut the filler count — the product's core
   * number — so the prompt is written in the style we want transcribed;
   * Whisper treats it as preceding context and continues its register.
   *
   * Widened on 11 Aug after reading the first nine stored reps. Six of
   * them came back with zero "um" or "uh" between them, and one 53s rep
   * had TEN mid-clause held pauses averaging 1.18s — a full second of
   * nothing in the middle of a clause is not rhetoric, it's a hesitation,
   * and hesitations are usually voiced. The likeliest reading is that the
   * "um"s were transcribed away and the time they occupied became a gap.
   *
   * The old prompt was one short sentence. This one is denser, repeats
   * the non-lexical fillers Whisper is keenest to drop, and includes a
   * stammer and a self-correction so repairs survive too.
   */
  form.append(
    "prompt",
    "Um, so, uh — I was thinking, like, you know, it's kind of... uh, " +
      "basically the idea is, um, that we, that we should just, uh, " +
      "ship it. I mean, er, not ship it exactly, but — you know what I " +
      "mean. Um. Yeah. So, uh, that's, that's the thing."
  );
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
