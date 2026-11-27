import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RepRow } from "./client-data";
import { ALL_FILLERS_PER_MIN, PAUSES_PER_RECORDING, WORDS_A_MINUTE } from "./metric-labels";
import {
  boardLine,
  calendarDay,
  DASH,
  fillersPerMinute,
  PACE_AIM,
  sinceDayOneCard,
  sinceLine,
  sinceName,
  sinceSeries,
  SINCE_LABELS,
  sinceStands,
  SPAN_FLOOR,
  takeRows,
} from "./since-day-one";

/** Enough words to score (`measured`): the rows below are real takes. */
const SAID =
  "The best part of my week was a long walk by the river with my sister after work on Friday, talking about nothing much.";

function rep(over: Partial<RepRow>): RepRow {
  return {
    id: "r",
    lesson_id: "f1",
    created_at: "2026-10-01T09:00:00Z",
    duration_s: 60,
    transcript: SAID,
    wpm: 140,
    filler_count: 4,
    fillers: [],
    pauses: [],
    stars: 1,
    ethos_index: 512,
    dimensions: null,
    mode: "daily",
    mods: [],
    ...over,
  } as RepRow;
}

const pre = (n: number) => Array.from({ length: n }, (_, i) => ({ t: i * 5, len: 1.1, kind: "pre" as const }));

/* The look fixture's story in small: day 1 at 9.3 fillers a minute, 611,
   128 words a minute, one pause between sentences; 26 days on, 2.8, 662,
   155 and two. */
const day1 = rep({ id: "a", created_at: "2026-10-01T09:00:00Z", duration_s: 64.5, filler_count: 10, ethos_index: 611, wpm: 128, pauses: pre(1) });
const mid = rep({ id: "m", created_at: "2026-10-12T09:00:00Z" });
const day26 = rep({ id: "z", created_at: "2026-10-26T09:00:00Z", duration_s: 64.3, filler_count: 3, ethos_index: 662, wpm: 155, pauses: pre(2) });

