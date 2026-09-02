import { describe, expect, it } from "vitest";
import type { RepRow } from "./client-data";
import { movedRows, presenceRow, recordingName, skillRows } from "./log";

/*
 * The summary screen's one row grammar (#217): every metric prints
 * where it started, where it is, and the signed change, so nobody
 * subtracts. Pace prints its zone instead of a verdict.
 */
function rep(over: Partial<RepRow>): RepRow {
  return {
    id: "r",
    lesson_id: "f1",
    created_at: "2026-08-19T09:00:00Z",
    duration_s: 60,
    transcript: "",
    wpm: 140,
    filler_count: 4,
    fillers: [],
    pauses: [],
    stars: 1,
    focus: null,
    strength: null,
    supply: null,
    ethos_index: 512,
    audio_path: null,
    dimensions: null,
    mode: "daily",
    mods: [],
    xp_multiplier: 1,
    boss_topic_id: null,
    accuracy: null,
    capture_mode: "voice",
    delivery_metrics: null,
    presence_score: null,
    delivery_moments: null,
    ...over,
  } as RepRow;
}

const held = (n: number) =>
  Array.from({ length: n }, () => ({ kind: "mid", t: 1, len: 1 })) as RepRow["pauses"];

describe("movedRows", () => {
  it("prints day one, now, and the signed change", () => {
    const rows = movedRows([
      rep({ ethos_index: 512, filler_count: 6, wpm: 171, pauses: held(1) }),
      rep({ ethos_index: 643, filler_count: 3, wpm: 138, pauses: held(4) }),
    ]);
    const [index, fillers, pace, pauses] = rows;
    expect(index).toMatchObject({ then: "512", now: "643", change: "▲ +131", direction: "up" });
    expect(fillers).toMatchObject({ then: "6.0", now: "3.0", change: "▼ 3.0", direction: "up", invert: true });
    expect(pace).toMatchObject({ then: "171", now: "138", change: "in 130–160", direction: "up" });
    expect(pauses).toMatchObject({ then: "1", now: "4", change: "▲ +3", direction: "up" });
  });

  it("wears rust when the number moved the wrong way (#195)", () => {
    const [index, fillers] = movedRows([
      rep({ ethos_index: 600, filler_count: 2 }),
      rep({ ethos_index: 550, filler_count: 9 }),
    ]);
    expect(index).toMatchObject({ change: "▼ 50", direction: "down" });
    expect(fillers).toMatchObject({ change: "▲ +7.0", direction: "down" });
  });

  it("names the pace zone rather than a distance to a hidden target", () => {
    expect(movedRows([rep({ wpm: 120 }), rep({ wpm: 175 })])[2]).toMatchObject({
      change: "over 160",
      direction: "down",
    });
    expect(movedRows([rep({ wpm: 150 }), rep({ wpm: 110 })])[2]).toMatchObject({
      change: "under 130",
      direction: "down",
    });
  });

  it("has no change to print with one recording, and nothing at all with none", () => {
    const [index] = movedRows([rep({ ethos_index: 512 })]);
    expect(index).toMatchObject({ then: "512", now: "512", change: null, direction: "flat" });

    for (const row of movedRows([])) {
      expect(row.then).toBeNull();
      expect(row.now).toBeNull();
      expect(row.change).toBeNull();
    }
  });

  it("skips unscored recordings in the Index series only", () => {
    const [index, fillers] = movedRows([
      rep({ ethos_index: null, filler_count: 8 }),
      rep({ ethos_index: 590, filler_count: 2 }),
    ]);
    expect(index.series).toEqual([590]);
    expect(fillers.series).toHaveLength(2);
  });
});

describe("presenceRow", () => {
  it("is absent until a video recording exists, then reads only those", () => {
    expect(presenceRow([rep({})])).toBeNull();
    const row = presenceRow([
      rep({ presence_score: 610 }),
      rep({}),
      rep({ presence_score: 680 }),
    ]);
    expect(row).toMatchObject({ then: "610", now: "680", change: "▲ +70" });
  });
});

describe("skillRows", () => {
  it("needs two carried readings before a skill gets a row", () => {
    const withPause = (pause: number) =>
      rep({
        dimensions: {
          tier1: { pause } as never,
          anchors: {} as never,
          tier2: null,
        },
      });
    expect(skillRows([withPause(50)])).toEqual([]);
    const rows = skillRows([withPause(50), withPause(80)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe("Pause");
    expect(rows[0].direction).toBe("up");
  });
});

describe("recordingName", () => {
  it("names the lesson, or the boss, never the id", () => {
    expect(recordingName({ lesson_id: "f1", mode: "daily" })).toBe("The baseline");
    expect(recordingName({ lesson_id: null, mode: "boss" })).toBe("Boss");
    expect(recordingName({ lesson_id: "nope", mode: "daily" })).toBe("Recording");
  });
});
