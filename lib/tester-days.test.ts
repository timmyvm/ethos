import { describe, expect, it } from "vitest";
import { CONSENT_VERSION, TEST, TEST_COPY } from "@/content/tester";
import {
  addDays,
  keyDiff,
  testAsk,
  testDay,
  testKeys,
  testPhase,
  testRoad,
  zoneDayKey,
  type TodayAnswer,
} from "./tester-days";

const ROW = { consent_version: CONSENT_VERSION, consented_at: "2026-10-30T03:00:00.000Z", created_at: "2026-10-30T03:00:00.000Z" };
const PAUSED = { ...ROW, consent_version: CONSENT_VERSION - 1 };
const NONE: TodayAnswer = { state: "none" };

describe("the test's window", () => {
  it("is Friday 30 October to Thursday 12 November 2026 on Melbourne's calendar, fourteen days", () => {
    expect(TEST.first).toBe("2026-10-30");
    expect(TEST.last).toBe("2026-11-12");
    expect(TEST.zone).toBe("Australia/Melbourne");
    expect(keyDiff(TEST.first, TEST.last) + 1).toBe(TEST.days);
    expect(TEST.days).toBe(14);
    expect(testKeys()).toHaveLength(14);
    expect(testKeys()[13]).toBe(TEST.last);
  });
});

describe("the test's days", () => {
  it("counts day 1 on the 30th and day 14 on the 12th", () => {
    expect(testDay("2026-10-30")).toBe(1);
    expect(testDay("2026-10-31")).toBe(2);
    expect(testDay("2026-11-12")).toBe(14);
    expect(testDay("2026-10-29")).toBe(0);
  });

  it("names the phase: before, the fourteen days, the week after, then gone", () => {
    expect([0, 1, 14, 15, 21, 22].map(testPhase)).toEqual(["before", "on", "on", "after", "after", "gone"]);
    expect(testPhase(testDay("2026-10-20"))).toBe("before");
    expect(testPhase(testDay("2026-11-13"))).toBe("after");
    expect(testPhase(testDay("2026-11-19"))).toBe("after");
    expect(testPhase(testDay("2026-11-20"))).toBe("gone");
  });

  it("does day arithmetic by date parts, across Melbourne's daylight saving start and a month's end", () => {
    expect(keyDiff("2026-10-03", "2026-10-05")).toBe(2);
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-12", -13)).toBe("2026-10-30");
  });

  it("turns at midnight in Melbourne, whatever zone the phone or the server is in", () => {
    // 23:59 on Thursday 29 October in Melbourne (AEDT, UTC+11): before the test.
    expect(zoneDayKey("2026-10-29T12:59:00Z")).toBe("2026-10-29");
    expect(testPhase(testDay(zoneDayKey("2026-10-29T12:59:00Z")))).toBe("before");
    // 00:00 on Friday 30 October in Melbourne: day 1, while it is still the 29th in UTC.
    expect(zoneDayKey("2026-10-29T13:00:00Z")).toBe("2026-10-30");
    expect(testDay(zoneDayKey("2026-10-29T13:00:00Z"))).toBe(1);
    // 23:59 on Thursday 12 November is the last day; a minute later the test is over.
    expect(testDay(zoneDayKey("2026-11-12T12:59:00Z"))).toBe(14);
    expect(testPhase(testDay(zoneDayKey("2026-11-12T13:00:00Z")))).toBe("after");
    // Another zone's calendar is its own: the same instant is still the 12th in London.
    expect(zoneDayKey("2026-11-12T13:00:00Z", "Europe/London")).toBe("2026-11-12");
  });
});

