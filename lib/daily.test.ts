import { beforeEach, describe, expect, it } from "vitest";
import type { LexiconRow, RepRow } from "./client-data";

// The suite runs in node, which has no localStorage. daily.ts guards
// for that and degrades to "nothing done", so without a stub the
// markDone/isDone tests would pass vacuously.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};

import { dailyProgress, dailySet, isDone, markDone } from "./daily";
import type { StreakState } from "./streak";
import { spin, TOPICS, topicById, tipsFor } from "./topics";

const streak = (over: Partial<StreakState> = {}): StreakState => ({
  current: 0,
  longest: 0,
  atRisk: false,
  didToday: false,
  frozenInRun: 0,
  ...over,
});

const rep = (over: Partial<RepRow> = {}): RepRow =>
  ({
    id: Math.random().toString(36).slice(2),
    created_at: new Date().toISOString(),
    audio_path: null,
    duration_s: 60,
    filler_count: 3,
    pauses: [],
    ethos_index: 600,
    ...over,
  }) as RepRow;

const lex = (n: number): LexiconRow[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `l${i}`,
    original: `weak ${i}`,
    upgrade: `strong ${i}`,
    created_at: new Date().toISOString(),
  }));

beforeEach(() => {
  localStorage.clear();
});

describe("dailySet", () => {
  it("always offers the rep, even on day zero", () => {
    const tasks = dailySet({ reps: [], lexicon: [], streak: streak() });
    const repTask = tasks.find((t) => t.id === "rep")!;
    expect(repTask.available).toBe(true);
    expect(repTask.done).toBe(false);
    expect(repTask.href).toBe("/rep");
  });

  it("ticks the rep off from the streak, not from local state", () => {
    const tasks = dailySet({
      reps: [rep()],
      lexicon: [],
      streak: streak({ didToday: true }),
    });
    expect(tasks.find((t) => t.id === "rep")!.done).toBe(true);
  });

  it("locks tasks there isn't history for, and says why", () => {
    const tasks = dailySet({ reps: [], lexicon: [], streak: streak() });
    for (const id of ["flash", "listen", "checkin"] as const) {
      const t = tasks.find((x) => x.id === id)!;
      expect(t.available).toBe(false);
      expect(t.lockedNote).toBeTruthy();
    }
  });

  it("never marks an unavailable task done", () => {
    markDone("flash");
    // Only two entries — flash needs three.
    const tasks = dailySet({ reps: [], lexicon: lex(2), streak: streak() });
    const flash = tasks.find((t) => t.id === "flash")!;
    expect(flash.available).toBe(false);
    expect(flash.done).toBe(false);
  });

  it("opens lexicon flash once three upgrades exist", () => {
    const tasks = dailySet({ reps: [rep()], lexicon: lex(3), streak: streak() });
    expect(tasks.find((t) => t.id === "flash")!.available).toBe(true);
  });

  it("points listen-back at the most recent rep WITH audio", () => {
    const tasks = dailySet({
      reps: [
        rep({ id: "old", audio_path: "reps/a.webm" }),
        rep({ id: "newer-no-audio" }),
      ],
      lexicon: [],
      streak: streak(),
    });
    expect(tasks.find((t) => t.id === "listen")!.href).toBe("/rep/old");
  });

  it("opens the check-in only once there is a trend to read", () => {
    const one = dailySet({ reps: [rep()], lexicon: [], streak: streak() });
    expect(one.find((t) => t.id === "checkin")!.available).toBe(false);
    const two = dailySet({
      reps: [rep(), rep()],
      lexicon: [],
      streak: streak(),
    });
    expect(two.find((t) => t.id === "checkin")!.available).toBe(true);
  });

  it("keeps the set to four, one of which records", () => {
    const tasks = dailySet({ reps: [], lexicon: [], streak: streak() });
    expect(tasks).toHaveLength(4);
    expect(tasks.filter((t) => t.id === "rep")).toHaveLength(1);
  });
});

describe("markDone / isDone", () => {
  it("remembers within the day and forgets across days", () => {
    const today = new Date(2026, 7, 10, 9);
    markDone("flash", today);
    expect(isDone("flash", today)).toBe(true);
    expect(isDone("flash", new Date(2026, 7, 11, 9))).toBe(false);
  });

  it("keeps tasks independent", () => {
    markDone("flash");
    expect(isDone("checkin")).toBe(false);
  });
});

describe("dailyProgress", () => {
  it("counts against what can actually be done today", () => {
    // Day zero: only the rep is available.
    const p = dailyProgress(
      dailySet({ reps: [], lexicon: [], streak: streak() })
    );
    expect(p.available).toBe(1);
    expect(p.done).toBe(0);
    expect(p.allDone).toBe(false);
  });

  it("is complete when every available task is done", () => {
    const p = dailyProgress(
      dailySet({ reps: [], lexicon: [], streak: streak({ didToday: true }) })
    );
    expect(p.done).toBe(1);
    expect(p.allDone).toBe(true);
  });
});

describe("topic roulette", () => {
  it("never returns the topic already on screen", () => {
    for (const t of TOPICS) {
      // Force the excluded item's index to prove the filter, not luck.
      expect(spin(t.id, () => 0).id).not.toBe(t.id);
      expect(spin(t.id, () => 0.999).id).not.toBe(t.id);
    }
  });

  it("resolves a topic back from its id", () => {
    expect(topicById(TOPICS[0].id)?.prompt).toBe(TOPICS[0].prompt);
    expect(topicById("nope")).toBeNull();
    expect(topicById(null)).toBeNull();
  });

  it("gives every topic a shape with real tips", () => {
    for (const t of TOPICS) {
      expect(tipsFor(t.shape).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("stays inside the pool for any random value", () => {
    const ids = new Set(TOPICS.map((t) => t.id));
    for (const r of [0, 0.25, 0.5, 0.75, 0.9999]) {
      expect(ids.has(spin(null, () => r).id)).toBe(true);
    }
  });
});
