import { describe, expect, it } from "vitest";
import { CHIME, MILESTONE_CHIME } from "./sfx";
import { computeStreak } from "./streak";
import {
  bridgedDays,
  dayKey,
  freezeLine,
  momentTimeline,
  momentWeek,
  odometer,
  streakLabel,
  streakLine,
  streakMoment,
} from "./streak-moment";

/* Thursday 19 November 2026, 19:30 local: the week runs Monday 16 to Sunday 22. */
const NOW = new Date(2026, 10, 19, 19, 30);
const ago = (n: number, h = 18) => new Date(2026, 10, 19 - n, h, 12);
const TODAY = ago(0, 19);

/**
 * The moment as the recording screen asks for it: the stored streak read
 * back after the take (`after` holds today's row only when it was stored),
 * against what the screen knew before the take.
 */
function moment(p: {
  spoke: number[];
  frozen?: number[];
  stored?: boolean;
  before?: { didToday: boolean } | null;
  shownOn?: string | null;
}) {
  const earlier = p.spoke.map((n) => ago(n));
  const repDates = p.stored === false ? earlier : [...earlier, TODAY];
  const frozenDays = (p.frozen ?? []).map((n) => ago(n, 0));
  const streak = computeStreak(repDates, NOW, frozenDays);
  const before =
    p.before !== undefined ? p.before : { didToday: computeStreak(earlier, NOW, frozenDays).didToday };
  return streakMoment({ streak, before, repDates, frozenDays, now: NOW, shownOn: p.shownOn ?? null });
}

describe("when the streak's moment shows", () => {
  it("shows on the first take of the day, rolling yesterday's count to today's: 3 to 4", () => {
    const m = moment({ spoke: [1, 2, 3] });
    expect(m).not.toBeNull();
    expect(m!.from).toBe(3);
    expect(m!.to).toBe(4);
    expect(m!.day).toBe(dayKey(NOW));
  });

  it("does not show on a second take of a day already spoken", () => {
    expect(moment({ spoke: [0, 1, 2, 3] })).toBeNull();
    // Nor when the screen's own read already had today in it.
    expect(moment({ spoke: [1, 2, 3], before: { didToday: true } })).toBeNull();
  });

  it("does not show for a take too short to count: nothing was stored, the streak never moved", () => {
    // Inside 1.5s or unheard (lib/unheard.ts), no row lands: today is not in the read.
    expect(moment({ spoke: [1, 2, 3], stored: false })).toBeNull();
  });

  it("does not show on a day a freeze carried and nobody spoke", () => {
    // Wednesday rescued on Thursday's open, nothing recorded yet: the freeze adds no day.
    const repDates = [ago(2), ago(3)];
    const frozenDays = [ago(1, 0)];
    const streak = computeStreak(repDates, NOW, frozenDays);
    expect(streak.didToday).toBe(false);
    expect(streakMoment({ streak, before: { didToday: false }, repDates, frozenDays, now: NOW, shownOn: null })).toBeNull();
  });

  it("shows a run a freeze carried honestly: 3 to 4, the frozen day drawn and named", () => {
    // Spoke Sunday to Tuesday, Wednesday on a freeze, Thursday's take.
    const m = moment({ spoke: [2, 3, 4], frozen: [1] });
    expect(m).not.toBeNull();
    expect(m!.from).toBe(3);
    expect(m!.to).toBe(4);
    expect(m!.bridged.map(dayKey)).toEqual([dayKey(ago(1))]);
    expect(m!.week.map((d) => d.mark)).toEqual(["spoken", "spoken", "frozen", "spoken", "open", "open", "open"]);
    expect(freezeLine(m!.bridged)).toBe("A freeze covered Wednesday.");
  });

  it("goes 0 to 1 for a new account's first take", () => {
    const m = moment({ spoke: [] });
    expect(m).not.toBeNull();
    expect(m!.from).toBe(0);
    expect(m!.to).toBe(1);
    expect(m!.bridged).toEqual([]);
    expect(streakLine(m!.to)).toBe("1 day running");
  });

  it("goes 0 to 1 after a break, with no word about the run before it", () => {
    const m = moment({ spoke: [3, 4, 5, 6, 7, 8, 9, 10] });
    expect(m!.from).toBe(0);
    expect(m!.to).toBe(1);
    expect(streakLine(m!.to)).toBe("1 day running");
  });

  it("shows once a day on this phone, whatever a stale read says", () => {
    expect(moment({ spoke: [1, 2, 3], shownOn: dayKey(NOW) })).toBeNull();
    // A screen whose first read failed still knows the phone showed it.
    expect(moment({ spoke: [1, 2, 3], before: null, shownOn: dayKey(NOW) })).toBeNull();
    // Yesterday's showing is yesterday's.
    expect(moment({ spoke: [1, 2, 3], shownOn: dayKey(ago(1)) })).not.toBeNull();
  });

  it("shows when the screen never learned the day's start, as the celebration did", () => {
    expect(moment({ spoke: [1, 2, 3], before: null })?.to).toBe(4);
  });

  it("is always one day: yesterday's count is today's less one", () => {
    for (const spoke of [[], [1], [1, 2], [1, 2, 3, 4, 5, 6], [2, 3]]) {
      const m = moment({ spoke });
      expect(m!.to - m!.from).toBe(1);
    }
  });

  it("marks the milestones the chime escalates on", () => {
    expect(moment({ spoke: [1, 2, 3, 4, 5, 6] })!.milestone).toBe(true);
    expect(moment({ spoke: [1, 2, 3] })!.milestone).toBe(false);
  });
});

