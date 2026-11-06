import { describe, expect, it } from "vitest";
import {
  calibrate,
  classifyGap,
  ENVELOPE_RATE,
  fitEnvelopeRate,
  levelBetween,
  parseEnvelope,
  sampleEnvelope,
  serializeEnvelope,
  type Envelope,
} from "./envelope";

/**
 * Build an envelope from spans: ["speech", 2], ["um", 0.5], ["silence", 1]
 * — speech is loud, an "um" is a sustained mid-level sound, silence is
 * room tone only.
 */
function env(spans: [("speech" | "um" | "silence"), number][]): Envelope {
  const LEVEL = { speech: 0.5, um: 0.22, silence: 0.03 };
  const levels: number[] = [];
  for (const [kind, secs] of spans) {
    for (let i = 0; i < Math.round(secs * ENVELOPE_RATE); i++) {
      // A little jitter, so nothing depends on perfectly flat input.
      levels.push(LEVEL[kind] + (i % 3) * 0.004);
    }
  }
  return { levels, rate: ENVELOPE_RATE };
}

describe("calibration", () => {
  it("finds the rep's own floor and ceiling", () => {
    const f = calibrate(env([["speech", 5], ["silence", 5]]));
    expect(f.noise).toBeLessThan(0.1);
    expect(f.speech).toBeGreaterThan(0.4);
    expect(f.threshold).toBeGreaterThan(f.noise);
    expect(f.threshold).toBeLessThan(f.speech);
  });

  /**
   * Self-calibrating is the point: the same speaker on a quiet sofa and
   * a loud tram must get the same verdicts without touching a setting.
   */
  it("works the same on a noisy recording as a quiet one", () => {
    const quiet = env([["speech", 4], ["silence", 4]]);
    const noisy: Envelope = {
      rate: ENVELOPE_RATE,
      levels: quiet.levels.map((v) => v * 0.6 + 0.25),
    };
    // Gap at 4–8s is silence in both.
    expect(classifyGap(quiet, 4, 8)).toBe("silent");
    expect(classifyGap(noisy, 4, 8)).toBe("silent");
  });

  it("refuses to judge a recording with no dynamic range", () => {
    const dead: Envelope = { levels: new Array(200).fill(0.3), rate: ENVELOPE_RATE };
    expect(classifyGap(dead, 2, 5)).toBe("unknown");
  });
});

describe("classifying a gap", () => {
  /**
   * The whole point. Whisper deleted the "um", so the transcript shows a
   * hole between two words — but the microphone heard something.
   */
  it("calls a gap with a sustained sound in it voiced", () => {
    // Real reps run 10–34% silent; an envelope with no silence at all
    // has no floor to measure against, and the engine says so instead
    // of guessing (see "no dynamic range" above).
    const e = env([
      ["speech", 3],
      ["um", 0.6],
      ["speech", 3],
      ["silence", 2],
      ["speech", 2],
    ]);
    expect(classifyGap(e, 3, 3.6)).toBe("voiced");
  });

  it("calls a genuinely empty gap silent", () => {
    const e = env([["speech", 3], ["silence", 1.5], ["speech", 3]]);
    expect(classifyGap(e, 3, 4.5)).toBe("silent");
  });

  it("separates the two in the same recording", () => {
    const e = env([
      ["speech", 2],
      ["um", 0.6],
      ["speech", 2],
      ["silence", 1.5],
      ["speech", 2],
    ]);
    expect(classifyGap(e, 2, 2.6)).toBe("voiced");
    expect(classifyGap(e, 4.6, 6.1)).toBe("silent");
  });

  /**
   * "Unknown" has to be distinguishable from "silent". Only one of them
   * is evidence, and scoring a rep as composed because we couldn't
   * measure it would be exactly the flattery the engine exists to avoid.
   */
  it("says unknown rather than guessing when there is no envelope", () => {
    expect(classifyGap(null, 1, 2)).toBe("unknown");
    expect(classifyGap({ levels: [], rate: 20 }, 1, 2)).toBe("unknown");
  });

  it("says unknown for a window too short to measure", () => {
    const e = env([["speech", 5]]);
    expect(classifyGap(e, 1, 1.05)).toBe("unknown");
  });

  it("trims the word onsets bleeding into the gap", () => {
    // Loud speech either side of a short true silence: the edges must not
    // drag the mean up into "voiced".
    const e = env([["speech", 2], ["silence", 1], ["speech", 2]]);
    expect(classifyGap(e, 2, 3)).toBe("silent");
  });
});

describe("levelBetween", () => {
  it("averages only inside the window", () => {
    const e = env([["speech", 2], ["silence", 2], ["speech", 2]]);
    const quiet = levelBetween(e, 2, 4)!;
    const loud = levelBetween(e, 4, 6)!;
    expect(quiet).toBeLessThan(loud / 3);
  });

  it("returns null for a backwards or empty window", () => {
    const e = env([["speech", 2]]);
    expect(levelBetween(e, 2, 1)).toBeNull();
  });
});

