/**
 * The loudness envelope — evidence about the gaps between words.
 *
 * Whisper deletes non-lexical fillers unless primed, and the disfluency
 * prompt in `transcribe.ts` is the only thing standing between this
 * product's core number and a laundered transcript. Measured 11 Aug: no
 * prompt, and 100% of "um"/"uh" disappear. That is a fragile place for
 * the whole engine to rest — one string, one vendor's editorial habits,
 * and a silent failure if either changes.
 *
 * So we stop asking. The recorder already runs an AnalyserNode for the
 * level meter; sampling its RMS a few times a second costs nothing and
 * gives every inter-word gap a checkable property:
 *
 *   - gap with ENERGY in it  → you made a sound that wasn't a word.
 *     That's a filled pause, whether or not the transcript admits it.
 *   - gap that is genuinely QUIET → real silence. Composure, if it
 *     landed somewhere earned.
 *
 * The two can't double-count. If Whisper *did* transcribe the "um",
 * the word occupies that stretch of the timeline and there is no gap
 * there to classify — so transcribed fillers and voiced gaps are
 * disjoint by construction.
 *
 * Self-calibrating: everything is measured against the rep's own noise
 * floor, so a quiet room and a noisy tram both work without a setting.
 */

export interface Envelope {
  /** RMS samples, 0–1, evenly spaced. */
  levels: number[];
  /** Samples per second. */
  rate: number;
}

/** Sampling rate for the recorder. 20Hz resolves a 250ms "um" in 5 samples. */
export const ENVELOPE_RATE = 20;

/**
 * A gap counts as voiced when its energy sits this far above the rep's
 * noise floor, as a fraction of the speech-to-floor range. v1 guess —
 * calibrate against a recording with counted "um"s.
 */
export const VOICED_THRESHOLD = 0.18;

/** Below this many samples a gap is too short to judge. */
const MIN_SAMPLES = 3;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
  return sorted[i];
}

export interface Floor {
  /** The quiet baseline — room tone, breath, handling noise. */
  noise: number;
  /** Where actual speech sits. */
  speech: number;
  /** The level a gap has to clear to count as voiced. */
  threshold: number;
}

/**
 * The rep's own floor and ceiling. Uses percentiles rather than min/max
 * so one door slam doesn't redefine "loud" for the whole recording.
 */
export function calibrate(env: Envelope): Floor {
  const sorted = [...env.levels].sort((a, b) => a - b);
  // 5th percentile, not 10th: the measured reps run 10–34% silent, so a
  // 10th-percentile floor sits inside the speech on the busiest of them
  // and the whole rep reads as having no dynamic range.
  const noise = quantile(sorted, 0.05);
  const speech = quantile(sorted, 0.9);
  return {
    noise,
    speech,
    threshold: noise + (speech - noise) * VOICED_THRESHOLD,
  };
}

/** Mean level across a time window, or null if it isn't measurable. */
export function levelBetween(
  env: Envelope,
  fromS: number,
  toS: number
): number | null {
  if (env.rate <= 0 || toS <= fromS) return null;
  // Trim the edges: the tail of the previous word and the onset of the
  // next both bleed into the gap, and would read as energy that isn't
  // the speaker filling it.
  const trim = 0.08;
  const from = Math.max(0, Math.round((fromS + trim) * env.rate));
  const to = Math.min(env.levels.length, Math.round((toS - trim) * env.rate));
  if (to - from < MIN_SAMPLES) return null;

  let sum = 0;
  for (let i = from; i < to; i++) sum += env.levels[i];
  return sum / (to - from);
}

export type GapSound = "voiced" | "silent" | "unknown";

/**
 * Was this gap filled with a sound, or actually empty?
 *
 * "unknown" is a real answer and is returned whenever the envelope is
 * missing or the window is too short to measure — the engine must be
 * able to tell "we checked and it was silent" from "we couldn't check",
 * because only the first is evidence.
 */
export function classifyGap(
  env: Envelope | null,
  fromS: number,
  toS: number,
  floor?: Floor
): GapSound {
  if (!env || env.levels.length === 0) return "unknown";
  const level = levelBetween(env, fromS, toS);
  if (level === null) return "unknown";
  const f = floor ?? calibrate(env);
  // A rep with no dynamic range at all (constant hiss, or a dead mic)
  // can't distinguish anything, and guessing would invent evidence.
  if (f.speech - f.noise < 0.02) return "unknown";
  return level >= f.threshold ? "voiced" : "silent";
}

/** Clamp and round for transport — this rides along with the audio POST. */
export function serializeEnvelope(env: Envelope): string {
  return JSON.stringify({
    rate: env.rate,
    // Two decimals is plenty for a ratio test and keeps a 90s rep at
    // roughly 7KB of form data.
    levels: env.levels.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100),
  });
}

export function parseEnvelope(raw: string | null): Envelope | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { rate?: number; levels?: unknown };
    if (!Array.isArray(parsed.levels) || parsed.levels.length === 0) return null;
    const levels = parsed.levels
      .map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0))
      .map((v) => Math.min(1, Math.max(0, v)));
    const rate = typeof parsed.rate === "number" && parsed.rate > 0 ? parsed.rate : ENVELOPE_RATE;
    // A 90s rep at 20Hz is 1800 samples; anything far past that is junk.
    if (levels.length > 20_000) return null;
    return { levels, rate };
  } catch {
    return null;
  }
}
