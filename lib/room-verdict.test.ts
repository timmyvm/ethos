import { describe, expect, it } from "vitest";
import { TURN } from "./room-script";
import {
  createVoiceGate,
  noiseFloor,
  readTurn,
  roomVerdict,
  VERDICT,
  voiceThreshold,
  VOICE,
  type TurnTrace,
} from "./room-verdict";

/*
 * Traces built the way the room hears them: one level a frame (60 a
 * second), a floor of room noise, and voice as syllables over it, about
 * four a second with the dips between them.
 */
const FRAME = 1000 / 60;

type Part = { ms: number; voice?: number; noise?: number };

function trace(parts: Part[], seed = 3): TurnTrace {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const samples: { at: number; level: number }[] = [];
  let at = 0;
  for (const p of parts) {
    const end = at + p.ms;
    const noise = p.noise ?? 0.002;
    for (; at < end; at += FRAME) {
      let level = noise * (0.7 + 0.6 * rnd());
      if (p.voice) {
        /* Syllables: a 4 Hz swell, deep dips between them. */
        const swell = Math.max(0, Math.sin((at / 1000) * Math.PI * 2 * 4));
        level += p.voice * (0.15 + 0.85 * swell);
      }
      samples.push({ at, level });
    }
  }
  return { samples };
}

const QUIET = 0.002;
const SPEECH = 0.12;

describe("the noise floor", () => {
  it("is where the room's silence sits, not zero", () => {
    expect(noiseFloor(trace([{ ms: 3000 }]).samples.map((s) => s.level))).toBeCloseTo(QUIET * 0.75, 3);
    expect(noiseFloor(trace([{ ms: 3000, noise: 0.012 }]).samples.map((s) => s.level))).toBeGreaterThan(0.008);
  });

  it("stays inside its bounds", () => {
    expect(noiseFloor([])).toBe(VOICE.floorMin);
    expect(noiseFloor([0, 0, 0])).toBe(VOICE.floorMin);
    expect(noiseFloor([0.5, 0.5])).toBe(VOICE.floorMax);
  });

  it("sets voice a clear step above it", () => {
    expect(voiceThreshold(0.001)).toBe(VOICE.minLevel);
    expect(voiceThreshold(0.01)).toBeCloseTo(0.03, 5);
  });
});

describe("reading a turn", () => {
  it("measures the voice, the time to the first word and the share of the span", () => {
    const t = trace([{ ms: 1000 }, { ms: 6000, voice: SPEECH }, { ms: 2500 }]);
    const r = readTurn(t, voiceThreshold(noiseFloor(t.samples.map((s) => s.level))));
    expect(r.startMs).toBeGreaterThan(900);
    expect(r.startMs).toBeLessThan(1150);
    expect(r.voicedMs).toBeGreaterThan(4000);
    expect(r.spanMs).toBeLessThan(7200);
    /* The silence that ended the turn is not counted against it. */
    expect(r.share).toBeGreaterThan(0.6);
  });

  it("finds no voice in a silent turn", () => {
    const r = readTurn(trace([{ ms: 10_000 }]), VOICE.minLevel);
    expect(r).toEqual({ voicedMs: 0, spanMs: 0, share: 0, startMs: null });
  });
});

