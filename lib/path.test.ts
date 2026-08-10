import { describe, expect, it } from "vitest";
import {
  MAX_STARS,
  nextLesson,
  starsByLesson,
  totalStars,
  unitStates,
} from "./path";

describe("starsByLesson", () => {
  it("keeps the best star ever earned per lesson", () => {
    const map = starsByLesson([
      { lesson_id: "f1", stars: 1 },
      { lesson_id: "f1", stars: 3 },
      { lesson_id: "f1", stars: 2 },
      { lesson_id: "f2", stars: 2 },
    ]);
    expect(map).toEqual({ f1: 3, f2: 2 });
  });

  it("ignores reps with no lesson", () => {
    expect(starsByLesson([{ lesson_id: null, stars: 3 }])).toEqual({});
  });
});

describe("unit gating", () => {
  it("locks later units until enough stars are earned", () => {
    const fresh = unitStates({});
    expect(fresh[0].locked).toBe(false); // Filler opens at 0
    expect(fresh[1].locked).toBe(true); // Pace needs 4
    expect(fresh[3].locked).toBe(true); // Boss needs 12
  });

  it("opens a unit once the star threshold is crossed", () => {
    const map = { f1: 3, f2: 3 }; // 6 stars
    const states = unitStates(map);
    expect(totalStars(map)).toBe(6);
    expect(states[1].locked).toBe(false); // Pace open at 4
    expect(states[2].locked).toBe(true); // Pause needs 8
  });

  it("reports earned vs possible per unit", () => {
    const states = unitStates({ f1: 3, f2: 1 });
    expect(states[0].earned).toBe(4);
    expect(states[0].possible).toBe(9); // three filler lessons
  });
});

describe("nextLesson", () => {
  it("starts at the baseline rep", () => {
    expect(nextLesson({})?.lesson.id).toBe("f1");
  });

  it("skips lessons already at three stars", () => {
    expect(nextLesson({ f1: 3 })?.lesson.id).toBe("f2");
  });

  it("returns to a lesson that only scored partially", () => {
    expect(nextLesson({ f1: 3, f2: 2, f3: 3 })?.lesson.id).toBe("f2");
  });

  it("never routes the daily loop into a boss unit", () => {
    const perfect: Record<string, number> = {};
    for (const id of ["f1", "f2", "f3", "p1", "p2", "h1", "h2"]) perfect[id] = 3;
    expect(nextLesson(perfect)).toBeNull(); // path complete, boss excluded
  });
});

describe("MAX_STARS", () => {
  it("counts every lesson including boss content", () => {
    expect(MAX_STARS).toBe(27); // 7 daily lessons + 2 boss, three stars each
  });
});
