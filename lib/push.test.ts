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

  it("skips the hours before the chosen one and after its window", () => {
    // 07:00 UTC is 17:00 in Melbourne, before the chosen 18.
    expect(shouldSend(window(), false, new Date(Date.UTC(2026, 7, 1, 7, 0)))).toBe(false);
    // 11:00 UTC is 21:00, past the three-hour catch-up window.
    expect(shouldSend(window(), false, new Date(Date.UTC(2026, 7, 1, 11, 0)))).toBe(false);
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

/*
 * GitHub's hourly schedule runs late at the top of the hour, or drops a
 * run, and the cron reads the clock when it runs. With an exact-hour
 * match, an 18:00 tick that ran at 19:03 skipped everyone choosing 18,
 * and no later tick that day matched either.
 */
describe("shouldSend and a late or dropped tick", () => {
  it("still sends from a tick that runs an hour late", () => {
    expect(shouldSend(window(), false, new Date(Date.UTC(2026, 7, 1, 9, 3)))).toBe(true);
  });

  it("does not send twice when the late tick follows a sent one", () => {
    expect(
      shouldSend(window({ lastSentOn: "2026-08-01" }), false, new Date(Date.UTC(2026, 7, 1, 9, 3)))
    ).toBe(false);
  });

  it("never catches up into quiet hours", () => {
    // Chosen 21, quiet from 22: a catch-up at 22:05 local stays silent.
    expect(
      shouldSend(window({ reminderHour: 21 }), false, new Date(Date.UTC(2026, 7, 1, 12, 5)))
    ).toBe(false);
  });

  it("never rings the next morning for last night's hour", () => {
    // Chosen 23, quiet hours off: 00:30 the next local day is not a catch-up.
    expect(
      shouldSend(window({ reminderHour: 23, quietFrom: 7, quietTo: 7 }), false, new Date(Date.UTC(2026, 7, 1, 14, 30)))
    ).toBe(false);
  });
});