describe("the verdict", () => {
  const steady = (seed: number) => trace([{ ms: 900 }, { ms: 7000, voice: SPEECH }, { ms: 2500 }], seed);

  it("is alright for steady speech in both turns", () => {
    expect(roomVerdict([steady(1), steady(2)])).toBe("alright");
  });

  it("is alright in a noisy room too: voice is measured against the room", () => {
    const loud = (seed: number) => trace([{ ms: 900, noise: 0.015 }, { ms: 7000, voice: 0.2, noise: 0.015 }, { ms: 2500, noise: 0.015 }], seed);
    expect(roomVerdict([loud(4), loud(5)])).toBe("alright");
  });

  it("is horrible for silence", () => {
    const silent = trace([{ ms: TURN.waitMs }]);
    expect(roomVerdict([silent, silent])).toBe("horrible");
  });

  it("is horrible when one turn was barely answered", () => {
    const barely = trace([{ ms: 1200 }, { ms: 900, voice: SPEECH }, { ms: 2500 }]);
    expect(roomVerdict([steady(1), barely])).toBe("horrible");
  });

  it("is horrible for barely speaking at all, however steady", () => {
    const short = (seed: number) => trace([{ ms: 600 }, { ms: 2200, voice: SPEECH }, { ms: 2500 }], seed);
    expect(roomVerdict([short(1), short(2)])).toBe("horrible");
  });

  it("is horrible for a long silence before answering", () => {
    const late = trace([{ ms: VERDICT.maxStartMs + 1500 }, { ms: 7000, voice: SPEECH }, { ms: 2500 }]);
    expect(roomVerdict([steady(3), late])).toBe("horrible");
  });

  it("is horrible for speech broken by long silences", () => {
    const halting = (seed: number) =>
      trace(
        [
          { ms: 800 },
          { ms: 700, voice: SPEECH },
          { ms: 2300 },
          { ms: 700, voice: SPEECH },
          { ms: 2300 },
          { ms: 1000, voice: SPEECH },
          { ms: 2300 },
          { ms: 700, voice: SPEECH },
          { ms: 2500 },
        ],
        seed
      );
    expect(roomVerdict([halting(1), halting(2)])).toBe("horrible");
  });

  it("is horrible for a hum that never changes (a fan is not a voice)", () => {
    const fan = trace([{ ms: 10_000, noise: 0.02 }]);
    expect(roomVerdict([fan, fan])).toBe("horrible");
  });

  it("is horrible with nothing heard at all", () => {
    expect(roomVerdict([])).toBe("horrible");
  });
});

describe("the live gate", () => {
  const feed = (t: TurnTrace, rule = TURN) => {
    const gate = createVoiceGate(rule);
    for (const s of t.samples) {
      const g = gate.push(s.level, s.at);
      if (g.ended) return { at: s.at, ...g };
    }
    return null;
  };

  it("ends a turn about 2.5 s after speech stops", () => {
    const end = feed(trace([{ ms: 800 }, { ms: 4000, voice: SPEECH }, { ms: 6000 }]));
    expect(end?.ended).toBe("silence");
    expect(end!.at).toBeGreaterThan(4800 + TURN.silenceMs - 300);
    expect(end!.at).toBeLessThan(4800 + TURN.silenceMs + 300);
  });

  it("does not end on the dips between words", () => {
    const end = feed(trace([{ ms: 500 }, { ms: 20_000, voice: SPEECH }, { ms: 3000 }]));
    expect(end?.ended).toBe("silence");
    expect(end!.at).toBeGreaterThan(20_500);
  });

  it("ends at the cap however long someone talks", () => {
    const end = feed(trace([{ ms: 200 }, { ms: 40_000, voice: SPEECH }]));
    expect(end?.ended).toBe("cap");
    expect(end!.at).toBeGreaterThanOrEqual(TURN.capMs - FRAME);
    expect(end!.at).toBeLessThan(TURN.capMs + FRAME);
  });

  it("stops waiting for someone who never speaks", () => {
    const end = feed(trace([{ ms: 30_000 }]));
    expect(end?.ended).toBe("wait");
    expect(end!.at).toBeGreaterThanOrEqual(TURN.waitMs - FRAME);
  });

  it("follows the room's own noise rather than calling it speech", () => {
    const end = feed(trace([{ ms: 30_000, noise: 0.02 }]));
    expect(end?.ended).toBe("wait");
  });

  it("lights the meter for voice and leaves it low for the room", () => {
    const gate = createVoiceGate();
    let quiet = 0;
    let loud = 0;
    for (const s of trace([{ ms: 1000 }, { ms: 1000, voice: 0.2 }]).samples) {
      const g = gate.push(s.level, s.at);
      if (s.at < 1000) quiet = Math.max(quiet, g.meter);
      else loud = Math.max(loud, g.meter);
    }
    expect(quiet).toBeLessThan(0.15);
    expect(loud).toBeGreaterThan(0.7);
  });
});
