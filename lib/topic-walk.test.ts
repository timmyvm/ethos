import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { topicsFor } from "./portfolio";
import {
  NO_WALK,
  RECENT_TOPICS,
  TOPIC_WALK_KEY,
  cleanWalk,
  drawTopic,
  nextTopic,
  readWalk,
  shown,
  writeWalk,
  type TopicWalk,
} from "./topic-walk";
import { spin, TOPICS, type Topic } from "./topics";

/** A seeded generator, so a failing walk can be replayed. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A pure walk: what the screen would show, `n` draws after `first`. */
function walkOf(pool: readonly Topic[], n: number, rand: () => number, first: string | null = null): string[] {
  let memory: TopicWalk = NO_WALK;
  let onScreen = first;
  const out: string[] = first ? [first] : [];
  if (first) memory = shown(memory, first, pool);
  for (let i = 0; i < n; i++) {
    const t = drawTopic(pool, memory, onScreen, rand);
    memory = shown(memory, t.id, pool);
    onScreen = t.id;
    out.push(t.id);
  }
  return out;
}

/** The fewest draws between one showing of a topic and its next. */
function minGap(seq: string[]): number {
  const last = new Map<string, number>();
  let gap = Infinity;
  seq.forEach((id, i) => {
    if (last.has(id)) gap = Math.min(gap, i - last.get(id)!);
    last.set(id, i);
  });
  return gap;
}

describe("the reroll's walk", () => {
  const pools: [string, readonly Topic[]][] = [
    ["all", TOPICS],
    ["school", topicsFor("school")],
  ];

  for (const [name, pool] of pools) {
    it(`shows every topic in the ${name} pool once before any comes back`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const seq = walkOf(pool, pool.length, seeded(seed));
        expect(new Set(seq).size).toBe(pool.length);
      }
    });

    it(`never shows one of the last ${RECENT_TOPICS} in the ${name} pool, across walks`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const seq = walkOf(pool, pool.length * 6, seeded(seed));
        expect(minGap(seq)).toBeGreaterThan(RECENT_TOPICS);
        /* And each walk of the pool is whole: every block of a pool's
           length, from the start, is the pool once. */
        for (let w = 0; w < 6; w++) {
          expect(new Set(seq.slice(w * pool.length, (w + 1) * pool.length)).size).toBe(pool.length);
        }
      }
    });
  }

  it("counts the card's topic as seen and never opens on it", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const seq = walkOf(TOPICS, TOPICS.length - 1, seeded(seed), "t3");
      expect(seq[1]).not.toBe("t3");
      expect(new Set(seq).size).toBe(TOPICS.length);
    }
  });

  it("only ever draws from the pool it is given", () => {
    const school = topicsFor("school");
    const ids = new Set(school.map((t) => t.id));
    const seq = walkOf(school, 300, seeded(7));
    expect(seq.every((id) => ids.has(id))).toBe(true);
    for (const id of ["t10", "t11", "t18"]) expect(seq).not.toContain(id);
  });

  /* A pool that changes under a walk (the introduction's answers
     edited) keeps going: what was walked in the larger pool still
     counts, and the smaller one is finished first. */
  it("carries on across a pool that shrinks", () => {
    const rand = seeded(3);
    let memory: TopicWalk = NO_WALK;
    for (let i = 0; i < 10; i++) memory = shown(memory, drawTopic(TOPICS, memory, null, rand).id, TOPICS);
    const school = topicsFor("school");
    const seen = new Set(memory.walk);
    const left = school.filter((t) => !seen.has(t.id)).length;
    const next: string[] = [];
    for (let i = 0; i < left; i++) {
      const t = drawTopic(school, memory, next.at(-1) ?? null, rand);
      memory = shown(memory, t.id, school);
      next.push(t.id);
    }
    expect(next.some((id) => seen.has(id))).toBe(false);
    expect(new Set(next).size).toBe(left);
  });

  it("never returns the topic on screen, even from a pool of two", () => {
    const two = TOPICS.slice(0, 2);
    let memory: TopicWalk = NO_WALK;
    let on = "t1";
    for (let i = 0; i < 20; i++) {
      const t = drawTopic(two, memory, on, seeded(i + 1));
      expect(t.id).not.toBe(on);
      memory = shown(memory, t.id, two);
      on = t.id;
    }
  });

  it("keeps the memory small: each id once, the recent capped", () => {
    const seq = walkOf(TOPICS, 500, seeded(11));
    let memory: TopicWalk = NO_WALK;
    for (const id of seq) memory = shown(memory, id, TOPICS);
    expect(memory.recent.length).toBe(RECENT_TOPICS);
    expect(new Set(memory.walk).size).toBe(memory.walk.length);
    expect(memory.walk.length).toBeLessThanOrEqual(TOPICS.length);
  });

  /* The old roulette, for the record: `spin`, random but for the one on
     screen, brought a topic back inside 20 spins in most seeds even
     from sixty; the walk never does (above). */
  it("is not what the old spin did", () => {
    let repeatsSoon = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const rand = seeded(seed);
      const seq: string[] = [];
      for (let i = 0; i < 20; i++) seq.push(spin(seq.at(-1) ?? null, rand).id);
      if (new Set(seq).size < seq.length) repeatsSoon++;
    }
    expect(repeatsSoon).toBeGreaterThan(15);
  });
});

