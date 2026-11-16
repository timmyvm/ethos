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

/*
 * Closer to a phone in a hand (the review of #475). The traces above
 * swell evenly; speech does not. Here a turn is phrases of three to seven
 * words, each word one to three syllables at its own loudness (6 dB
 * either way), quieter at a phrase's end, true silence in the stops and
 * between some words, and pauses between phrases. Run through the live
 * gate as the room runs it, so a turn ends where the room would end it.
 */
describe("the verdict on speech shaped like speech", () => {
  type Seg = { sil: number } | { words: number; level: number } | { hum: number; level: number };
  const dB = (d: number) => Math.pow(10, d / 20);

  function render(segs: Seg[], noise: number, seed: number): number[] {
    let s = seed;
    const r = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    const out: number[] = [];
    const run = (ms: number, f: (t: number) => number) => {
      for (let t = 0; t < ms; t += FRAME) out.push(Math.hypot(noise * (0.6 + 0.8 * r()), f(t)));
    };
    for (const g of [...segs, { sil: 3000 }]) {
      if ("sil" in g) run(g.sil, () => 0);
      else if ("hum" in g) run(g.hum, (t) => g.level * Math.sin((Math.PI * t) / g.hum));
      else
        for (let w = 0; w < g.words; w++) {
          const last = w === g.words - 1;
          const wl = g.level * dB((r() * 2 - 1) * 6) * (last ? dB(-5) : 1);
          const syl = 1 + Math.floor(r() * 3);
          for (let k = 0; k < syl; k++) {
            const ms = 140 + r() * 140;
            run(ms, (t) => wl * Math.max(0.08, Math.sin((Math.PI * t) / ms) ** 2));
            if (k < syl - 1 && r() < 0.3) run(30 + r() * 40, () => 0);
          }
          if (!last && r() >= 0.6) run(40 + r() * 110, () => 0);
        }
    }
    return out;
  }

  /* The live gate decides where the turn ends; the trace stops there. */
  function heard(levels: number[]): TurnTrace {
    const gate = createVoiceGate(TURN);
    const samples: { at: number; level: number }[] = [];
    for (let i = 0; i < levels.length; i++) {
      samples.push({ at: i * FRAME, level: levels[i] });
      if (gate.push(levels[i], i * FRAME).ended) break;
    }
    return { samples };
  }

  const phrases = (n: number, level: number, pause: number, um = false): Seg[] =>
    Array.from({ length: n }, (_, i) => [
      { words: 3 + ((i * 3) % 5), level },
      ...(i < n - 1 ? [{ sil: pause }, ...(um && i % 2 === 0 ? [{ hum: 450, level: level * 0.5 }, { sil: 250 }] : [])] : []),
    ]).flat();

  /* A bedroom with the phone's noise suppression on, a quiet office, a café. */
  const ROOMS = [0.0008, 0.004, 0.012];
  const verdicts = (turn: (k: number) => Seg[], noise: number) =>
    [1, 2, 3, 4, 5].map((seed) => roomVerdict([0, 1].map((k) => heard(render(turn(k), noise, seed * 10 + k)))));

  it("is alright for someone who answers and keeps talking, in any of the rooms", () => {
    for (const noise of ROOMS) {
      expect(verdicts(() => [{ sil: 1100 }, ...phrases(4, 0.07, 450)], noise)).toEqual(Array(5).fill("alright"));
    }
  });

  it("is alright for a nervous answer: a slow start, an um, pauses of a second", () => {
    for (const noise of [0.0008, 0.004]) {
      expect(verdicts(() => [{ sil: 2600 }, { hum: 500, level: 0.03 }, { sil: 600 }, ...phrases(4, 0.05, 1000, true)], noise)).toEqual(
        Array(5).fill("alright")
      );
    }
  });

  it("is alright for a soft voice in a quiet room: it is measured against the room, not a loud one", () => {
    expect(verdicts(() => [{ sil: 1200 }, ...phrases(4, 0.014, 500)], 0.0008)).toEqual(Array(5).fill("alright"));
  });

  it("is horrible for one short sentence a turn", () => {
    for (const noise of ROOMS) expect(verdicts(() => [{ sil: 1500 }, ...phrases(1, 0.06, 0)], noise)).toEqual(Array(5).fill("horrible"));
  });

  it("is horrible for a few words with two seconds of nothing between them", () => {
    const halting: Seg[] = [{ sil: 2500 }, { words: 2, level: 0.05 }, { sil: 2200 }, { words: 2, level: 0.05 }, { sil: 2300 }, { words: 3, level: 0.05 }];
    for (const noise of ROOMS) expect(verdicts(() => halting, noise)).toEqual(Array(5).fill("horrible"));
  });

  it("is horrible for a mumble", () => {
    const mumble: Seg[] = [{ sil: 2500 }, { hum: 500, level: 0.02 }, { sil: 900 }, { words: 3, level: 0.02 }];
    for (const noise of ROOMS) expect(verdicts(() => mumble, noise)).toEqual(Array(5).fill("horrible"));
  });

  it("is horrible for near silence: a breath, the phone knocked, another breath", () => {
    const near: Seg[] = [{ sil: 1500 }, { hum: 900, level: 0.004 }, { sil: 2500 }, { hum: 120, level: 0.05 }, { sil: 3000 }, { hum: 900, level: 0.004 }];
    for (const noise of ROOMS) expect(verdicts(() => near, noise)).toEqual(Array(5).fill("horrible"));
  });

  it("is horrible for a fluent answer that waited over five seconds to start", () => {
    const late = (k: number): Seg[] => [{ sil: k === 1 ? 5200 : 1000 }, ...phrases(4, 0.06, 400)];
    for (const noise of ROOMS) expect(verdicts(late, noise)).toEqual(Array(5).fill("horrible"));
  });
});
