import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CueRunner,
  LIMIT,
  SETTLE_S,
  playBlips,
  playSound,
  resetSoundForTests,
  soundContext,
  unlockSound,
} from "./sound";
import { RECIPES, VOICES, type Cue } from "./sound-recipes";
import { claimXpTicks } from "./use-sound-cues";

/**
 * The kit's contract (#505): one context, made only in a tap; one switch
 * (Settings' Sound), which a forced audition alone may pass; nothing
 * through a paused context; the ambient session so the silent switch
 * holds; a limiter on the master; and a moment's cues played on its
 * clock, each slot once.
 */

/* A Web Audio stand-in that records what was asked of it. */
class Param {
  value = 0;
  calls: [string, number, number?][] = [];
  setValueAtTime(v: number, t: number) {
    this.calls.push(["set", v, t]);
    this.value = v;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push(["lin", v, t]);
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.calls.push(["exp", v, t]);
  }
  cancelScheduledValues(t: number) {
    this.calls.push(["cancel", 0, t]);
  }
}
class Node {
  outs: Node[] = [];
  constructor(public kind: string, public ctx: FakeContext) {
    ctx.nodes.push(this);
  }
  connect<T extends Node>(n: T): T {
    this.outs.push(n);
    return n;
  }
  disconnect() {}
}
class Source extends Node {
  started: number | null = null;
  stopped: number | null = null;
  start(t = 0) {
    this.started = t;
  }
  stop(t = 0) {
    this.stopped = t;
  }
}
class FakeContext {
  static made = 0;
  nodes: Node[] = [];
  state: "running" | "suspended" | "closed" = "suspended";
  currentTime = 10;
  sampleRate = 4000;
  destination = { kind: "destination" } as unknown as Node;
  resumes = 0;
  constructor() {
    FakeContext.made++;
  }
  resume() {
    this.resumes++;
    this.state = "running";
    return Promise.resolve();
  }
  createGain() {
    return Object.assign(new Node("gain", this), { gain: new Param() });
  }
  createBiquadFilter() {
    return Object.assign(new Node("filter", this), { type: "", frequency: new Param(), Q: new Param(), gain: new Param() });
  }
  createDynamicsCompressor() {
    return Object.assign(new Node("compressor", this), {
      threshold: new Param(),
      knee: new Param(),
      ratio: new Param(),
      attack: new Param(),
      release: new Param(),
    });
  }
  createConvolver() {
    return Object.assign(new Node("convolver", this), { buffer: null as unknown });
  }
  createStereoPanner() {
    return Object.assign(new Node("panner", this), { pan: new Param() });
  }
  createBuffer(channels: number, length: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: (c: number) => data[c], length };
  }
  createBufferSource() {
    return Object.assign(new Source("buffer", this), { buffer: null as unknown, loop: false });
  }
  createOscillator() {
    return Object.assign(new Source("osc", this), { type: "", frequency: new Param(), detune: new Param() });
  }
  of(kind: string) {
    return this.nodes.filter((n) => n.kind === kind);
  }
}

const store = new Map<string, string>();
let session: { type: string } | undefined;

