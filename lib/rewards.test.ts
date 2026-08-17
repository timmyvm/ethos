import { describe, expect, it } from "vitest";
import type { RepRow } from "./client-data";
import { computeMetrics, type RepMetrics } from "./metrics";
import type { Milestone } from "./progress";
import {
  anticipation,
  endNote,
  freshStart,
  landmark,
  nearMisses,
  openLoop,
  personalBests,
} from "./rewards";
import type { StreakState } from "./streak";

const streak = (over: Partial<StreakState> = {}): StreakState => ({
  current: 0,
  longest: 0,
  atRisk: false,
  didToday: false,
  frozenInRun: 0,
  ...over,
});

const ms = (over: Partial<Milestone> = {}): Milestone => ({
  id: "m",
  kind: "unit",
  label: "Unlock Pace Control",
  detail: "4 total stars",
  current: 3,
  target: 4,
  progress: 0.75,
  remaining: 1,
  remainingLabel: "1 to go",
  ...over,
});

const metrics = (over: Partial<RepMetrics> = {}): RepMetrics => ({
  ...computeMetrics([], 60),
  durationS: 60,
  wpm: 145,
  fillerCount: 3,
  fillersPerMin: 3,
  heldPauses: 2,
  composedPauses: 0,
  midSentencePauses: 2,
  stars: 2,
  ...over,
});

const rep = (over: Partial<RepRow> = {}): RepRow =>
  ({
    id: Math.random().toString(36),
    duration_s: 60,
    filler_count: 6,
    ethos_index: 600,
    pauses: [],
    created_at: new Date().toISOString(),
    ...over,
  }) as RepRow;

describe("anticipation", () => {
  it("leads with the streak when one is on the line", () => {
    const a = anticipation([ms()], streak({ current: 5 }));
    expect(a?.headline).toContain("5-day streak");
    expect(a?.detail).toContain("1 to go");
  });

  it("falls back to the closest milestone", () => {
    const a = anticipation([ms()], streak({ current: 0 }));
    expect(a?.headline).toBe("Unlock Pace Control · 1 to go");
    expect(a?.detail).toBe("4 total stars");
  });

  it("keeps milestone labels intact rather than splicing them", () => {
    // "Ethos 700" must not be lowercased or jammed mid-sentence.
    const a = anticipation(
      [ms({ label: "Ethos 700", detail: "best is 689", remainingLabel: "11 to go" })],
      streak({ current: 4 })
    );
    expect(a?.detail).toContain("Ethos 700");
    expect(a?.detail).not.toContain("ethos 700");
    expect(a?.detail).not.toMatch(/puts you .* on/);
  });

  it("says nothing rather than something empty", () => {
    expect(anticipation([], streak())).toBeNull();
  });

  it("always carries a number when it speaks", () => {
    for (const s of [streak(), streak({ current: 3 })]) {
      const a = anticipation([ms()], s);
      expect(`${a?.headline} ${a?.detail}`).toMatch(/\d/);
    }
  });
});

describe("nearMisses", () => {
  it("keeps only what one rep could realistically close", () => {
    const near = nearMisses([
      ms({ id: "a", progress: 0.94 }),
      ms({ id: "b", progress: 0.5 }),
      ms({ id: "c", progress: 0.86 }),
    ]);
    expect(near.map((m) => m.id)).toEqual(["a", "c"]);
  });
});

describe("openLoop", () => {
  const lessons = [
    { id: "f1", title: "The baseline rep" },
    { id: "f2", title: "Kill 'like'" },
  ];

  it("names a started-but-unfinished lesson", () => {
    const loop = openLoop({ f1: 3, f2: 1 }, lessons);
    expect(loop?.headline).toBe("Kill 'like' is 1 of 3");
    expect(loop?.detail).toBe("2 stars left on it");
  });

  it("stays quiet when nothing is half-done", () => {
    expect(openLoop({ f1: 3 }, lessons)).toBeNull();
    expect(openLoop({}, lessons)).toBeNull();
  });
});

