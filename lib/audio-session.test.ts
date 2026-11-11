import { describe, expect, it } from "vitest";
import { setAudioSession } from "./audio-session";

/* The playback bug (#436): an iPhone that has just recorded plays a take
   through the earpiece until the page asks for the speaker. */
describe("setAudioSession", () => {
  it("asks an iPhone for the speaker, and for its own choice again", () => {
    const nav = { audioSession: { type: "auto" } };
    expect(setAudioSession("playback", nav)).toBe(true);
    expect(nav.audioSession.type).toBe("playback");
    expect(setAudioSession("auto", nav)).toBe(true);
    expect(nav.audioSession.type).toBe("auto");
  });

  it("does nothing, quietly, where there is no such thing", () => {
    expect(setAudioSession("playback", {})).toBe(false);
    expect(setAudioSession("playback", undefined)).toBe(false);
    expect(setAudioSession("playback", { audioSession: null })).toBe(false);
  });

  it("says so when the browser refuses the value", () => {
    const frozen = { audioSession: Object.freeze({ type: "auto" }) };
    expect(setAudioSession("playback", frozen)).toBe(false);
    const throwing = {
      audioSession: {
        get type() {
          return "auto";
        },
        set type(_v: string) {
          throw new Error("InvalidStateError");
        },
      },
    };
    expect(setAudioSession("playback", throwing)).toBe(false);
  });
});