describe("the road", () => {
  const at = (key: string, hhmm = "18:12") => {
    // A Melbourne wall time in AEDT (UTC+11), as an instant.
    const [h, m] = hhmm.split(":").map(Number);
    const [y, mo, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h - 11, m)).toISOString();
  };

  it("draws spoken, today open, missed and ahead for a tester who joined on day 1", () => {
    const r = testRoad({ today: "2026-11-02", joined: ROW.created_at, spoken: [at("2026-10-30"), at("2026-11-01")] });
    expect(r.slots.slice(0, 6).map((s) => s.state)).toEqual(["spoken", "missed", "spoken", "open", "ahead", "ahead"]);
    expect(r.slots.filter((s) => s.today).map((s) => s.key)).toEqual(["2026-11-02"]);
    expect(r.spoken).toBe(2);
    expect(r.spokenToday).toBe(false);
  });

  it("rings today and fills it once today is spoken", () => {
    const r = testRoad({ today: "2026-10-31", joined: ROW.created_at, spoken: [at("2026-10-31", "09:12")] });
    expect(r.slots[1]).toEqual({ key: "2026-10-31", state: "spoken", today: true });
    expect(r.spokenToday).toBe(true);
  });

  it("counts a recording at 23:50 in Melbourne on its own day, and one ten minutes later on the next", () => {
    const r = testRoad({ today: "2026-11-02", joined: ROW.created_at, spoken: [at("2026-10-31", "23:50"), at("2026-11-01", "00:00")] });
    expect(r.slots[1].state).toBe("spoken");
    expect(r.slots[2].state).toBe("spoken");
    expect(r.spoken).toBe(2);
  });

  it("counts from the moment a late joiner joined: days before are not theirs, nor is a recording earlier that day", () => {
    const joined = at("2026-11-03", "14:00");
    const r = testRoad({
      today: "2026-11-04",
      joined,
      spoken: [at("2026-10-31"), at("2026-11-03", "09:00"), at("2026-11-04", "08:00")],
    });
    expect(r.slots.slice(0, 5).map((s) => s.state)).toEqual(["before", "before", "before", "before", "missed"]);
    expect(r.slots[5].state).toBe("spoken");
    expect(r.spoken).toBe(1);
    const after = testRoad({ today: "2026-11-04", joined, spoken: [at("2026-11-03", "15:00")] });
    expect(after.slots[4].state).toBe("spoken");
  });

  it("counts every recording in the window when the join time is unknown", () => {
    const r = testRoad({ today: "2026-10-31", joined: null, spoken: [at("2026-10-29"), at("2026-10-30")] });
    expect(r.spoken).toBe(1);
    expect(r.slots[0].state).toBe("spoken");
  });

  it("says nothing it cannot back when the history read failed", () => {
    const r = testRoad({ today: "2026-10-31", joined: ROW.created_at, spoken: null });
    expect(r.slots.every((s) => s.state === "unknown")).toBe(true);
    expect(r.spoken).toBeNull();
    expect(r.spokenToday).toBeNull();
    expect(r.slots[1].today).toBe(true);
  });

  it("before the start, every day is ahead and nothing is today", () => {
    const r = testRoad({ today: "2026-10-28", joined: null, spoken: [] });
    expect(r.slots.every((s) => s.state === "ahead" && !s.today)).toBe(true);
    expect(r.spokenToday).toBe(false);
  });

  it("after the end, no day is today and the count is final", () => {
    const r = testRoad({ today: "2026-11-14", joined: ROW.created_at, spoken: [at("2026-11-12"), at("2026-11-13")] });
    expect(r.slots.some((s) => s.today)).toBe(false);
    expect(r.slots[13].state).toBe("spoken");
    expect(r.slots.slice(0, 13).every((s) => s.state === "missed")).toBe(true);
    expect(r.spoken).toBe(1);
    expect(r.spokenToday).toBe(false);
  });
});

