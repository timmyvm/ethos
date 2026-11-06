import { describe, expect, it } from "vitest";
import type { RepRow } from "./client-data";
import {
  movedRows,
  presenceRow,
  recordingName,
  recordingTrait,
  rolling,
  rowTrait,
  skillRows,
} from "./log";

/*
 * The summary screen's one row grammar (#217): every metric prints
 * where it started, where it is, and the signed change, so nobody
 * subtracts. Pace prints its zone instead of a verdict.
 */
/** Enough words to score (`measured`): the rows below are real takes. */
const SAID =
  "The best part of my week was a long walk by the river with my sister after work on Friday, talking about nothing much.";

function rep(over: Partial<RepRow>): RepRow {
  return {
    id: "r",
    lesson_id: "f1",
    created_at: "2026-08-19T09:00:00Z",
    duration_s: 60,
    transcript: SAID,
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
    expect(pace).toMatchObject({ then: "171", now: "138", change: "in 130 to 160", direction: "up" });
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

  /* A one-word 8s take printed Words / min 128 to 7 and Fillers 9.3 to 0.0. */
  it("leaves a take too short to score out of the measurements", () => {
    const short = rep({ transcript: "Hello.", ethos_index: null, duration_s: 8.3, wpm: 7, filler_count: 0 });
    const [, fillers, pace, pauses] = movedRows([
      rep({ wpm: 120, filler_count: 9, pauses: held(1) }),
      rep({ wpm: 128, filler_count: 9, pauses: held(2) }),
      short,
    ]);
    expect(pace).toMatchObject({ now: "128", change: "under 130" });
    expect(pace.series).toEqual([120, 128]);
    expect(fillers.now).toBe("9.0");
    expect(pauses.now).toBe("2");
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
    // A take too short to score made no Index, so its dimensions are no reading.
    expect(skillRows([withPause(50), { ...withPause(10), transcript: "Hi there." }])).toEqual([]);
  });
});

describe("recordingName", () => {
  it("names the lesson, or the boss, never the id", () => {
    expect(recordingName({ lesson_id: "f1", mode: "daily" })).toBe("The baseline");
    expect(recordingName({ lesson_id: null, mode: "boss" })).toBe("Boss");
    expect(recordingName({ lesson_id: "nope", mode: "daily" })).toBe("Recording");
  });
});

describe("recordingName, every stored shape", () => {
  it("names a lesson practice, a path item and a game by title", () => {
    expect(recordingName({ lesson_id: "lesson:the-landing:2", mode: "daily" })).toBe("The landing");
    expect(recordingName({ lesson_id: "pause-1-1", mode: "daily" })).not.toBe("Recording");
    expect(recordingName({ lesson_id: "game:qa:x", mode: "daily" })).toBe("Q&A");
  });

  /* The games plan, item 15 and map 2.4: Hostile's take was "Recording",
     and a game round names the rung it was played at. */
  it("names Hostile Q&A's take, and a measured round's level", () => {
    expect(recordingName({ lesson_id: "hostile-take", mode: "daily" })).toBe("Hostile Q&A");
    const level = (game: string, n: unknown) => ({ game, level: n });
    expect(recordingName({ lesson_id: "game:qa:qa2", mode: "daily", round: level("qa", 2) })).toBe("Q&A, level 2");
    expect(recordingName({ lesson_id: "game:rush:ru1", mode: "daily", round: level("rush", 1) })).toBe("Speed rush, level 1");
    expect(recordingName({ lesson_id: "game:interview:iv3", mode: "daily", round: level("interview", 3) })).toBe("Interview, level 3");
    // Before 0026 there is no round, so no level to name.
    expect(recordingName({ lesson_id: "game:qa:qa2", mode: "daily", round: null })).toBe("Q&A");
    // A round of another game, or a level out of range, names none.
    expect(recordingName({ lesson_id: "game:qa:qa2", mode: "daily", round: level("rush", 2) })).toBe("Q&A");
    expect(recordingName({ lesson_id: "game:qa:qa2", mode: "daily", round: level("qa", 7) })).toBe("Q&A");
  });
});

/*
 * The log's rows wear their trait's tone (the colour pass), so the
 * mapping has to say the same trait the lesson or the path item says,
 * and say nothing for a recording that practised no one trait.
 */
describe("recordingTrait", () => {
  it("reads the trait from a lesson, a path item or a road unit", () => {
    expect(recordingTrait({ lesson_id: "lesson:the-cold-open:1" })).toBe("fillers");
    expect(recordingTrait({ lesson_id: "lesson:change-gear:3" })).toBe("pace");
    expect(recordingTrait({ lesson_id: "range-2-4" })).toBe("range");
    expect(recordingTrait({ lesson_id: "h1" })).toBe("pause");
    expect(recordingTrait({ lesson_id: "f2" })).toBe("fillers");
    expect(recordingTrait({ lesson_id: "p3" })).toBe("pace");
  });

  it("is null where no single trait was practised", () => {
    expect(recordingTrait({ lesson_id: null })).toBeNull();
    expect(recordingTrait({ lesson_id: "s1" })).toBeNull();
    expect(recordingTrait({ lesson_id: "boss:jevons" })).toBeNull();
    expect(recordingTrait({ lesson_id: "game:qa:x" })).toBeNull();
    expect(recordingTrait({ lesson_id: "lesson:nope:1" })).toBeNull();
  });
});

describe("rowTrait", () => {
  it("gives the three trait-shaped metrics their trait, and the Index none", () => {
    expect(rowTrait("fillers")).toBe("fillers");
    expect(rowTrait("wpm")).toBe("pace");
    expect(rowTrait("held")).toBe("pause");
    expect(rowTrait("index")).toBeNull();
    expect(rowTrait("presence")).toBeNull();
    expect(rowTrait("structure")).toBeNull();
  });
});

/*
 * log-23: the trend track draws a trailing mean, so a noisy series
 * reads as a direction. It never drops a point and never moves the
 * first one: the line still starts at the Day 1 value beside it.
 */
describe("rolling", () => {
  it("averages each point with the ones before it, up to the window", () => {
    expect(rolling([3, 6, 9, 12], 3)).toEqual([3, 4.5, 6, 9]);
  });

  it("keeps the length and the first value", () => {
    const raw = [128, 135, 142, 149, 156, 133, 140];
    const smooth = rolling(raw, 3);
    expect(smooth).toHaveLength(raw.length);
    expect(smooth[0]).toBe(raw[0]);
  });

  it("flattens a sawtooth into its level", () => {
    const saw = [1, 3, 1, 3, 1, 3, 1, 3];
    const smooth = rolling(saw, 2);
    expect(smooth.slice(1).every((v) => v === 2)).toBe(true);
  });

  it("is the series itself for a window of one, and empty for none", () => {
    expect(rolling([5, 1, 4], 1)).toEqual([5, 1, 4]);
    expect(rolling([], 3)).toEqual([]);
  });
});