describe("sinceDayOneCard: the rows Since day one draws", () => {
  it("is null under two measured recordings", () => {
    expect(sinceDayOneCard([])).toBeNull();
    expect(sinceDayOneCard([day1])).toBeNull();
  });

  it("counts the days both ends included, and every recording on the list", () => {
    const card = sinceDayOneCard([day1, mid, day26])!;
    expect(card.days).toBe(26);
    expect(card.recordings).toBe(3);
  });

  it("leads with Ethos where both ends have it, then the three measures in their order", () => {
    const card = sinceDayOneCard([day1, day26])!;
    expect(card.rows.map((r) => r.key)).toEqual(["ethos", "fillers", "wpm", "pause"]);
    expect(card.rows.map((r) => r.label)).toEqual(["Ethos", ALL_FILLERS_PER_MIN, WORDS_A_MINUTE, PAUSES_PER_RECORDING]);
    const [ethos, fillers, wpm, pause] = card.rows;
    expect([ethos.a, ethos.b, ethos.went, ethos.better]).toEqual(["611", "662", "up", true]);
    expect([fillers.a, fillers.b, fillers.went, fillers.better]).toEqual(["9.3", "2.8", "down", true]);
    expect([wpm.a, wpm.b, wpm.went, wpm.better]).toEqual(["128", "155", "up", true]);
    expect([pause.a, pause.b, pause.went, pause.better]).toEqual(["1", "2", "up", true]);
  });

  it("puts the introduction's focus first (#232), whichever it is", () => {
    expect(sinceDayOneCard([day1, day26], "fillers")!.rows[0].key).toBe("fillers");
    expect(sinceDayOneCard([day1, day26], "wpm")!.rows[0].key).toBe("wpm");
    expect(sinceDayOneCard([day1, day26], "pause")!.rows[0].key).toBe("pause");
    // A focus the card does not draw leaves the order alone.
    expect(sinceDayOneCard([day1, day26], "variety")!.rows[0].key).toBe("ethos");
    expect(sinceDayOneCard([day1, day26], null)!.rows[0].key).toBe("ethos");
    // The lead moves; nothing is lost or doubled.
    expect(sinceDayOneCard([day1, day26], "pause")!.rows.map((r) => r.key).sort()).toEqual(["ethos", "fillers", "pause", "wpm"]);
  });

  it("drops the Ethos row when either end has no Ethos number, and the filler rate leads", () => {
    const card = sinceDayOneCard([{ ...day1, ethos_index: null }, day26])!;
    expect(card.rows.map((r) => r.key)).toEqual(["fillers", "wpm", "pause"]);
  });

  it("says worse in rust's terms: more fillers, pace further from the aim, fewer pauses between sentences", () => {
    const worse = { ...day26, filler_count: 12, duration_s: 65, wpm: 104, pauses: [{ t: 8, len: 1.2, kind: "mid" as const }] };
    const [, fillers, wpm, pause] = sinceDayOneCard([day1, worse])!.rows;
    expect([fillers.a, fillers.b, fillers.went, fillers.better]).toEqual(["9.3", "11.1", "up", false]);
    expect([wpm.went, wpm.better]).toEqual(["down", false]);
    expect([pause.a, pause.b, pause.went, pause.better]).toEqual(["1", "0", "down", false]);
  });

  it("reads pace by its distance from the aim, either side of it", () => {
    const fast = { ...day26, wpm: PACE_AIM + 30 };
    const slow = { ...day1, wpm: PACE_AIM - 30 };
    // 115 to 175 is up, and no nearer: held at the same distance, so plain.
    expect(sinceDayOneCard([slow, fast])!.rows.find((r) => r.key === "wpm")!.better).toBeNull();
    expect(sinceDayOneCard([slow, { ...fast, wpm: 150 }])!.rows.find((r) => r.key === "wpm")!.better).toBe(true);
    expect(sinceDayOneCard([{ ...slow, wpm: 150 }, fast])!.rows.find((r) => r.key === "wpm")!.better).toBe(false);
  });

  it("compares the numbers as drawn, so a row that reads the same wears no colour", () => {
    // 9.34 and 9.26 a minute both read 9.3.
    const a = { ...day1, filler_count: 9.34, duration_s: 60 };
    const b = { ...day26, filler_count: 9.26, duration_s: 60 };
    const fillers = sinceDayOneCard([a, b])!.rows.find((r) => r.key === "fillers")!;
    expect([fillers.a, fillers.b, fillers.went, fillers.better]).toEqual(["9.3", "9.3", "held", null]);
  });

  it("draws an unknown as a dash, never zero, and gives it no colour", () => {
    const noLength = { ...day26, duration_s: 0 };
    const noPace = { ...day1, wpm: 0 };
    const noPauses = { ...day26, pauses: null as unknown as RepRow["pauses"] };
    expect(fillersPerMinute(noLength)).toBeNull();
    const card = sinceDayOneCard([noPace, { ...noLength, pauses: noPauses.pauses }])!;
    const by = (k: string) => card.rows.find((r) => r.key === k)!;
    expect([by("fillers").b, by("fillers").went, by("fillers").better]).toEqual([DASH, null, null]);
    expect([by("wpm").a, by("wpm").went, by("wpm").better]).toEqual([DASH, null, null]);
    expect([by("pause").b, by("pause").better]).toEqual([DASH, null]);
    for (const r of card.rows) expect(`${r.a} ${r.b}`).not.toMatch(/NaN|Infinity/);
  });

  it("borrows the measures' one names (#495)", () => {
    expect(SINCE_LABELS).toEqual(["Ethos", ALL_FILLERS_PER_MIN, WORDS_A_MINUTE, PAUSES_PER_RECORDING]);
  });
});

describe("sinceStands: Since day one's two ends on two days (#526's review)", () => {
  /* Two takes too short to score on days 1 and 2, then two measured on
     day 3: three days spoken, two measured ends, both on one day. The
     claim would print "Day 1" under both numbers, so the moment waits. */
  const short = (at: string) => rep({ id: at, created_at: at, transcript: "um hi", scorable: false } as Partial<RepRow>);
  const measuredOn = (at: string, ethos: number) => rep({ id: at, created_at: at, ethos_index: ethos });

  it("waits while both measured ends stand on one calendar day", () => {
    const rows = [
      short("2026-10-01T09:00:00Z"),
      short("2026-10-02T09:00:00Z"),
      measuredOn("2026-10-03T09:00:00Z", 600),
      measuredOn("2026-10-03T10:00:00Z", 640),
    ];
    const card = sinceDayOneCard(rows);
    expect(card?.days).toBe(1);
    expect(sinceStands(card)).toBe(false);
  });

  it("stands once the ends are on two days, and never on no card", () => {
    expect(sinceStands(sinceDayOneCard([measuredOn("2026-10-01T09:00:00Z", 600), measuredOn("2026-10-02T09:00:00Z", 640)]))).toBe(true);
    expect(sinceStands(sinceDayOneCard([day1, mid, day26]))).toBe(true);
    expect(sinceStands(null)).toBe(false);
    expect(sinceStands(sinceDayOneCard([short("2026-10-01T09:00:00Z"), short("2026-10-03T09:00:00Z")]))).toBe(false);
  });
});