describe("transport", () => {
  it("round-trips and stays small", () => {
    const e = env([["speech", 90]]);
    const wire = serializeEnvelope(e);
    // A full 90-second rep has to ride along with the audio POST.
    expect(wire.length).toBeLessThan(12_000);
    const back = parseEnvelope(wire)!;
    expect(back.rate).toBe(ENVELOPE_RATE);
    expect(back.levels).toHaveLength(e.levels.length);
    expect(back.levels[0]).toBeCloseTo(e.levels[0], 1);
  });

  it("drops junk rather than storing half of it", () => {
    expect(parseEnvelope(null)).toBeNull();
    expect(parseEnvelope("{not json")).toBeNull();
    expect(parseEnvelope('{"rate":20,"levels":[]}')).toBeNull();
    expect(
      parseEnvelope(JSON.stringify({ rate: 20, levels: new Array(30_000).fill(0.5) }))
    ).toBeNull();
  });

  it("clamps values a forged client could send", () => {
    const back = parseEnvelope('{"rate":20,"levels":[-5,0.5,99,"x"]}')!;
    expect(back.levels).toEqual([0, 0.5, 1, 0]);
  });
});

/**
 * A 30s take on a 59.94Hz screen with ±0.3ms of frame jitter: speech,
 * with silences at 5 to 7 and 20.0 to 21.2 (Q&A's cut-in at 0:20).
 */
const FRAME_MS = 1000 / 59.94;
const heard = (t: number) => ((t >= 5 && t < 7) || (t >= 20 && t < 21.2) ? 0.03 : 0.5);
function frames(seconds: number): number[] {
  const out: number[] = [];
  for (let k = 1; k * FRAME_MS < seconds * 1000; k++) {
    out.push(k * FRAME_MS + 0.3 * Math.sin(k * 12.9898));
  }
  return out;
}

describe("the recorder's sampler (games review, finding 2)", () => {
  it("samples at 20Hz on the take's clock, whatever the frames do", () => {
    const levels: number[] = [];
    for (const now of frames(30)) sampleEnvelope(levels, now, heard(now / 1000));
    expect(Math.abs(levels.length - 30 * ENVELOPE_RATE)).toBeLessThanOrEqual(1);
    const env: Envelope = { levels, rate: ENVELOPE_RATE };
    expect(classifyGap(env, 20.08, 21.12)).toBe("silent");
    expect(fitEnvelopeRate(env, 30)).toBe(env);
  });

  it("fills the samples a late frame skipped, so the timebase stays even", () => {
    const levels: number[] = [];
    sampleEnvelope(levels, 10, 0.1);
    sampleEnvelope(levels, 260, 0.4);
    expect(levels).toEqual([0.1, 0.4, 0.4, 0.4, 0.4, 0.4]);
    sampleEnvelope(levels, 260, 0.9);
    expect(levels).toHaveLength(6);
  });

  it("reads an envelope sampled by frames at the rate it was taken at", () => {
    // The old sampler: a sample on the first frame 50ms after the last.
    const levels: number[] = [];
    let at = 0;
    for (const now of frames(30)) {
      if (now - at >= 1000 / ENVELOPE_RATE) {
        at = now;
        levels.push(heard(now / 1000));
      }
    }
    expect(levels.length / 30).toBeLessThan(18);
    const declared: Envelope = { levels, rate: ENVELOPE_RATE };
    // Read at 20Hz the silence at 0:20 is judged on speech from about 0:23.
    expect(classifyGap(declared, 20.08, 21.12)).toBe("voiced");
    const fitted = fitEnvelopeRate(declared, 30)!;
    expect(fitted.rate).toBeCloseTo(levels.length / 30, 6);
    expect(classifyGap(fitted, 20.08, 21.12)).toBe("silent");
  });

  it("leaves a tail past Stop, a missing envelope and an unknown length alone", () => {
    const tail: Envelope = { levels: new Array(620).fill(0.2), rate: ENVELOPE_RATE };
    expect(fitEnvelopeRate(tail, 30)).toBe(tail);
    const near: Envelope = { levels: new Array(575).fill(0.2), rate: ENVELOPE_RATE };
    expect(fitEnvelopeRate(near, 30)).toBe(near);
    expect(fitEnvelopeRate(null, 30)).toBeNull();
    expect(fitEnvelopeRate(tail, 0)).toBe(tail);
  });
});

/*
 * The regression review of the games work (engine R1 and I1, edges F1):
 * an envelope on the take's clock that the page stopped feeding (hidden,
 * or a multi-second stall) is unheard where it has no frames, never
 * stretched over the take and never filled with the level heard on return.
 */
