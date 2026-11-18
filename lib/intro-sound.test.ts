import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The walk's one audio context (#501, #501 review): made by the first
 * tap, woken with a silent sample on every tap until it runs (an iPhone
 * makes it on the tap's pointerdown, which WebKit does not count, and
 * lets it sound only on the same tap's touchend), and closed when the
 * walk is left.
 */
class FakeContext {
  static made: FakeContext[] = [];
  state: "suspended" | "running" | "closed" = "suspended";
  sampleRate = 48_000;
  destination = {};
  primed = 0;
  resumed = 0;
  closed = 0;
  constructor() {
    FakeContext.made.push(this);
  }
  createBuffer() {
    return {};
  }
  createBufferSource() {
    return { buffer: null, connect: () => {}, start: () => void (this.primed += 1) };
  }
  resume() {
    this.resumed += 1;
    return Promise.resolve();
  }
  close() {
    this.closed += 1;
    this.state = "closed";
    return Promise.resolve();
  }
}

let sound: typeof import("./intro-sound");
beforeEach(async () => {
  FakeContext.made = [];
  vi.stubGlobal("window", { AudioContext: FakeContext });
  vi.resetModules();
  sound = await import("./intro-sound");
});
afterEach(() => vi.unstubAllGlobals());

describe("the walk's audio context", () => {
  it("is made by the first tap, primed and woken", () => {
    const c = sound.unlockIntroSound() as unknown as FakeContext;
    expect(FakeContext.made).toHaveLength(1);
    expect([c.primed, c.resumed]).toEqual([1, 1]);
  });

  it("is primed and woken again by the next tap while it is not running (the iPhone's touchend)", () => {
    const c = sound.unlockIntroSound() as unknown as FakeContext;
    sound.unlockIntroSound();
    expect(FakeContext.made).toHaveLength(1);
    expect([c.primed, c.resumed]).toEqual([2, 2]);
  });

  it("is left alone once it runs", () => {
    const c = sound.unlockIntroSound() as unknown as FakeContext;
    c.state = "running";
    sound.unlockIntroSound();
    expect([c.primed, c.resumed]).toEqual([1, 1]);
  });

  it("closes when the walk is left, and a later tap makes a new one", () => {
    const c = sound.unlockIntroSound() as unknown as FakeContext;
    sound.closeIntroSound();
    expect(c.closed).toBe(1);
    expect(sound.introContext()).toBeNull();
    sound.unlockIntroSound();
    expect(FakeContext.made).toHaveLength(2);
  });

  it("is nothing where there is no Web Audio", () => {
    vi.stubGlobal("window", {});
    expect(sound.unlockIntroSound()).toBeNull();
    expect(() => sound.closeIntroSound()).not.toThrow();
  });
});
