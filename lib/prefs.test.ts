import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PREFS, readCaptureMode, writeCaptureMode, writePrefs } from "./prefs";

/** A device's storage, for the prefs that live in it. */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const g = globalThis as { localStorage?: Storage };

beforeEach(() => {
  g.localStorage = fakeStorage();
});
afterEach(() => {
  delete g.localStorage;
});

/** The games plan, item 16: the boss records on Voice unless Video was picked. */
describe("the boss's capture mode", () => {
  it("defaults to Voice for the boss as for a daily lesson", () => {
    expect(DEFAULT_PREFS.captureMode).toEqual({ daily: "voice", boss: "voice" });
    expect(readCaptureMode("boss")).toBe("voice");
    expect(readCaptureMode("daily")).toBe("voice");
  });

  it("reads the old Video default, stored with any other preference, as Voice", () => {
    // What every device that ever saved a preference holds: writePrefs
    // stored the whole object, the boss's old default with it.
    localStorage.setItem(
      "ethos.prefs",
      JSON.stringify({ theme: "dark", captureMode: { daily: "voice", boss: "voice_video" } })
    );
    expect(readCaptureMode("boss")).toBe("voice");
  });

  it("keeps a mode picked on the toggle, for the boss and the daily alike", () => {
    writeCaptureMode("boss", "voice_video");
    expect(readCaptureMode("boss")).toBe("voice_video");
    // Another preference saved later keeps the pick.
    writePrefs({ theme: "light" });
    expect(readCaptureMode("boss")).toBe("voice_video");
    writeCaptureMode("boss", "voice");
    expect(readCaptureMode("boss")).toBe("voice");
    writeCaptureMode("daily", "voice_video");
    expect(readCaptureMode("daily")).toBe("voice_video");
    expect(readCaptureMode("boss")).toBe("voice");
  });

  it("keeps a daily Video stored before the boss's default moved", () => {
    localStorage.setItem(
      "ethos.prefs",
      JSON.stringify({ captureMode: { daily: "voice_video", boss: "voice_video" } })
    );
    expect(readCaptureMode("daily")).toBe("voice_video");
  });
});
