/**
 * Where a take's wait goes, one line per take (#508).
 *
 * The speed audit could time everything in /api/analyze but Whisper and
 * the coach, which it had to stub: their real times decide between
 * showing the result at `measured`, streaming the coach and sending the
 * take while it is spoken (the audit's fixes 15, 16 and 20). This writes
 * them to the function's log as one structured line a take, so a week of
 * them can be read before choosing.
 *
 * Nothing personal is in it, by construction: `stageLine` takes only the
 * numbers and labels named in `StageReport` and writes only those. No
 * transcript, no user id, no client id, no address, no file name.
 */

export interface StageReport {
  /** The answer's status. */
  status: number;
  /** A resend answered with the stored recording. */
  duplicate: boolean;
  mode: "daily" | "boss" | null;
  /** Where the function ran (Vercel's VERCEL_REGION), so a region move shows in the times. */
  region: string | null;
  /** The take's size and length, which Whisper's time scales with. */
  audioKB: number | null;
  takeS: number | null;
  /** From the request to the last byte of the take (the upload's tail). */
  uploadMs: number | null;
  /** The sign-in check, the resend lookup and the rate limit, before Whisper. */
  gateMs: number | null;
  whisperMs: number | null;
  coachMs: number | null;
  /** How many calls the coach made (a failed check asks again). */
  coachAttempts: number;
  /** The row, the lexicon, the XP and the meter, after the coach. */
  saveMs: number | null;
  totalMs: number;
}

/** A clock for one take: marks taken as the route reaches each stage. */
export class StageClock {
  readonly startedAt: number;
  uploadEnd: number | null = null;
  gateEnd: number | null = null;
  whisperStart: number | null = null;
  whisperEnd: number | null = null;
  coachStart: number | null = null;
  coachEnd: number | null = null;
  coachAttempts = 0;
  saveStart: number | null = null;
  saveEnd: number | null = null;
  audioBytes: number | null = null;
  takeS: number | null = null;
  mode: "daily" | "boss" | null = null;
  duplicate = false;
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
    this.startedAt = now();
  }

  mark<K extends "uploadEnd" | "gateEnd" | "whisperStart" | "whisperEnd" | "coachStart" | "coachEnd" | "saveStart" | "saveEnd">(k: K): void {
    this[k] = this.now();
  }

  report(status: number, region: string | null = process.env.VERCEL_REGION ?? null): StageReport {
    const span = (a: number | null, b: number | null) => (a !== null && b !== null ? Math.max(0, Math.round(b - a)) : null);
    return {
      status,
      duplicate: this.duplicate,
      mode: this.mode,
      region,
      audioKB: this.audioBytes === null ? null : Math.round(this.audioBytes / 1024),
      takeS: this.takeS === null ? null : Math.round(this.takeS * 10) / 10,
      uploadMs: span(this.startedAt, this.uploadEnd),
      gateMs: span(this.uploadEnd, this.gateEnd),
      whisperMs: span(this.whisperStart, this.whisperEnd),
      coachMs: span(this.coachStart, this.coachEnd),
      coachAttempts: this.coachAttempts,
      saveMs: span(this.saveStart, this.saveEnd),
      totalMs: Math.max(0, Math.round(this.now() - this.startedAt)),
    };
  }
}

/** The line itself: the report's own keys, in a fixed order, and nothing else. */
export function stageLine(r: StageReport): string {
  return JSON.stringify({
    evt: "analyze.stages",
    status: r.status,
    duplicate: r.duplicate,
    mode: r.mode,
    region: r.region,
    audio_kb: r.audioKB,
    take_s: r.takeS,
    upload_ms: r.uploadMs,
    gate_ms: r.gateMs,
    whisper_ms: r.whisperMs,
    coach_ms: r.coachMs,
    coach_attempts: r.coachAttempts,
    save_ms: r.saveMs,
    total_ms: r.totalMs,
  });
}