describe("sinceName: every number in the row's name, and the way it went in words", () => {
  const card = sinceDayOneCard([day1, day26])!;
  it("names both numbers, both days, up or down, and better or worse in words (DESIGN 10)", () => {
    expect(sinceName(card.rows[1], card.days)).toBe("All fillers a minute: 9.3 on day 1, down to 2.8 on day 26, better");
    expect(sinceName(card.rows[0], card.days)).toBe("Ethos: 611 on day 1, up to 662 on day 26, better");
    // Words a minute is better nearer 145, which no direction says: the word does.
    expect(sinceName(card.rows[2], card.days)).toBe("Words a minute: 128 on day 1, up to 155 on day 26, better");
    const worse = { ...card.rows[1], b: "11.1", went: "up" as const, better: false };
    expect(sinceName(worse, 26)).toBe("All fillers a minute: 9.3 on day 1, up to 11.1 on day 26, worse");
    // Up and no nearer the aim: neither better nor worse, so no word.
    const level = { ...card.rows[2], a: "115", b: "175", went: "up" as const, better: null };
    expect(sinceName(level, 26)).toBe("Words a minute: 115 on day 1, up to 175 on day 26");
  });
  it("says a held number once, and an unknown as no number", () => {
    const held = { ...card.rows[0], b: "611", went: "held" as const, better: null };
    expect(sinceName(held, 26)).toBe("Ethos: 611 on day 1, the same on day 26");
    const unknown = { ...card.rows[1], b: DASH, to: null, went: null, better: null };
    expect(sinceName(unknown, 26)).toBe("All fillers a minute: 9.3 on day 1, no number on day 26");
  });
});

describe("boardLine: the save wall's title", () => {
  it("is a title, with no full stop (#454)", () => {
    expect(boardLine("rep1", 1)).toBe("Day 1 is on the board");
    expect(boardLine("streak", 3)).toBe("3 days on the board");
    expect(boardLine("streak", 12)).toBe("12 days on the board");
    for (const l of [boardLine("rep1", 1), boardLine("streak", 3)]) expect(l.endsWith(".")).toBe(false);
  });
  it("never says 1 days", () => {
    expect(boardLine("streak", 1)).toBe("Day 1 is on the board");
    expect(boardLine("streak", 0)).toBe("Day 1 is on the board");
  });
});

describe("takeRows: the save wall's ledger, one recording's numbers", () => {
  const m = { durationS: 64.3, wpm: 155, fillerCount: 3, pauses: [...pre(2), { t: 30, len: 1, kind: "mid" }] };
  it("draws the three measures in the card's order, each named with its number", () => {
    const rows = takeRows(m);
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      [ALL_FILLERS_PER_MIN, "2.8"],
      [WORDS_A_MINUTE, "155"],
      [PAUSES_PER_RECORDING, "2"],
    ]);
    expect(rows[0].name).toBe("All fillers a minute: 2.8");
  });
  it("puts the introduction's focus first", () => {
    expect(takeRows(m, "wpm").map((r) => r.key)).toEqual(["wpm", "fillers", "pause"]);
    expect(takeRows(m, "pause").map((r) => r.key)).toEqual(["pause", "fillers", "wpm"]);
    expect(takeRows(m, "variety").map((r) => r.key)).toEqual(["fillers", "wpm", "pause"]);
  });
  it("draws an unknown as a dash and says it as no number, never zero", () => {
    const rows = takeRows({ durationS: 0, wpm: 0, fillerCount: 2, pauses: null });
    expect(rows.map((r) => r.value)).toEqual([DASH, DASH, DASH]);
    expect(rows[2].name).toBe("Pauses between sentences in a recording: no number");
  });
});

describe("the days are calendar days on this phone (the panel's must-fix 2)", () => {
  const was = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Australia/Melbourne";
  });
  afterAll(() => {
    if (was === undefined) delete process.env.TZ;
    else process.env.TZ = was;
  });
  const at = (m: number, d: number, h: number, min = 0) => new Date(2026, m - 1, d, h, min).toISOString();

  it("counts last night and this morning as day 1 and day 2", () => {
    const card = sinceDayOneCard([{ ...day1, created_at: at(11, 1, 23, 30) }, { ...day26, created_at: at(11, 2, 7) }])!;
    expect(card.days).toBe(2);
  });

  it("counts 23:00 and 01:00 two days on as day 3, not day 2", () => {
    const card = sinceDayOneCard([{ ...day1, created_at: at(11, 1, 23) }, { ...day26, created_at: at(11, 3, 1) }])!;
    expect(card.days).toBe(3);
  });

  it("holds across a clock change: Melbourne's 23-hour Sunday 4 October", () => {
    // 00:30 Saturday to 23:59 Monday is 70.5 hours, which rounds to four days.
    const card = sinceDayOneCard([{ ...day1, created_at: at(10, 3, 0, 30) }, { ...day26, created_at: at(10, 5, 23, 59) }])!;
    expect(card.days).toBe(3);
    expect(calendarDay(at(10, 3, 0, 30), at(10, 5, 23, 59))).toBe(3);
  });

  it("is day 1 for two recordings on one day", () => {
    expect(calendarDay(at(11, 1, 0, 5), at(11, 1, 23, 55))).toBe(1);
  });
});

