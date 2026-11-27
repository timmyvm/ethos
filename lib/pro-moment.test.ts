import { describe, expect, it } from "vitest";
import { PRO_MOMENT_DAYS, proMomentDue } from "./pro-moment";

/**
 * The proactive premium moment fires exactly once, only after the third
 * distinct day of speaking, and never for an account with nothing to
 * buy. DECISIONS #11 is the placement; docs/growth/04 §2 the rules.
 */
describe("proMomentDue", () => {
  const base = { premium: false, daysSpoken: 3, repCount: 3, shown: false, comparable: true };

  it("fires on the third day of speaking", () => {
    expect(proMomentDue(base)).toBe(true);
  });

  it("never fires before day 3, whatever the recording count", () => {
    // Five recordings in one day is enthusiasm, not progress across days.
    expect(proMomentDue({ ...base, daysSpoken: 1, repCount: 5 })).toBe(false);
    expect(proMomentDue({ ...base, daysSpoken: 2 })).toBe(false);
  });

  it("fires late rather than never when day 3's exit was taken", () => {
    // The save-progress wall outranks it; a deferred moment stays due.
    expect(proMomentDue({ ...base, daysSpoken: 7 })).toBe(true);
  });

  it("shows once: the flag ends it for good", () => {
    expect(proMomentDue({ ...base, shown: true })).toBe(false);
  });

  it("never fires for premium", () => {
    expect(proMomentDue({ ...base, premium: true })).toBe(false);
  });

  it("needs two recordings for the card's two ends", () => {
    expect(proMomentDue({ ...base, repCount: 1 })).toBe(false);
  });

  it("waits while the card cannot draw its two ends (the panel's must-fix: no screen of bare ground)", () => {
    // Three days of takes too short to measure: Since day one has no
    // first and latest to stand, so the moment stays due for a later exit.
    expect(proMomentDue({ ...base, daysSpoken: 4, repCount: 6, comparable: false })).toBe(false);
  });

  it("keeps the threshold at three days", () => {
    expect(PRO_MOMENT_DAYS).toBe(3);
  });
});