describe("a take the page stopped hearing (regression review)", () => {
  /** 72s of speech with a held silence 1.2s long closing every 6s (0:04.8 to 0:06). */
  const truth = (t: number) => (t % 6 >= 4.8 ? 0.03 : 0.5);
  const silences = Array.from({ length: 12 }, (_, k) => [6 * k + 4.8, 6 * k + 6] as const);

  /** HEAD's sampler over 60Hz frames that stop at `stopS` (the page hid). */
  function sampled(seconds: number, stopS: number): number[] {
    const levels: number[] = [];
    for (const now of frames(seconds)) {
      if (now / 1000 >= stopS) break;
      sampleEnvelope(levels, now, truth(now / 1000));
    }
    return levels;
  }

  it("keeps a clock envelope missing its tail at 20Hz, so a gap after the hide is unknown", () => {
    const levels = sampled(72, 40);
    expect(levels.length).toBeGreaterThanOrEqual(799);
    expect(levels.length).toBeLessThanOrEqual(800);
    const wire = serializeEnvelope({ levels, rate: ENVELOPE_RATE, clock: true });
    const back = parseEnvelope(wire)!;
    expect(back.clock).toBe(true);
    const read = fitEnvelopeRate(back, 72)!;
    expect(read.rate).toBe(ENVELOPE_RATE);
    // Every silence heard before the hide reads silent, as on the phone.
    for (const [a, b] of silences.filter(([, b]) => b < 40)) {
      expect(classifyGap(read, a, b)).toBe("silent");
    }
    // A gap after 0:40 the phone never heard.
    for (const [a, b] of silences.filter(([a]) => a > 40)) {
      expect(classifyGap(read, a, b)).toBe("unknown");
    }
  });

  it("still refits an older envelope without the mark (an outbox replay)", () => {
    const old: Envelope = { levels: new Array(1224).fill(0.2), rate: ENVELOPE_RATE };
    expect(fitEnvelopeRate(old, 72)!.rate).toBeCloseTo(1224 / 72, 6);
    const wire = parseEnvelope(serializeEnvelope(old))!;
    expect(wire.clock).toBeUndefined();
    expect(fitEnvelopeRate(wire, 72)!.rate).toBeCloseTo(1224 / 72, 6);
  });

  it("marks a span without frames unheard, never the level heard on return", () => {
    const levels: number[] = [];
    for (const now of frames(60)) {
      const t = now / 1000;
      if (t >= 20 && t < 40) continue; // hidden: no animation frames
      sampleEnvelope(levels, now, t >= 40 && t < 40.5 ? 1 : truth(t));
    }
    expect(Math.abs(levels.length - 1200)).toBeLessThanOrEqual(1);
    // The return's level fills at most STALL_MS (5 samples) behind it.
    const flat = levels.slice(400, 800);
    expect(flat.filter((v) => v === 1).length).toBeLessThanOrEqual(5);
    expect(flat.filter((v) => Number.isNaN(v)).length).toBeGreaterThanOrEqual(394);
    // Missing travels as null and comes back unheard, never as silence.
    const back = parseEnvelope(serializeEnvelope({ levels, rate: ENVELOPE_RATE, clock: true }))!;
    expect(back.levels.slice(400, 790).every((v) => Number.isNaN(v))).toBe(true);
    for (const [a, b] of silences.filter(([a, b]) => a > 20 && b < 40)) {
      expect(classifyGap(back, a, b)).toBe("unknown");
    }
    // The heard parts still read, on a floor taken from what was heard.
    expect(classifyGap(back, 4.8, 6)).toBe("silent");
    expect(calibrate(back).speech).toBeGreaterThan(0.4);
  });

  it("still fills a short frame stall with the level heard", () => {
    const levels: number[] = [];
    sampleEnvelope(levels, 10, 0.1);
    sampleEnvelope(levels, 110, 0.4); // a 100ms stall
    expect(levels).toEqual([0.1, 0.4, 0.4]);
  });

  it("reads a recording whose first second the camera's first inference stalled", () => {
    const levels: number[] = [];
    sampleEnvelope(levels, 16, 0.5);
    // The first pose inference blocks the main thread for 3.6s.
    for (const now of frames(10).filter((n) => n > 3616)) sampleEnvelope(levels, now, truth(now / 1000));
    expect(Math.abs(levels.length - 200)).toBeLessThanOrEqual(1);
    expect(levels.slice(1, 67).every((v) => Number.isNaN(v))).toBe(true);
    expect(classifyGap({ levels, rate: ENVELOPE_RATE, clock: true }, 1, 3)).toBe("unknown");
    expect(classifyGap({ levels, rate: ENVELOPE_RATE, clock: true }, 4.8, 6)).toBe("silent");
  });
});
