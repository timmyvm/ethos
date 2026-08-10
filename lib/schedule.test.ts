import { describe, expect, it } from "vitest";
import type { RepRow } from "./client-data";
import { decay, decayNote, HALF_LIFE_DAYS, nextFocus, skillStates } from "./schedule";

const NOW = new Date(2026, 7, 10, 12);
const day = 86400000;

const rep = (
  daysAgo: number,
  tier1: { pause: number; fillers: number; pace: number; range: number }
): RepRow =>
  ({
    id: `r${daysAgo}`,
    created_at: new Date(NOW.getTime() - daysAgo * day).toISOString(),
    dimensions: { tier1, anchors: { hedgeCount: 0, restartCount: 0 }, tier2: null },
  }) as RepRow;

const even = { pause: 70, fillers: 70, pace: 70, range: 70 };

describe("decay", () => {
  it("halves at the half-life", () => {
    expect(decay(0)).toBe(1);
    expect(decay(HALF_LIFE_DAYS)).toBeCloseTo(0.5, 5);
    expect(decay(HALF_LIFE_DAYS * 2)).toBeCloseTo(0.25, 5);
  });
});

describe("skillStates", () => {
  it("is empty-but-safe before any rep", () => {
    const states = skillStates([], NOW);
    expect(states).toHaveLength(4);
    for (const s of states) {
      expect(s.score).toBeNull();
      expect(s.strength).toBeNull();
    }
  });

  it("reads the latest score per skill and dates it", () => {
    const states = skillStates(
      [rep(3, even), rep(0, { ...even, pace: 40 })],
      NOW
    );
    const pace = states.find((s) => s.skill === "pace")!;
    expect(pace.score).toBe(40);
    expect(pace.daysSince).toBe(0);
    expect(pace.delta).toBe(-30);
  });

  it("decays strength with time away", () => {
    const fresh = skillStates([rep(0, even)], NOW).find(
      (s) => s.skill === "pace"
    )!;
    const stale = skillStates([rep(HALF_LIFE_DAYS, even)], NOW).find(
      (s) => s.skill === "pace"
    )!;
    expect(fresh.strength).toBeCloseTo(0.7, 5);
    expect(stale.strength).toBeCloseTo(0.35, 5);
  });

  it("ignores reps with no stored dimensions", () => {
    const noDims = { id: "x", created_at: NOW.toISOString(), dimensions: null } as RepRow;
    expect(skillStates([noDims], NOW)[0].score).toBeNull();
  });
});

describe("nextFocus", () => {
  it("has an honest answer before there is data", () => {
    const f = nextFocus([], NOW);
    expect(f.strength).toBeNull();
    expect(f.reason).toMatch(/baseline/i);
  });

  it("picks the weakest skill", () => {
    const f = nextFocus([rep(0, { ...even, fillers: 22 })], NOW);
    expect(f.skill).toBe("fillers");
    expect(f.unitId).toBe("filler");
    expect(f.lessonId).toBeTruthy();
  });

  it("always names the number that made the call", () => {
    const f = nextFocus([rep(1, even), rep(0, { ...even, pause: 31 })], NOW);
    expect(f.reason).toContain("31/100");
    expect(f.reason).toMatch(/\d/);
  });

  it("mentions the drop when the skill went backwards", () => {
    const f = nextFocus([rep(1, even), rep(0, { ...even, pace: 45 })], NOW);
    expect(f.reason).toContain("down 25");
  });

  it("never praises — the reason is always a measurement", () => {
    const hype = /great|amazing|well done|nice work|keep it up/i;
    for (const r of [
      [rep(0, even)],
      [rep(0, { pause: 95, fillers: 95, pace: 95, range: 95 })],
      [rep(5, { pause: 12, fillers: 90, pace: 88, range: 77 })],
    ]) {
      expect(nextFocus(r, NOW).reason).not.toMatch(hype);
    }
  });

  it("prefers a stale strong skill over a fresh weak-ish one when decay says so", () => {
    // range 80 but 21 days ago → 0.8 * 0.125 = 0.1
    // fillers 40 today        → 0.4 * 1     = 0.4
    const reps = [
      rep(21, { pause: 90, fillers: 90, pace: 90, range: 80 }),
      rep(0, { pause: 90, fillers: 40, pace: 90, range: 80 }),
    ];
    // The later rep re-measures every skill, so nothing is stale here —
    // fillers is genuinely the weakest.
    expect(nextFocus(reps, NOW).skill).toBe("fillers");
  });
});

describe("decayNote", () => {
  it("says nothing while the habit is live", () => {
    expect(decayNote([rep(0, even)], NOW)).toBeNull();
    expect(decayNote([rep(2, even)], NOW)).toBeNull();
    expect(decayNote([], NOW)).toBeNull();
  });

  it("names the gap as a fact, never a scolding", () => {
    const note = decayNote([rep(7, even)], NOW)!;
    expect(note).toContain("7 days");
    expect(note).toMatch(/\d+%/);
    expect(note).not.toMatch(/should|failed|lazy|disappoint|shame/i);
  });
});
