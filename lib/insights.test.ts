import { describe, expect, it } from "vitest";
import { bestHour, fillerHeatmap, fillerTally, insights } from "./insights";
import type { RepRow } from "./client-data";

function rep(over: Partial<RepRow> = {}): RepRow {
  return {
    id: Math.random().toString(36),
    lesson_id: "f1",
    created_at: new Date(2026, 7, 9, 12).toISOString(),
    duration_s: 60,
    transcript: "",
    wpm: 145,
    filler_count: 3,
    fillers: [],
    pauses: [],
    stars: 2,
    focus: null,
    strength: null,
    supply: null,
    ethos_index: 600,
    dimensions: null,
    ...over,
  };
}

const has = (list: { id: string }[], id: string) =>
  list.some((i) => i.id === id);

describe("fillerTally", () => {
  it("ranks fillers by frequency across reps", () => {
    const reps = [
      rep({ fillers: [{ word: "um", t: 1 }, { word: "like", t: 2 }] }),
      rep({ fillers: [{ word: "um", t: 1 }, { word: "um", t: 3 }] }),
    ];
    expect(fillerTally(reps)).toEqual([
      ["um", 3],
      ["like", 1],
    ]);
  });
});

describe("fillerHeatmap", () => {
  it("buckets fillers by position within the rep", () => {
    const reps = [
      rep({
        duration_s: 100,
        fillers: [
          { word: "um", t: 5 },
          { word: "um", t: 10 },
          { word: "uh", t: 95 },
        ],
      }),
    ];
    const heat = fillerHeatmap(reps, 5);
    expect(heat[0]).toBe(2); // first 20%
    expect(heat[4]).toBe(1); // last 20%
  });

  it("ignores reps with no duration", () => {
    expect(fillerHeatmap([rep({ duration_s: 0, fillers: [{ word: "um", t: 1 }] })])).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("bestHour", () => {
  it("stays silent without enough spread", () => {
    expect(bestHour([rep(), rep(), rep()])).toBeNull();
  });

  it("finds the cleanest hour once there is data", () => {
    const morning = Array.from({ length: 3 }, () =>
      rep({ created_at: new Date(2026, 7, 9, 7).toISOString(), filler_count: 1 })
    );
    const night = Array.from({ length: 3 }, () =>
      rep({ created_at: new Date(2026, 7, 9, 22).toISOString(), filler_count: 9 })
    );
    const best = bestHour([...morning, ...night]);
    expect(best?.hour).toBe(7);
  });
});

describe("insights", () => {
  it("says nothing before there is a pattern", () => {
    expect(insights([rep(), rep()])).toEqual([]);
  });

  it("names a dominant filler with its share", () => {
    const reps = Array.from({ length: 4 }, () =>
      rep({
        fillers: [
          { word: "um", t: 1 },
          { word: "um", t: 2 },
          { word: "like", t: 3 },
        ],
      })
    );
    const out = insights(reps);
    expect(has(out, "dominant-filler")).toBe(true);
    expect(out.find((i) => i.id === "dominant-filler")!.headline).toContain(
      "um"
    );
  });

  it("flags fillers clustering at the open", () => {
    const reps = Array.from({ length: 4 }, () =>
      rep({
        duration_s: 60,
        fillers: [
          { word: "um", t: 1 },
          { word: "um", t: 3 },
          { word: "uh", t: 5 },
        ],
      })
    );
    expect(has(insights(reps), "filler-cluster")).toBe(true);
  });

  it("calls out sprinting pace", () => {
    const reps = Array.from({ length: 8 }, () => rep({ wpm: 185 }));
    expect(has(insights(reps), "pace-fast")).toBe(true);
  });

  it("notices silence increasing over time", () => {
    const early = Array.from({ length: 3 }, () => rep({ pauses: [] }));
    const later = Array.from({ length: 5 }, () =>
      rep({
        pauses: [
          { t: 1, len: 1.2, kind: "pre" as const },
          { t: 9, len: 1.1, kind: "pre" as const },
        ],
      })
    );
    expect(has(insights([...early, ...later]), "silence-up")).toBe(true);
  });

  it("every insight carries a detail line with numbers", () => {
    const reps = Array.from({ length: 8 }, () =>
      rep({ fillers: [{ word: "um", t: 1 }, { word: "um", t: 2 }] })
    );
    for (const i of insights(reps)) {
      expect(i.detail.length).toBeGreaterThan(10);
      expect(/\d/.test(i.detail)).toBe(true);
    }
  });
});