describe("takeRows on a take too short to score (the panel's must-fix)", () => {
  it("draws every number as a dash, never the engine's zeros", () => {
    // A few words in 8 s: the engine's 0 fillers is 0.0 a minute, and its pace is a few words' rate.
    const short = { durationS: 8, wpm: 60, fillerCount: 0, pauses: [] };
    expect(takeRows(short).map((r) => r.value)).toEqual(["0.0", "60", "0"]);
    const rows = takeRows(short, null, { scorable: false });
    expect(rows.map((r) => r.value)).toEqual([DASH, DASH, DASH]);
    expect(rows.map((r) => r.name)).toEqual([
      "All fillers a minute: no number",
      "Words a minute: no number",
      "Pauses between sentences in a recording: no number",
    ]);
  });
});

describe("sinceSeries: the lead measure across every measured recording", () => {
  const story = [
    day1,
    rep({ id: "b", created_at: "2026-10-05T09:00:00Z", duration_s: 60, filler_count: 7 }),
    rep({ id: "c", created_at: "2026-10-09T09:00:00Z", duration_s: 0, filler_count: 3 }),
    rep({ id: "d", created_at: "2026-10-12T09:00:00Z", transcript: "Too short.", duration_s: 4, filler_count: 0 }),
    rep({ id: "e", created_at: "2026-10-20T09:00:00Z", duration_s: 60, filler_count: 4, pauses: null as unknown as RepRow["pauses"], wpm: 0 }),
    day26,
  ];
  it("is oldest first, one value a measured recording, and leaves out what a recording cannot read", () => {
    const f = sinceSeries(story, "fillers").map((v) => v.toFixed(1));
    // c has no length, d is too short to be measured: both left out, never 0.
    expect(f).toEqual(["9.3", "7.0", "4.0", "2.8"]);
    // e has no pace (0) and no pause list: left out of those two lines.
    expect(sinceSeries(story, "wpm")).toEqual([128, 140, 140, 155]);
    expect(sinceSeries(story, "pause")).toEqual([1, 0, 0, 2]);
    expect(sinceSeries(story, "ethos")).toEqual([611, 512, 512, 512, 662]);
    expect(sinceSeries(story, "ethos").length).toBe(story.filter((r) => r.id !== "d").length);
  });
});

describe("sinceLine: the line drawn in the claim's empty stage (graft 1)", () => {
  it("is null under two values: one number is a point, not a line", () => {
    expect(sinceLine([], 4)).toBeNull();
    expect(sinceLine([3], 4)).toBeNull();
  });

  it("puts a dot on every value, in the unit square, left to right in order", () => {
    const l = sinceLine([9.3, 6, 4, 2.8], SPAN_FLOOR.fillers)!;
    expect(l.dots.map(([x]) => x)).toEqual([0, 1 / 3, 2 / 3, 1]);
    for (const [, y] of l.dots) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
    // Higher values stand higher: a smaller y.
    expect(l.dots[0][1]).toBeLessThan(l.dots[3][1]);
  });

  it("starts and ends on the claim's own two values, and the vertex next to each end is its own recording's", () => {
    // The worse story: falling to about 2, then one take at 11.1.
    const v = [9.3, 8, 7.2, 6, 5.1, 4.4, 3.9, 3, 2.6, 2.1, 11.1];
    const l = sinceLine(v, SPAN_FLOOR.fillers)!;
    const n = v.length;
    for (const i of [0, 1, n - 2, n - 1]) expect(l.line[i][1]).toBeCloseTo(l.dots[i][1], 9);
    // The spike is not smoothed into the take before it.
    expect(l.line[n - 2][1]).toBeGreaterThan(l.line[n - 1][1]);
  });

  it("smooths the middle with the house's centred mean", () => {
    const v = [5, 9, 1, 9, 1, 9, 5];
    const l = sinceLine(v, 1)!;
    // The middle vertex is the mean of five, nearer the middle than its own dot.
    expect(Math.abs(l.line[3][1] - 0.5)).toBeLessThan(Math.abs(l.dots[3][1] - 0.5));
  });

  it("draws a small change small, on the measure's floor", () => {
    const l = sinceLine([5.0, 5.2], SPAN_FLOOR.fillers)!;
    const rise = l.dots[0][1] - l.dots[1][1];
    expect(rise).toBeCloseTo(0.2 / 4, 9);
    expect(SPAN_FLOOR).toEqual({ ethos: 100, fillers: 4, wpm: 40, pause: 4 });
  });
});
