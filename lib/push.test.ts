import { describe, expect, it } from "vitest";
import {
  inQuietRange,
  localDayKey,
  localDayStartUtc,
  localStreak,
  shouldSend,
  type PushWindow,
} from "./push";

// A subscriber in Melbourne (UTC+10): getTimezoneOffset() = -600.
const MEL = -600;

function window(over: Partial<PushWindow> = {}): PushWindow {
  return {
    reminderHour: 18,
    tzOffset: MEL,
    quietFrom: 22,
    quietTo: 7,
    lastSentOn: null,
    ...over,
  };
}

describe("local clock arithmetic", () => {
  it("keys the local calendar date, not UTC's", () => {
    // 15:30 UTC on the 1st is 01:30 on the 2nd in Melbourne.
    const now = new Date(Date.UTC(2026, 7, 1, 15, 30));
    expect(localDayKey(now, MEL)).toBe("2026-08-02");
    expect(localDayKey(now, 0)).toBe("2026-08-01");
  });

  it("returns the local day start as a real UTC instant", () => {
    const now = new Date(Date.UTC(2026, 7, 1, 15, 30));
    // Melbourne's Aug 2 begins at Aug 1, 14:00 UTC.
    expect(localDayStartUtc(now, MEL).toISOString()).toBe(
      "2026-08-01T14:00:00.000Z"
    );
  });
});

describe("quiet hours on a bare range", () => {
  it("wraps midnight", () => {
    expect(inQuietRange(23, 22, 7)).toBe(true);
    expect(inQuietRange(3, 22, 7)).toBe(true);
    expect(inQuietRange(8, 22, 7)).toBe(false);
  });
  it("an empty range is no quiet hours", () => {
    expect(inQuietRange(3, 7, 7)).toBe(false);
  });
});

describe("shouldSend", () => {
  // 08:00 UTC = 18:00 Melbourne.
  const atHour = new Date(Date.UTC(2026, 7, 1, 8, 0));

  it("sends at the chosen local hour when nothing blocks it", () => {
    expect(shouldSend(window(), false, atHour)).toBe(true);
  });

  it("never fires about a day whose practice is done (#143)", () => {
    expect(shouldSend(window(), true, atHour)).toBe(false);
  });

  it("skips every other hour", () => {
    const wrongHour = new Date(Date.UTC(2026, 7, 1, 9, 0));
    expect(shouldSend(window(), false, wrongHour)).toBe(false);
  });

  it("a quiet-hours choice never sends", () => {
    // 13:00 UTC = 23:00 Melbourne, inside 22–7.
    const late = new Date(Date.UTC(2026, 7, 1, 13, 0));
    expect(shouldSend(window({ reminderHour: 23 }), false, late)).toBe(false);
  });

  it("sends once per local day, whatever the scheduler does", () => {
    const sent = window({ lastSentOn: "2026-08-01" });
    expect(shouldSend(sent, false, atHour)).toBe(false);
    const yesterday = window({ lastSentOn: "2026-07-31" });
    expect(shouldSend(yesterday, false, atHour)).toBe(true);
  });
});

describe("localStreak", () => {
  const now = new Date(Date.UTC(2026, 7, 1, 8, 0)); // Aug 1, 18:00 Mel

  it("counts consecutive local days back from today", () => {
    const reps = [
      new Date(Date.UTC(2026, 6, 30, 8, 0)), // Jul 30 Mel
      new Date(Date.UTC(2026, 6, 31, 8, 0)), // Jul 31 Mel
      new Date(Date.UTC(2026, 7, 1, 2, 0)), // Aug 1 Mel
    ];
    expect(localStreak(reps, MEL, now)).toBe(3);
  });

  it("an unpracticed today doesn't break yesterday's run", () => {
    const reps = [
      new Date(Date.UTC(2026, 6, 30, 8, 0)),
      new Date(Date.UTC(2026, 6, 31, 8, 0)),
    ];
    expect(localStreak(reps, MEL, now)).toBe(2);
  });

  it("a gap ends the count", () => {
    const reps = [
      new Date(Date.UTC(2026, 6, 28, 8, 0)),
      new Date(Date.UTC(2026, 6, 31, 8, 0)),
    ];
    expect(localStreak(reps, MEL, now)).toBe(1);
  });

  it("no reps is zero", () => {
    expect(localStreak([], MEL, now)).toBe(0);
  });
});
