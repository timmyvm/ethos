import { describe, expect, it } from "vitest";
import { FIRST_BODY, hourWords, LATE_TITLE, lastTake, reminderCopy, takeLine } from "./reminder-copy";
import { BANNED_PHRASES, HYPE_PHRASES, saysGym } from "./register";

/* The reminder's words (#430): the hour they chose and a number they spoke. */
describe("reminderCopy", () => {
  it("names the chosen hour on time and quotes the last take", () => {
    expect(reminderCopy({ hour: 18, onTime: true, last: { fillers: 4, seconds: 62 } })).toEqual({
      title: "Your 6 pm practice",
      body: "Last time: 4 fillers in 62 seconds.",
    });
  });

  it("does not name an hour that has passed, and says one filler as one", () => {
    expect(reminderCopy({ hour: 12, onTime: false, last: { fillers: 1, seconds: 75 } })).toEqual({
      title: LATE_TITLE,
      body: "Last time: 1 filler in 75 seconds.",
    });
  });

  it("before a first take, says how long it takes", () => {
    expect(reminderCopy({ hour: 7, onTime: true, last: null })).toEqual({ title: "Your 7 am practice", body: FIRST_BODY });
  });

  it("says the hour the way the testers' phones do", () => {
    expect([0, 7, 12, 18, 21, 23].map(hourWords)).toEqual(["12 am", "7 am", "12 pm", "6 pm", "9 pm", "11 pm"]);
  });

  it("never names a streak, a deadline, guilt, the banned register or hype, and has no dash", () => {
    const lines = [
      ...[null, { fillers: 0, seconds: 30 }, { fillers: 12, seconds: 240 }].flatMap((last) =>
        [7, 12, 18, 21].flatMap((hour) =>
          [true, false].flatMap((onTime) => Object.values(reminderCopy({ hour, onTime, last })))
        )
      ),
      takeLine(null),
    ];
    for (const s of lines) {
      expect(s).not.toMatch(/streak|\bdays?\b|habit|keep|lose|tonight|midnight|before it|fail|lazy|shame|missed|broke/i);
      expect(saysGym(s)).toBe(false);
      for (const p of [...BANNED_PHRASES, ...HYPE_PHRASES]) expect(s.toLowerCase()).not.toContain(p);
      expect(s).not.toMatch(/—|–/);
    }
  });
});

describe("lastTake", () => {
  it("quotes the newest take long enough to be a real one", () => {
    expect(
      lastTake([
        { filler_count: 0, duration_s: 6 },
        { filler_count: 3, duration_s: "64.4" },
        { filler_count: 9, duration_s: 90 },
      ])
    ).toEqual({ fillers: 3, seconds: 64 });
  });

  it("is null with no takes, or only false starts", () => {
    expect(lastTake([])).toBeNull();
    expect(lastTake([{ filler_count: 2, duration_s: 12 }])).toBeNull();
    expect(lastTake([{ filler_count: null, duration_s: 70 }])).toBeNull();
  });
});

describe("the service worker's fallback", () => {
  it("says what the server says with no take to quote", async () => {
    const { readFileSync } = await import("node:fs");
    const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
    expect(sw).toContain(`title: ${JSON.stringify(LATE_TITLE)}`);
    expect(sw).toContain(`body: ${JSON.stringify(FIRST_BODY)}`);
  });
});
