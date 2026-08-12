import { describe, expect, it } from "vitest";
import {
  CHIME,
  MASTER_GAIN,
  MILESTONE_CHIME,
  chimeDuration,
} from "./sfx";
import { DEFAULT_PREFS } from "./prefs";

/**
 * The chime's contract (DECISIONS #138–#140): short enough to finish
 * inside the reduced-motion celebration hold, inside the band a phone
 * speaker can say, rising, escalating for milestones — and only ever
 * attached to a real, earned event (the half of the casino playbook
 * that stays banned; the arousal half is the fanfare itself).
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
   * #140: milestones escalate — longer, higher, and allowed to be
   * louder — but the accent has a hard ceiling and the mix can never
   * clip. Arousal scales with the REAL win; the ceiling is what keeps
   * "bigger" from drifting into "screaming".
   */
  it("escalates the milestone fanfare without clipping", () => {
    expect(chimeDuration(MILESTONE_CHIME)).toBeGreaterThan(
      chimeDuration(CHIME)
    );
    expect(MILESTONE_CHIME.length).toBeGreaterThan(CHIME.length);
    for (const n of [...CHIME, ...MILESTONE_CHIME]) {
      expect(n.peak).toBeLessThanOrEqual(0.7);
    }
    for (const notes of [CHIME, MILESTONE_CHIME]) {
      const summed = notes.reduce((a, n) => a + n.peak, 0);
      expect(summed * MASTER_GAIN).toBeLessThanOrEqual(1);
    }
  });

  it("ships on by default, with the opt-out in settings", () => {
    expect(DEFAULT_PREFS.sound).toBe(true);
  });
});