/** A localStorage for node: the device's memory is what's under test. */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe("the memory on the device", () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("lives under ethos.topics.seen, emptied with the account's other ethos keys", () => {
    expect(TOPIC_WALK_KEY.startsWith("ethos")).toBe(true);
  });

  it("reads back what it wrote", () => {
    writeWalk({ walk: ["t3", "t1"], recent: ["t3", "t1"] });
    expect(readWalk()).toEqual({ walk: ["t3", "t1"], recent: ["t3", "t1"] });
    expect(JSON.parse(localStorage.getItem(TOPIC_WALK_KEY)!).v).toBe(1);
  });

  it("reads anything malformed as a fresh walk", () => {
    for (const raw of ["{not json", "null", "[]", '"t1"', '{"walk":"t1"}', "{}"]) {
      localStorage.setItem(TOPIC_WALK_KEY, raw);
      expect(readWalk()).toEqual(NO_WALK);
    }
  });

  it("drops ids that are not topics, repeats and overflow", () => {
    const many = Array.from({ length: 50 }, (_, i) => `t${i + 1}`);
    expect(cleanWalk({ walk: ["t1", "t1", "x9", 4, "t999", "t2"], recent: many })).toEqual({
      walk: ["t1", "t2"],
      recent: many.slice(0, RECENT_TOPICS),
    });
  });

  it("reads as a fresh walk where storage throws", () => {
    (globalThis as { localStorage?: Storage }).localStorage = {
      ...fakeStorage(),
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readWalk()).toEqual(NO_WALK);
    expect(() => writeWalk({ walk: ["t1"], recent: ["t1"] })).not.toThrow();
    const drawn = nextTopic(TOPICS, "t1");
    expect(drawn.id).not.toBe("t1");
    expect(TOPICS).toContain(drawn);
  });

  it("walks the whole pool from the device's memory, spin after spin", () => {
    const rand = seeded(5);
    const seen = [nextTopic(TOPICS, "t2", rand).id];
    for (let i = 1; i < TOPICS.length - 1; i++) seen.push(nextTopic(TOPICS, seen[i - 1], rand).id);
    expect(seen).not.toContain("t2");
    expect(new Set(seen).size).toBe(TOPICS.length - 1);
    /* The walk is done: the next opens a new one, never on a recent topic. */
    const next = nextTopic(TOPICS, seen.at(-1)!, rand).id;
    expect(seen.slice(-RECENT_TOPICS)).not.toContain(next);
    expect(readWalk().walk).toEqual([next]);
    /* And the second walk is whole too, the wheel's landing never noted twice. */
    const second = [next];
    for (let i = 1; i < TOPICS.length; i++) second.push(nextTopic(TOPICS, second[i - 1], rand).id);
    expect(new Set(second).size).toBe(TOPICS.length);
    expect(minGap([...seen, ...second])).toBeGreaterThan(RECENT_TOPICS);
  });

  it("remembers the card's topic when the roulette opens", () => {
    const first = nextTopic(TOPICS, "t7", seeded(9));
    expect(first.id).not.toBe("t7");
    expect(readWalk().walk).toEqual([first.id, "t7"]);
    expect(readWalk().recent).toEqual([first.id, "t7"]);
  });
});