describe("the tile's ask", () => {
  const on = { phase: "on" as const, day: 2, tester: ROW, number: "0B5E 7A21", sent: true, spokenToday: false, answer: NONE };

  it("waits for the row", () => {
    expect(testAsk({ ...on, tester: "loading" })).toEqual({ kind: "wait" });
  });
  it("asks a paused tester to agree again before anything else, an unsent number included", () => {
    expect(testAsk({ ...on, tester: PAUSED, sent: false })).toEqual({ kind: "paused" });
  });
  it("asks for the number until it is sent", () => {
    expect(testAsk({ ...on, sent: false })).toEqual({ kind: "send" });
    expect(testAsk({ ...on, sent: false, tester: "failed" })).toEqual({ kind: "send" });
  });
  it("asks nothing when the history read failed", () => {
    expect(testAsk({ ...on, spokenToday: null })).toEqual({ kind: "none" });
  });
  it("asks to speak today", () => {
    expect(testAsk(on)).toEqual({ kind: "record" });
  });
  it("waits for today's answer, then asks for it", () => {
    expect(testAsk({ ...on, spokenToday: true, answer: { state: "loading" } })).toEqual({ kind: "wait" });
    expect(testAsk({ ...on, spokenToday: true, answer: { state: "open", repId: "r1", index: 665 } })).toEqual({
      kind: "answer",
      repId: "r1",
      index: 665,
    });
  });
  it("says the day is done once answered, with nothing to ask, or when the answer read failed", () => {
    for (const answer of [{ state: "answered" }, { state: "none" }, { state: "failed" }] as TodayAnswer[]) {
      expect(testAsk({ ...on, spokenToday: true, answer })).toEqual({ kind: "done", day: 2 });
    }
  });
  it("says so on the last day", () => {
    expect(testAsk({ ...on, day: 14, spokenToday: true, answer: { state: "answered" } })).toEqual({ kind: "last" });
  });
  it("after the test: the number while it is unsent, then the test is over", () => {
    expect(testAsk({ ...on, phase: "after", day: 16, sent: false })).toEqual({ kind: "send" });
    expect(testAsk({ ...on, phase: "after", day: 16 })).toEqual({ kind: "over" });
    expect(testAsk({ ...on, phase: "after", day: 16, tester: "loading" })).toEqual({ kind: "over" });
  });
  it("asks nothing of a number the phone never had", () => {
    expect(testAsk({ ...on, number: null, sent: false })).toEqual({ kind: "record" });
  });
});

describe("presence copy", () => {
  const strings = [
    TEST_COPY.chip,
    TEST_COPY.eyebrow(1),
    TEST_COPY.eyebrow(2),
    TEST_COPY.eyebrow(14),
    TEST_COPY.unit,
    TEST_COPY.send,
    TEST_COPY.sent,
    TEST_COPY.copy,
    TEST_COPY.copied,
    TEST_COPY.sendLabel,
    TEST_COPY.copyLabel,
    TEST_COPY.share("3F9A 1C2E"),
    TEST_COPY.ask.send,
    TEST_COPY.ask.record,
    TEST_COPY.ask.answer,
    TEST_COPY.ask.done(1),
    TEST_COPY.ask.done(2),
    TEST_COPY.ask.last,
    TEST_COPY.ask.over,
    TEST_COPY.settingsDay(1),
    TEST_COPY.settingsDay(14),
    TEST_COPY.settingsEnded,
  ];

  it("reads right at one, two and fourteen", () => {
    expect(TEST_COPY.eyebrow(1)).toBe("Test day 1 of 14");
    expect(TEST_COPY.eyebrow(2)).toBe("Test day 2 of 14");
    expect(TEST_COPY.eyebrow(14)).toBe("Test day 14 of 14");
    // The unit follows the count and is about the fourteen, so one day spoken reads "1 of 14 days spoken".
    expect(`1 ${TEST_COPY.unit}`).toBe("1 of 14 days spoken");
    expect(`0 ${TEST_COPY.unit}`).toBe("0 of 14 days spoken");
    expect(TEST_COPY.ask.done(1)).toBe("Day 1 is done.");
    expect(TEST_COPY.ask.last).toBe("Day 14 is done, the last day of the test.");
    expect(TEST_COPY.settingsDay(2)).toBe("Day 2 of 14");
    expect(TEST_COPY.share("3F9A 1C2E")).toBe("My Ethos tester number is 3F9A 1C2E.");
  });

  it("has no em dash", () => {
    expect(strings.filter((s) => s.includes("—"))).toEqual([]);
  });

  it("keeps the words that are not Ethos out", () => {
    const banned = /\b(gym|workout|drill|reps?|training)\b/i;
    expect(strings.filter((s) => banned.test(s))).toEqual([]);
  });

  it("names the control by the word it shows", () => {
    expect(TEST_COPY.sendLabel.startsWith(TEST_COPY.send)).toBe(true);
    expect(TEST_COPY.copyLabel.startsWith(TEST_COPY.copy)).toBe(true);
  });

  it("asks in one sentence each", () => {
    for (const s of [TEST_COPY.ask.send, TEST_COPY.ask.record, TEST_COPY.ask.done(2), TEST_COPY.ask.last, TEST_COPY.ask.over]) {
      expect(s.match(/[.!?](\s|$)/g)).toHaveLength(1);
    }
  });
});
