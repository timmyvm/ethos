/**
 * Whisper transcription: BUILD-PLAN step 1, layer 2.
 * verbose_json with word-level timestamps; the raw response is stored
 * alongside the recording so metrics can be recomputed as the engine tunes.
 */

import "server-only";
import type { Segment, Word } from "./metrics";

/**
 * The single most load-bearing string in the engine. Do not "tidy" it.
 *
 * Whisper learned from cleaned subtitle text and deletes non-lexical
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
 * same day on the theory that more priming would catch more; it
 * recovered exactly the same 3 and 2, and then hallucinated "Thank you
 * for watching." onto six seconds of near-silence, where the short
 * prompt returned nothing. A long prompt gives Whisper more to fall back
 * on when there's no signal, and an invented sentence would sail
 * straight through the substance gate as a real recording. Longer is not
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

/** Whisper's answers worth one more try: busy, rate-limited or down for a moment. */
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
/**
 * A second try starts only with at least this long left before the
 * deadline: a 90-second take transcribes in a few seconds, so this
 * leaves the retry room to finish (docs/scale/audit.md M10).
 */
export const WHISPER_RETRY_MIN_MS = 15_000;
/** The wait before the second try, jittered so a burst of takes does not retry in step. */
const retryPause = () => 400 + Math.floor(Math.random() * 600);

/**
 * `deadline` (epoch ms) is when the caller must have its words by: past
 * it the call is cut off and this throws "Whisper timed out", which every
 * route answers as Whisper being down (a 502, the slot given back, the
 * audio taken back out of the bucket), where the platform's kill at
 * maxDuration used to keep the slot, orphan the audio and answer nothing
 * (docs/scale/audit.md M7, FAIL-1). A busy or failing Whisper (429, 5xx,
 * a dropped connection) is asked once more after a short jittered wait,
 * when the deadline leaves room (M10). Without a deadline nothing is cut
 * off, as before, and the one retry still runs.
 */
export async function transcribe(
  audio: Blob,
  filename: string,
  opts: { deadline?: number } = {}
): Promise<Transcription> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Transcription is unavailable; add it to .env.local."
    );
  }

  const form = () => {
    const f = new FormData();
    f.append("file", audio, filename);
    f.append("model", "whisper-1");
    f.append("response_format", "verbose_json");
    f.append("timestamp_granularities[]", "word");
    f.append("timestamp_granularities[]", "segment");
    f.append("prompt", DISFLUENCY_PROMPT);
    // Deterministic. Whisper escalates temperature itself when a decode
    // fails its compression/logprob thresholds, so this is a floor, not a
    // ceiling — raising it here trades disfluency capture for hallucination.
    f.append("temperature", "0");
    return f;
  };

  const left = () => (opts.deadline === undefined ? null : opts.deadline - Date.now());
  const roomToRetry = () => {
    const l = left();
    return l === null || l > WHISPER_RETRY_MIN_MS;
  };

  let data: WhisperVerboseJson | null = null;
  for (let attempt = 1; data === null; attempt++) {
    const ms = left();
    if (ms !== null && ms <= 0) throw new Error("Whisper timed out before it was asked.");
    const signal = ms === null ? undefined : AbortSignal.timeout(ms);
    try {
      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form(),
        signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (attempt === 1 && RETRY_STATUS.has(res.status) && roomToRetry()) {
          console.warn(`[whisper] ${res.status}, asking once more`);
          await new Promise((r) => setTimeout(r, retryPause()));
          continue;
        }
        throw new Error(`Whisper API ${res.status}: ${body.slice(0, 300)}`);
      }
      data = (await res.json()) as WhisperVerboseJson;
    } catch (e) {
      if (signal?.aborted) throw new Error(`Whisper timed out after ${ms} ms.`);
      if (e instanceof Error && e.message.startsWith("Whisper API ")) throw e;
      // A connection that dropped before an answer: once more, if there is time.
      if (attempt === 1 && roomToRetry()) {
        console.warn("[whisper] no answer, asking once more", e instanceof Error ? e.message : e);
        await new Promise((r) => setTimeout(r, retryPause()));
        continue;
      }
      throw e;
    }
  }

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
