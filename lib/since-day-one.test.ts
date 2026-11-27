import { describe, expect, it } from "vitest";
import type { RepRow } from "./client-data";
import { ALL_FILLERS_PER_MIN, PAUSES_PER_RECORDING, WORDS_A_MINUTE } from "./metric-labels";
import { boardLine, DASH, fillersPerMinute, PACE_AIM, sinceDayOneCard, sinceName, SINCE_LABELS, takeRows } from "./since-day-one";

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

describe("sinceName: every number in the row's name, and the way it went in words", () => {
  const card = sinceDayOneCard([day1, day26])!;
  it("names both numbers, both days and up or down", () => {
    expect(sinceName(card.rows[1], card.days)).toBe("All fillers a minute: 9.3 on day 1, down to 2.8 on day 26");
    expect(sinceName(card.rows[0], card.days)).toBe("Ethos: 611 on day 1, up to 662 on day 26");
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
