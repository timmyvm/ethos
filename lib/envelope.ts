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
  /**
   * RMS samples, 0–1, evenly spaced. NaN is a sample the phone never
   * heard (the page had no frames then: hidden, or stalled past
   * `STALL_MS`), which no gap is judged on (#122).
   */
  levels: number[];
  /** Samples per second. */
  rate: number;
  /**
   * Sampled on the take's own clock (`sampleEnvelope`), so its rate is
   * true and a short envelope is a tail the phone did not hear, never a
   * slow one (`fitEnvelopeRate`). Absent on an older frame-gated one.
   */
  clock?: boolean;
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
  // Only what was heard: a sample the phone missed is no evidence of
  // the room's floor or of speech.
  const sorted = env.levels.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
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
  for (let i = from; i < to; i++) {
    // A window the phone did not hear all of is not measured (#122).
    if (!Number.isFinite(env.levels[i])) return null;
    sum += env.levels[i];
  }
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
    ...(env.clock ? { clock: true } : {}),
    // Two decimals is plenty for a ratio test and keeps a 90s rep at
    // roughly 7KB of form data. A sample never heard travels as null,
    // never as a clamped 0, which would read as silence.
    levels: env.levels.map((v) =>
      Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 100) / 100 : null
    ),
  });
}

/** Past this many samples an envelope is junk (a 90s take at 20Hz is 1800). */
const MAX_SAMPLES = 20_000;

/**
 * How stale a skipped sample may be and still take the level a late
 * frame hears. A frame stall of 30 to 100ms is filled; seconds without a
 * frame (a hidden page, the camera's first inference) were never heard.
 */
export const STALL_MS = 250;

/**
 * The recorder's sampler: every sample the take's clock has reached by
 * `elapsedMs`, each at the level heard now. Driven by animation frames,
 * whose timing varies, so it counts by elapsed time and never by frames:
 * sample i is taken on the first frame at or after i / rate seconds, and
 * a late frame fills the samples it skipped, so the timebase stays even.
 * A sample more than `STALL_MS` older than the frame is NaN: the phone
 * did not hear it, so it is left unknown (#122), never invented.
 */
export function sampleEnvelope(
  levels: number[],
  elapsedMs: number,
  level: number,
  rate: number = ENVELOPE_RATE
): void {
  const due = Math.min(MAX_SAMPLES, (elapsedMs * rate) / 1000);
  const unheard = Math.min(due, ((elapsedMs - STALL_MS) * rate) / 1000);
  while (levels.length < unheard) levels.push(NaN);
  while (levels.length < due) levels.push(level);
}

/** How far under its declared rate an envelope may run before it is read at its own. */
export const RATE_TOLERANCE = 0.05;

/**
 * The envelope read at the rate it was really taken at. Phones before
 * the games review sampled on animation frames, a sample on the first
 * frame 50ms after the last, which at 60Hz is every third or fourth
 * frame: about 17 a second under a label of 20, so sample 400, read as
 * 0:20, was heard at about 0:23, and a silence at 0:20 was judged on
 * speech three seconds later. When an envelope holds more than 5% fewer
 * samples than its declared rate fills the take with, its samples are
 * spread over the take's own length instead. More samples than the take
 * holds are a tail past Stop, at the right times, and stay as they are.
 * An envelope sampled on the take's clock (`clock`) is never refitted:
 * its rate is true, and one short of the take is a tail the phone did
 * not hear (the page lost its frames before the take ended), which
 * reads as unknown where it is missing.
 */
export function fitEnvelopeRate(env: Envelope | null, durationS: number): Envelope | null {
  if (!env || !(durationS > 0) || env.levels.length === 0 || env.clock) return env;
  const heard = env.levels.length / durationS;
  if (heard >= env.rate * (1 - RATE_TOLERANCE)) return env;
  return { levels: env.levels, rate: heard };
}

/**
 * The envelope a take's pauses are judged on: the one the phone sent,
 * whenever its samples sit at the times it says. A refitted one
 * (`fitEnvelopeRate`: unmarked, and short of its declared rate) has had
 * its times spread evenly over the take, which is right for a page that
 * never hid and seconds wrong after one that did, and the server cannot
 * tell the two apart. So it judges no pause: each keeps the verdict its
 * words give, stored, shown and scored alike, because a sound has to be
 * heard to cost a pause (#122, #422). A game round still reads the
 * refitted one.
 */
export function pauseEnvelope(sent: Envelope | null, durationS: number): Envelope | null {
  return fitEnvelopeRate(sent, durationS) === sent ? sent : null;
}

export function parseEnvelope(raw: string | null): Envelope | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { rate?: number; levels?: unknown; clock?: unknown };
    if (!Array.isArray(parsed.levels) || parsed.levels.length === 0) return null;
    // null is a sample the phone never heard (serializeEnvelope): kept
    // as NaN, so no gap is judged on it.
    const levels = parsed.levels.map((v) =>
      v === null
        ? NaN
        : Math.min(1, Math.max(0, typeof v === "number" && Number.isFinite(v) ? v : 0))
    );
    const rate = typeof parsed.rate === "number" && parsed.rate > 0 ? parsed.rate : ENVELOPE_RATE;
    // A 90s rep at 20Hz is 1800 samples; anything far past that is junk.
    if (levels.length > MAX_SAMPLES) return null;
    return parsed.clock === true ? { levels, rate, clock: true } : { levels, rate };
  } catch {
    return null;
  }
}
