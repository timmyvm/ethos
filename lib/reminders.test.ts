import { describe, expect, it } from "vitest";
import { nextFireTime, reminderBody, reminderTierNote } from "./reminders";
import { DEFAULT_PREFS, insideQuietHours } from "./prefs";

const at = (day: number, hour: number) => new Date(2026, 7, day, hour, 30);

describe("quiet hours", () => {
  it("covers a window that wraps midnight", () => {
    expect(insideQuietHours(23, DEFAULT_PREFS)).toBe(true);
    expect(insideQuietHours(3, DEFAULT_PREFS)).toBe(true);
    expect(insideQuietHours(7, DEFAULT_PREFS)).toBe(false);
    expect(insideQuietHours(12, DEFAULT_PREFS)).toBe(false);
  });

  it("covers a same-day window", () => {
    const prefs = { ...DEFAULT_PREFS, quietFrom: 9, quietTo: 17 };
    expect(insideQuietHours(12, prefs)).toBe(true);
    expect(insideQuietHours(8, prefs)).toBe(false);
  });

  it("treats an empty window as no quiet hours", () => {
    const prefs = { ...DEFAULT_PREFS, quietFrom: 7, quietTo: 7 };
    expect(insideQuietHours(7, prefs)).toBe(false);
  });
});

describe("nextFireTime", () => {
  it("schedules later today when the hour hasn't passed", () => {
    const t = nextFireTime(20, at(9, 12), DEFAULT_PREFS)!;
    expect(t.getDate()).toBe(9);
    expect(t.getHours()).toBe(20);
  });

  it("rolls to tomorrow once the hour has passed", () => {
    const t = nextFireTime(8, at(9, 12), DEFAULT_PREFS)!;
    expect(t.getDate()).toBe(10);
  });

  it("refuses to schedule inside quiet hours", () => {
    expect(nextFireTime(23, at(9, 12), DEFAULT_PREFS)).toBeNull();
  });

  // A reminder for a day whose rep is already done is wrong however it
  // fires — the OS tier can't check at fire time, so the day is chosen
  // here. Repping at 9am with an 8pm hour must arm tomorrow's 8pm.
  it("arms tomorrow's hour when today's rep is already done", () => {
    const t = nextFireTime(20, at(9, 12), DEFAULT_PREFS, true)!;
    expect(t.getDate()).toBe(10);
    expect(t.getHours()).toBe(20);
  });

  it("does not double-skip when the hour has passed AND the rep is done", () => {
    const t = nextFireTime(8, at(9, 12), DEFAULT_PREFS, true)!;
    expect(t.getDate()).toBe(10);
  });
});

describe("reminderBody", () => {
  it("names the streak once there is one to lose", () => {
    expect(reminderBody({ streak: 6, didToday: false })).toContain("6 days");
  });

  it("has no guilt language in any state", () => {
    const guilt = /fail|lazy|disappoint|shame|lost|broke|missed/i;
    for (const streak of [0, 1, 2, 30]) {
      expect(reminderBody({ streak, didToday: false })).not.toMatch(guilt);
    }
  });
});

describe("reminderTierNote", () => {
  it("admits when the browser can only fire with a tab open", () => {
    expect(reminderTierNote("open-tab")).toMatch(/only.*while Ethos is open/i);
  });

  it("admits when it cannot fire at all", () => {
    expect(reminderTierNote("unsupported")).toMatch(/can't show notifications/i);
  });
});
