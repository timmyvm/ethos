import { describe, expect, it } from "vitest";
import { dayCount, dayTrail, trainedDays } from "./days";

function rep(date: Date, index: number | null = 600) {
  return { created_at: date.toISOString(), ethos_index: index };
}

const AUG = (d: number, h = 10) => new Date(2026, 7, d, h);

describe("the day counter", () => {
  it("counts days you spoke, not reps", () => {
    expect(dayCount([rep(AUG(9)), rep(AUG(9, 19)), rep(AUG(10))])).toBe(2);
  });

  it("counts days you spoke, not days since you signed up", () => {
    // Two days in August, then nothing for three weeks, then one more.
    const reps = [rep(AUG(1)), rep(AUG(2)), rep(AUG(28))];
    expect(dayCount(reps)).toBe(3);
  });

  /**
   * The whole point of having this alongside the streak: a missed day
   * resets the streak and must never reset this. The morning after a
   * miss should greet you with a number that went up, not one that went
   * to zero.
   */
  it("never resets on a missed day", () => {
    const before = [rep(AUG(1)), rep(AUG(2)), rep(AUG(3))];
    const afterMissingTwo = [...before, rep(AUG(6))];
    expect(dayCount(before)).toBe(3);
    expect(dayCount(afterMissingTwo)).toBe(4);
  });

  it("is zero before the first rep", () => {
    expect(dayCount([])).toBe(0);
  });
});

describe("the day's score", () => {
  it("keeps the day's best, so a warm-up can't erase a good rep", () => {
    const days = trainedDays([rep(AUG(9), 700), rep(AUG(9, 20), 480)]);
    expect(days).toHaveLength(1);
    expect(days[0].index).toBe(700);
  });

  it("leaves a day with nothing scorable in it unscored, not at zero", () => {
    const days = trainedDays([rep(AUG(9), null)]);
    expect(days[0].index).toBeNull();
  });

  it("still counts an unscored day as a day you turned up", () => {
    expect(dayCount([rep(AUG(9), null)])).toBe(1);
  });

  it("numbers days from one, in order", () => {
    const days = trainedDays([rep(AUG(11)), rep(AUG(9)), rep(AUG(10))]);
    expect(days.map((d) => d.day)).toEqual([1, 2, 3]);
    expect(days.map((d) => d.date)).toEqual([
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
    ]);
  });
});

describe("the trail", () => {
  it("says what's missing rather than drawing a flat line", () => {
    expect(dayTrail([]).pending).toBe("Day 1 starts when you do.");
    expect(dayTrail([rep(AUG(9))]).pending).toBe("Day 2 draws the line.");
    expect(dayTrail([rep(AUG(9), null)]).pending).toMatch(/Nothing has scored/);
  });

  it("draws once two days have scored", () => {
    const trail = dayTrail([rep(AUG(9), 540), rep(AUG(10), 602)]);
    expect(trail.pending).toBeNull();
    expect(trail.count).toBe(2);
    expect(trail.points.map((p) => p.index)).toEqual([540, 602]);
  });

  it("plots only the days that scored, but counts all of them", () => {
    const trail = dayTrail([
      rep(AUG(9), 540),
      rep(AUG(10), null),
      rep(AUG(11), 602),
    ]);
    expect(trail.count).toBe(3);
    expect(trail.points).toHaveLength(2);
  });
});

describe("best day yet", () => {
  it("fires when today beats every day before it", () => {
    expect(
      dayTrail([rep(AUG(9), 540), rep(AUG(10), 570), rep(AUG(11), 602)]).bestYet
    ).toBe(true);
  });

  it("stays quiet on a day that isn't a record", () => {
    expect(
      dayTrail([rep(AUG(9), 700), rep(AUG(10), 640), rep(AUG(11), 655)]).bestYet
    ).toBe(false);
  });

  it("does not call matching your old best a record", () => {
    expect(dayTrail([rep(AUG(9), 700), rep(AUG(10), 700)]).bestYet).toBe(false);
  });

  /**
   * A first scored day beats nothing, so there is nothing to celebrate
   * yet — otherwise every user's day one is a "record".
   */
  it("never fires on the first scored day", () => {
    expect(dayTrail([rep(AUG(9), 900)]).bestYet).toBe(false);
  });
});
