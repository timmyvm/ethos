import { describe, expect, it } from "vitest";
import { CHIME, MILESTONE_CHIME, chimeDuration } from "./sfx";
import { DEFAULT_PREFS } from "./prefs";

/**
 * The chime's contract (DECISIONS #138): short enough to finish inside
 * the reduced-motion celebration hold, warm on a phone speaker, and
 * the milestone variant is longer, never louder.
 */

describe("the celebration chime", () => {
  it("finishes inside the calm celebration hold (1.2s)", () => {
    expect(chimeDuration(CHIME)).toBeLessThanOrEqual(1.2);
    expect(chimeDuration(MILESTONE_CHIME)).toBeLessThanOrEqual(1.2);
  });

  it("stays in the warm band — nothing shrill on a phone speaker", () => {
    for (const n of [...CHIME, ...MILESTONE_CHIME]) {
      expect(n.freq).toBeGreaterThanOrEqual(400);
      expect(n.freq).toBeLessThanOrEqual(1200);
    }
  });

  it("rises — falling pitch reads as failure", () => {
    const freqs = CHIME.map((n) => n.freq);
    expect([...freqs].sort((a, b) => a - b)).toEqual(freqs);
  });

  it("keeps the milestone variant longer, never louder", () => {
    expect(chimeDuration(MILESTONE_CHIME)).toBeGreaterThan(
      chimeDuration(CHIME)
    );
    const maxPeak = Math.max(...CHIME.map((n) => n.peak));
    for (const n of MILESTONE_CHIME) {
      expect(n.peak).toBeLessThanOrEqual(maxPeak);
    }
  });

  it("stays quiet enough to sit under speech, summed", () => {
    const summed = MILESTONE_CHIME.reduce((a, n) => a + n.peak, 0);
    expect(summed).toBeLessThanOrEqual(1);
  });

  it("ships on by default, with the opt-out in settings", () => {
    expect(DEFAULT_PREFS.sound).toBe(true);
  });
});
