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
