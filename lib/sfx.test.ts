import { describe, expect, it } from "vitest";
import {
  CHIME,
  MASTER_GAIN,
  MILESTONE_CHIME,
  chimeDuration,
} from "./sfx";
import { DEFAULT_PREFS } from "./prefs";

/**
 * The chime's contract (DECISIONS #138–#139): short enough to finish
 * inside the reduced-motion celebration hold, inside the band a phone
 * speaker can say, rising, and the milestone variant is longer and
 * resolved — never louder.
 */

describe("the celebration chime", () => {
  it("finishes inside the calm celebration hold (1.2s)", () => {
    expect(chimeDuration(CHIME)).toBeLessThanOrEqual(1.2);
    expect(chimeDuration(MILESTONE_CHIME)).toBeLessThanOrEqual(1.2);
  });

  it("keeps every fundamental in the phone-speaker band (250–1200 Hz)", () => {
    for (const n of [...CHIME, ...MILESTONE_CHIME]) {
      expect(n.freq).toBeGreaterThanOrEqual(250);
      expect(n.freq).toBeLessThanOrEqual(1200);
    }
  });

  it("rises — falling pitch reads as failure, and failure has no sound", () => {
    for (const notes of [CHIME, MILESTONE_CHIME]) {
      const freqs = notes.map((n) => n.freq);
      expect([...freqs].sort((a, b) => a - b)).toEqual(freqs);
    }
  });

  /**
   * A milestone says more, never shouts more. The slot-machine
   * literature is what louder-on-bigger trains people into, and the
   * researched spec's louder accent note is the one part deliberately
   * not adopted (#139).
   */
  it("keeps the milestone variant longer, never louder", () => {
    expect(chimeDuration(MILESTONE_CHIME)).toBeGreaterThan(
      chimeDuration(CHIME)
    );
    const maxPeak = Math.max(...CHIME.map((n) => n.peak));
    for (const n of MILESTONE_CHIME) {
      expect(n.peak).toBeLessThanOrEqual(maxPeak);
    }
  });

  it("stays under speech after the master gain, even summed", () => {
    const summed = MILESTONE_CHIME.reduce((a, n) => a + n.peak, 0);
    expect(summed * MASTER_GAIN).toBeLessThanOrEqual(0.5);
  });

  it("ships on by default, with the opt-out in settings", () => {
    expect(DEFAULT_PREFS.sound).toBe(true);
  });
});