describe("freshStart", () => {
  it("recognises the landmarks", () => {
    expect(landmark(new Date(2026, 0, 1))).toBe("year");
    expect(landmark(new Date(2026, 7, 1))).toBe("month");
    expect(landmark(new Date(2026, 7, 10))).toBe("monday");
    expect(landmark(new Date(2026, 7, 12))).toBeNull();
  });

  it("points forward and never scolds the closed chapter", () => {
    const guilt = /missed|failed|behind|should have|lost/i;
    for (const d of [
      new Date(2026, 0, 1),
      new Date(2026, 7, 1),
      new Date(2026, 7, 10),
    ]) {
      const f = freshStart(d)!;
      expect(`${f.headline} ${f.detail}`).not.toMatch(guilt);
    }
  });

  it("is silent on an ordinary day", () => {
    expect(freshStart(new Date(2026, 7, 12))).toBeNull();
  });
});

describe("endNote", () => {
  const base = { gains: [], repCount: 4 };

  it("prefers a composed pause — the hardest thing to do", () => {
    const e = endNote({
      ...base,
      metrics: metrics({ composedPauses: 2 }),
      streak: streak({ current: 5 }),
    });
    expect(e.headline).toBe("2 composed pauses");
  });

  it("falls through to a clean rep, then the zone, then the streak", () => {
    expect(
      endNote({
        ...base,
        metrics: metrics({ fillerCount: 0 }),
        streak: streak(),
      }).headline
    ).toBe("Zero fillers");
    expect(
      endNote({ ...base, metrics: metrics({ wpm: 145 }), streak: streak() })
        .headline
    ).toBe("145 words a minute");
    expect(
      endNote({
        ...base,
        metrics: metrics({ wpm: 200 }),
        streak: streak({ current: 4 }),
      }).headline
    ).toBe("4 days running");
  });

  it("always ends on something, even for a rough first rep", () => {
    const e = endNote({
      ...base,
      repCount: 1,
      metrics: metrics({ wpm: 210, fillerCount: 22, composedPauses: 0 }),
      streak: streak({ current: 1 }),
    });
    expect(e.headline).toBe("Rep 1 logged");
    expect(e.detail).toMatch(/\w/);
  });

  it("never ends on a criticism", () => {
    const harsh = /too many|bad|poor|worse|failed|sloppy/i;
    for (const m of [
      metrics({ fillerCount: 30, wpm: 220, composedPauses: 0 }),
      metrics({ composedPauses: 3 }),
      metrics({ fillerCount: 0 }),
    ]) {
      const e = endNote({ ...base, metrics: m, streak: streak({ current: 2 }) });
      expect(`${e.headline} ${e.detail}`).not.toMatch(harsh);
    }
  });
});

describe("personalBests", () => {
  it("stays quiet on the very first rep", () => {
    expect(personalBests([], metrics(), 700)).toEqual([]);
  });

  it("compares against every prior rep, including the most recent", () => {
    // The regression: treating the argument as "history minus the new
    // rep" dropped the 640 and claimed the record was 600.
    const out = personalBests(
      [rep({ ethos_index: 600 }), rep({ ethos_index: 640 })],
      metrics(),
      700
    );
    expect(out[0].headline).toBe("Best Ethos yet");
    expect(out[0].detail).toBe("700, past your 640");
  });

  it("counts a single prior rep as a record to beat", () => {
    const out = personalBests([rep({ ethos_index: 600 })], metrics(), 700);
    expect(out[0].detail).toBe("700, past your 600");
  });

  it("says nothing when the rep did not beat anything", () => {
    const out = personalBests(
      [
        rep({ ethos_index: 800, filler_count: 0 }),
        rep({ ethos_index: 810, filler_count: 0 }),
      ],
      metrics({ fillersPerMin: 9, heldPauses: 0 }),
      600
    );
    expect(out).toEqual([]);
  });

  it("names the number it beat, every time", () => {
    const out = personalBests(
      [rep({ ethos_index: 500, filler_count: 12 }), rep({ ethos_index: 520 })],
      metrics({ fillersPerMin: 1, heldPauses: 5 }),
      900
    );
    expect(out.length).toBeGreaterThan(0);
    for (const b of out) expect(b.detail).toMatch(/\d/);
  });
});
