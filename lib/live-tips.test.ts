import { describe, expect, it } from "vitest";
import { LIVE_TIPS, TIP_HOLD_S, liveTipAt } from "./live-tips";

describe("liveTipAt", () => {
  it("opens with the beat-of-silence tip", () => {
    expect(liveTipAt(2, 90, false)).toBe("Start with one beat of silence.");
  });

  it("goes quiet between tips", () => {
    // Opening tip fired at 1.8s, expired by 7.8s; next isn't due until 19.8s.
    expect(liveTipAt(14, 90, false)).toBeNull();
  });

  it("holds a tip for TIP_HOLD_S and no longer", () => {
    const at = 0.22 * 90;
    expect(liveTipAt(at + TIP_HOLD_S - 0.1, 90, false)).not.toBeNull();
    expect(liveTipAt(at + TIP_HOLD_S + 0.1, 90, false)).toBeNull();
  });

  it("shows the latest due tip, not the first", () => {
    // Everything up to 0.85 is behind us; the closing line is the point.
    expect(liveTipAt(0.85 * 90 + 1, 90, false)).toBe(
      "Last line is the one they keep."
    );
  });

  it("swaps the mid-rep tip for a body-language one on camera", () => {
    const at = 0.62 * 60 + 1;
    expect(liveTipAt(at, 60, false)).toBe("Changing subject? Pause first.");
    expect(liveTipAt(at, 60, true)).toBe(
      "Let your hands finish the sentence."
    );
  });

  it("scales the arc to a short drill", () => {
    // A 30s drill still gets the closing line, not just the opener.
    expect(liveTipAt(26, 30, false)).toBe("Last line is the one they keep.");
  });

  it("returns nothing before the rep or with no cap", () => {
    expect(liveTipAt(-1, 90, false)).toBeNull();
    expect(liveTipAt(5, 0, false)).toBeNull();
  });

  it("keeps every tip glanceable", () => {
    // You cannot read and speak at once. Anything longer is a distraction.
    for (const tip of LIVE_TIPS) {
      expect(tip.text.length, tip.text).toBeLessThanOrEqual(42);
    }
  });

  it("never leaves two tips due at the same instant for one mode", () => {
    for (const video of [true, false]) {
      const seen = new Set<number>();
      for (const tip of LIVE_TIPS) {
        if (tip.video !== undefined && tip.video !== video) continue;
        expect(seen.has(tip.at), `${tip.at}`).toBe(false);
        seen.add(tip.at);
      }
    }
  });
});
