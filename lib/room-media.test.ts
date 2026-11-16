import { afterEach, describe, expect, it, vi } from "vitest";
import { askMic, askMotion, openMic, whenVisible, type Visibility } from "./room-media";

/*
 * The room's asks and its mic (#475). The asks must start inside the
 * lift, before anything is awaited (an iPhone answers a motion ask only
 * from a tap), and every track the room opens must be stopped: no mic
 * light left on, ever.
 */

type FakeTrack = { stopped: boolean; stop: () => void };
function fakeStream(n = 1) {
  const tracks: FakeTrack[] = Array.from({ length: n }, () => {
    const t: FakeTrack = { stopped: false, stop: () => (t.stopped = true) };
    return t;
  });
  return { tracks, stream: { getTracks: () => tracks } as unknown as MediaStream };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("asking inside the lift", () => {
  it("calls getUserMedia synchronously, then lets the stream go at once", async () => {
    const { tracks, stream } = fakeStream(2);
    const gum = vi.fn(() => Promise.resolve(stream));
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: gum } });
    const answer = askMic();
    /* Asked in the same task as the lift, before any await. */
    expect(gum).toHaveBeenCalledTimes(1);
    expect(await answer).toBe("granted");
    expect(tracks.every((t) => t.stopped)).toBe(true);
  });

  it("hears no as denied and a missing mic as unavailable", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: () => Promise.reject(new DOMException("no", "NotAllowedError")) },
    });
    expect(await askMic()).toBe("denied");
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: () => Promise.reject(new DOMException("none", "NotFoundError")) },
    });
    expect(await askMic()).toBe("unavailable");
    vi.stubGlobal("navigator", {});
    expect(await askMic()).toBe("unavailable");
  });

  it("asks an iPhone for motion synchronously, and grants it where nothing asks", async () => {
    const ask = vi.fn(() => Promise.resolve("granted" as const));
    vi.stubGlobal("window", { DeviceOrientationEvent: { requestPermission: ask } });
    const answer = askMotion();
    expect(ask).toHaveBeenCalledTimes(1);
    expect(await answer).toBe("granted");

    vi.stubGlobal("window", { DeviceOrientationEvent: { requestPermission: () => Promise.reject(new Error("gesture")) } });
    expect(await askMotion()).toBe("denied");

    vi.stubGlobal("window", { DeviceOrientationEvent: function DeviceOrientationEvent() {} });
    expect(await askMotion()).toBe("granted");

    vi.stubGlobal("window", {});
    expect(await askMotion()).toBe("unavailable");
  });
});

describe("a turn's mic", () => {
  function fakeContext(state: AudioContextState = "running") {
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    return {
      source,
      ctx: {
        state,
        resume: vi.fn(() => Promise.resolve()),
        createMediaStreamSource: vi.fn(() => source),
        createAnalyser: () => ({ fftSize: 0, getFloatTimeDomainData: (a: Float32Array) => a.fill(0.1) }),
      } as unknown as AudioContext,
    };
  }

  it("reads a level, and close stops every track and lets the source go", async () => {
    const { tracks, stream } = fakeStream(1);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => Promise.resolve(stream) } });
    const { ctx, source } = fakeContext();
    const mic = await openMic(ctx);
    expect(mic.level()).toBeCloseTo(0.1, 5);
    mic.close();
    mic.close();
    expect(tracks[0].stopped).toBe(true);
    expect(source.disconnect).toHaveBeenCalledTimes(1);
    expect(mic.level()).toBe(0);
  });

  it("stops the tracks it got when the context cannot take them", async () => {
    const { tracks, stream } = fakeStream(1);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => Promise.resolve(stream) } });
    const { ctx } = fakeContext("closed");
    (ctx as unknown as { createMediaStreamSource: () => never }).createMediaStreamSource = () => {
      throw new DOMException("closed", "InvalidStateError");
    };
    await expect(openMic(ctx)).rejects.toBeTruthy();
    expect(tracks[0].stopped).toBe(true);
  });

  it("never opens without a context to hear it through", async () => {
    const gum = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: gum } });
    await expect(openMic(null)).rejects.toBeTruthy();
    expect(gum).not.toHaveBeenCalled();
  });
});

describe("waiting for the page", () => {
  function fakeDoc(state: DocumentVisibilityState) {
    const t = new EventTarget();
    const doc = {
      visibilityState: state,
      addEventListener: t.addEventListener.bind(t),
      removeEventListener: t.removeEventListener.bind(t),
    };
    return {
      doc: doc as unknown as Visibility,
      show(s: DocumentVisibilityState) {
        doc.visibilityState = s;
        t.dispatchEvent(new Event("visibilitychange"));
      },
    };
  }
  const settled = async (p: Promise<void>) => {
    let done = false;
    void p.then(() => (done = true));
    await Promise.resolve();
    await Promise.resolve();
    return done;
  };

  it("goes on at once on a page in front", async () => {
    expect(await settled(whenVisible(fakeDoc("visible").doc, new AbortController().signal))).toBe(true);
  });

  it("waits while the page is hidden, and goes on when it is back", async () => {
    const d = fakeDoc("hidden");
    const wait = whenVisible(d.doc, new AbortController().signal);
    expect(await settled(wait)).toBe(false);
    d.show("hidden");
    expect(await settled(wait)).toBe(false);
    d.show("visible");
    expect(await settled(wait)).toBe(true);
  });

  it("lets go when the scene is left", async () => {
    const d = fakeDoc("hidden");
    const ctl = new AbortController();
    const wait = whenVisible(d.doc, ctl.signal);
    ctl.abort();
    expect(await settled(wait)).toBe(true);
  });
});