beforeEach(() => {
  resetSoundForTests();
  FakeContext.made = 0;
  store.clear();
  session = { type: "auto" };
  vi.stubGlobal("window", { AudioContext: FakeContext });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("navigator", {
    get audioSession() {
      return session;
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const soundOff = () => store.set("ethos.prefs", JSON.stringify({ sound: false }));
const ctx = () => soundContext() as unknown as FakeContext;

describe("the context: made only in a tap", () => {
  it("plays nothing before a tap has made the context, and makes none", () => {
    expect(playSound("star-1")).toBeNull();
    expect(FakeContext.made).toBe(0);
  });

  it("makes one context in the tap, wakes it, primes it with a silent sample and builds the master there", () => {
    const c = unlockSound() as unknown as FakeContext;
    expect(FakeContext.made).toBe(1);
    expect(c.state).toBe("running");
    expect(c.of("buffer")[0]).toMatchObject({ started: 0 });
    expect(c.of("compressor")).toHaveLength(1);
    expect(unlockSound()).toBe(c as unknown as AudioContext);
    expect(FakeContext.made).toBe(1);
  });

  it("asks for the ambient session in the tap, so the silent switch holds and other audio keeps playing", () => {
    unlockSound();
    expect(session?.type).toBe("ambient");
  });
});

describe("the switch (Settings, Sound)", () => {
  it("plays with Sound on, the default", () => {
    unlockSound();
    expect(playSound("star-1")).not.toBeNull();
  });

  it("plays nothing with Sound off, unless the audition forces it", () => {
    unlockSound();
    soundOff();
    const before = ctx().of("osc").length;
    expect(playSound("payout")).toBeNull();
    expect(ctx().of("osc").length).toBe(before);
    expect(playSound("payout", { force: true })).not.toBeNull();
  });

  it("plays nothing through a context the phone paused, and asks it to wake", () => {
    unlockSound();
    ctx().state = "suspended";
    const resumes = ctx().resumes;
    expect(playSound("star-2")).toBeNull();
    expect(ctx().resumes).toBe(resumes + 1);
  });

  it("leaves a playing take's session alone", () => {
    unlockSound();
    session = { type: "playback" };
    playSound("star-1");
    expect(session.type).toBe("playback");
  });
});

describe("playing a sound", () => {
  it("strikes every partial of every note, after the limiter has settled", () => {
    const c = unlockSound() as unknown as FakeContext;
    const before = c.of("osc").length;
    c.currentTime = 10.1;
    playSound("star-3");
    const oscs = c.of("osc").slice(before) as Source[];
    const partials = RECIPES["star-3"].notes.reduce((a, n) => a + VOICES[n.voice].length, 0);
    expect(oscs).toHaveLength(partials);
    for (const o of oscs) expect(o.started!).toBeGreaterThanOrEqual(10 + SETTLE_S - 1e-9);
  });

  it("runs the master through a limiter, so a pile of coins never clips", () => {
    const c = unlockSound() as unknown as FakeContext;
    const lim = c.of("compressor")[0] as unknown as { threshold: Param; ratio: Param };
    expect(lim.threshold.value).toBe(LIMIT.threshold);
    expect(LIMIT.threshold).toBeLessThanOrEqual(-1);
    expect(lim.ratio.value).toBeGreaterThanOrEqual(12);
  });

  it("stops a sound in a 40ms fade", () => {
    const c = unlockSound() as unknown as FakeContext;
    const p = playSound("payout")!;
    c.currentTime = 11;
    p.stop();
    const stops = c.of("osc").map((o) => (o as Source).stopped);
    expect(stops.every((s) => s !== null)).toBe(true);
  });

  it("plays the introduction's blips on the same context and switch", () => {
    const c = unlockSound() as unknown as FakeContext;
    const before = c.of("osc").length;
    const blip = { type: "sine" as const, freq: 600, endFreq: 470, peak: 0.03, attackS: 0.004, decayS: 0.036, at: 0 };
    playBlips([blip]);
    expect(c.of("osc").length).toBe(before + 1);
    soundOff();
    playBlips([blip]);
    expect(c.of("osc").length).toBe(before + 1);
  });
});

describe("CueRunner: a moment's sounds on its clock", () => {
  function clock() {
    let now = 0;
    let id = 0;
    const timers = new Map<number, { at: number; fn: () => void }>();
    return {
      now: () => now,
      set: (fn: () => void, ms: number) => {
        timers.set(++id, { at: now + ms, fn });
        return id;
      },
      clear: (h: unknown) => void timers.delete(h as number),
      advance(ms: number) {
        now += ms;
        for (const [k, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
          if (t.at <= now) {
            timers.delete(k);
            t.fn();
          }
        }
      },
      pending: () => timers.size,
    };
  }
  const cue = (sound: Cue["sound"], atMs: number, slot: string = sound): Cue => ({ sound, atMs, slot });

  it("plays each cue at its time", () => {
    const c = clock();
    const played: string[] = [];
    const r = new CueRunner((q: Cue) => void played.push(q.sound), c);
    r.run([cue("star-1", 660), cue("star-2", 780)]);
    c.advance(700);
    expect(played).toEqual(["star-1"]);
    c.advance(100);
    expect(played).toEqual(["star-1", "star-2"]);
  });

  it("never plays a slot twice, and a moment read later takes the slot it waited in", () => {
    const c = clock();
    const played: string[] = [];
    const r = new CueRunner((q: Cue) => void played.push(q.sound), c);
    r.run([cue("star-1", 100), cue("best", 1000, "top")]);
    c.advance(200);
    /* The level-up is read after the stored row lands: it replaces the best. */
    r.run([cue("star-1", 100), cue("level", 1000, "top")]);
    c.advance(1000);
    expect(played).toEqual(["star-1", "level"]);
  });

  it("plays a cue that arrives after its time at once", () => {
    const c = clock();
    const played: string[] = [];
    const r = new CueRunner((q: Cue) => void played.push(q.sound), c);
    r.run([cue("star-1", 100)]);
    c.advance(2000);
    r.run([cue("star-1", 100), cue("lesson", 1000, "top")]);
    c.advance(0);
    expect(played).toEqual(["star-1", "lesson"]);
  });

  it("drops whatever has not played when the screen goes", () => {
    const c = clock();
    const played: string[] = [];
    const r = new CueRunner((q: Cue) => void played.push(q.sound), c);
    r.run([cue("star-1", 100), cue("payout", 1000)]);
    c.advance(150);
    r.cancel();
    c.advance(2000);
    expect(played).toEqual(["star-1"]);
    expect(c.pending()).toBe(0);
  });
});

describe("XP today's ticks on You", () => {
  it("are owed once per rise this phone has heard, and only when a sound could play", () => {
    expect(claimXpTicks(30, "2026-11-18")).toBe(false); // no tap yet: still owed
    unlockSound();
    expect(claimXpTicks(30, "2026-11-18")).toBe(true);
    expect(claimXpTicks(30, "2026-11-18")).toBe(false);
    expect(claimXpTicks(40, "2026-11-18")).toBe(true);
    soundOff();
    expect(claimXpTicks(50, "2026-11-18")).toBe(false);
  });
});
