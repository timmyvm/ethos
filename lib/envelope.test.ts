import { describe, expect, it } from "vitest";
import {
  calibrate,
  classifyGap,
  ENVELOPE_RATE,
  levelBetween,
  parseEnvelope,
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