describe("this week's row", () => {
  it("runs Monday first, today spoken whether or not the read has it yet", () => {
    const week = momentWeek([ago(3), ago(2)], [], NOW);
    expect(week.map((d) => d.label)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    expect(week.map((d) => d.mark)).toEqual(["spoken", "spoken", "open", "spoken", "open", "open", "open"]);
    expect(week.findIndex((d) => d.today)).toBe(3);
  });

  it("draws a spoken day as spoken even where a freeze was also filed", () => {
    expect(momentWeek([ago(1)], [ago(1, 0)], NOW)[2].mark).toBe("spoken");
  });
});

describe("the days a freeze carried to today", () => {
  it("are the frozen days running back from yesterday, oldest first", () => {
    expect(bridgedDays([ago(1, 0), ago(2, 0), ago(5, 0)], NOW).map(dayKey)).toEqual([dayKey(ago(2)), dayKey(ago(1))]);
    expect(bridgedDays([ago(2, 0)], NOW)).toEqual([]);
  });

  it("name themselves in one line", () => {
    expect(freezeLine([])).toBeNull();
    expect(freezeLine([ago(2), ago(1)])).toBe("Freezes covered Tuesday and Wednesday.");
    expect(freezeLine([ago(3), ago(2), ago(1)])).toBe("Freezes covered Monday, Tuesday and Wednesday.");
  });
});

describe("the moment's words", () => {
  it("says the count with its number", () => {
    expect(streakLine(4)).toBe("4 days running");
    expect(streakLine(2)).toBe("2 days running");
    expect(streakLine(1)).toBe("1 day running");
    expect(streakLabel(4)).toBe("days running");
    expect(streakLabel(1)).toBe("day running");
  });

  it("never shames: no loss, no pressure, no dash", () => {
    const lines = [1, 2, 4, 7, 30, 365].map(streakLine).concat([freezeLine([ago(1)])!, freezeLine([ago(2), ago(1)])!]);
    for (const l of lines) {
      expect(l).not.toMatch(/lose|lost|break|broke|miss|don't|keep it|alive|risk|—/i);
      expect(l).toMatch(/\d|[A-Z][a-z]+day/);
    }
  });
});

describe("the odometer", () => {
  it("turns only the places that change: 3 to 4 turns one", () => {
    expect(odometer(3, 4)).toEqual([{ was: "3", now: "4", turns: true }]);
    expect(odometer(13, 14)).toEqual([
      { was: "1", now: "1", turns: false },
      { was: "3", now: "4", turns: true },
    ]);
  });

  it("turns every place that changes and brings a new one in from nothing", () => {
    expect(odometer(9, 10)).toEqual([
      { was: "", now: "1", turns: true },
      { was: "9", now: "0", turns: true },
    ]);
    expect(odometer(99, 100).map((p) => p.turns)).toEqual([true, true, true]);
    expect(odometer(0, 1)).toEqual([{ was: "0", now: "1", turns: true }]);
  });
});

describe("the moment's clock", () => {
  it("rolls the count on the chime's landing note (#226), after the flame lights", () => {
    const t = momentTimeline(false);
    expect(t.rollAt - t.lightAt).toBe(Math.round(CHIME[CHIME.length - 1].at * 1000));
    const m = momentTimeline(true);
    expect(m.rollAt - m.lightAt).toBe(Math.round(MILESTONE_CHIME[MILESTONE_CHIME.length - 1].at * 1000));
  });

  it("brings the line in after the turn and is over inside a second and a half", () => {
    const t = momentTimeline(false);
    expect(t.lineAt).toBeGreaterThan(t.rollAt);
    expect(t.end).toBeGreaterThanOrEqual(t.rollAt + t.rollMs);
    expect(t.end).toBeLessThanOrEqual(1500);
  });
});
