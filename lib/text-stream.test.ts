import { describe, expect, it } from "vitest";
import {
  beatAfter,
  chunkWords,
  holdFor,
  planStream,
  playStream,
  shownAt,
  STREAM,
  textAt,
  type Clock,
} from "./text-stream";

/* A seeded source, so a plan is the same every run. */
function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const always = (v: number) => () => v;

/* A clock that only moves when the test moves it. */
function heldClock() {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: Clock = {
    now: () => now,
    set: (fn, ms) => {
      id += 1;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clear: (t) => {
      timers.delete(t as number);
    },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].fn();
    }
    now = end;
  };
  return { clock, advance, pending: () => timers.size };
}

const LINE = "I'm sorry, but you're not who we're looking for.";

describe("the chunks", () => {
  it("are one or two words, and keep every word in order", () => {
    for (const seed of [1, 2, 3, 99, 1234]) {
      const chunks = chunkWords(LINE, seeded(seed));
      expect(chunks.join(" ")).toBe(LINE);
      for (const c of chunks) expect(c.split(" ").length).toBeLessThanOrEqual(2);
    }
  });

  it("never pair two words across a comma or a full stop", () => {
    const chunks = chunkWords("Yes, I do. It is.", always(0));
    expect(chunks).toContain("Yes,");
    expect(chunks.some((c) => /[,.]\s/.test(c))).toBe(false);
  });

  it("pair only short words, and only some of the time", () => {
    expect(chunkWords("an extraordinarily long word", always(0))).toEqual(["an", "extraordinarily", "long word"]);
    expect(chunkWords("to be or not", always(0.99))).toEqual(["to", "be", "or", "not"]);
  });
});

describe("the plan", () => {
  it("lands a chunk every 50 to 90 ms, with longer beats at a comma and a full stop", () => {
    for (const seed of [3, 5, 8, 13]) {
      const plan = planStream("Yes, of course. Why would I need this pen?", { rng: seeded(seed) });
      for (let i = 1; i < plan.chunks.length; i++) {
        const gap = plan.chunks[i].at - plan.chunks[i - 1].at;
        const beat = beatAfter(plan.chunks[i - 1].text.trim());
        expect(gap - beat).toBeGreaterThanOrEqual(STREAM.minGapMs);
        expect(gap - beat).toBeLessThanOrEqual(STREAM.maxGapMs);
      }
    }
  });

  it("varies the gaps, so it never ticks like a metronome", () => {
    const plan = planStream("What are you even saying about this pen today?", { rng: seeded(21) });
    const gaps = plan.chunks.slice(1).map((c, i) => c.at - plan.chunks[i].at);
    expect(new Set(gaps).size).toBeGreaterThan(1);
  });

  it("holds the whole line about 0.3 s a word, and never under 1.4 s", () => {
    expect(holdFor("Sell me this pen.")).toBe(1400);
    expect(holdFor(LINE)).toBe(2700);
    expect(planStream(LINE, { rng: seeded() }).holdMs).toBe(2700);
  });

  it("under reduced motion is the whole line at once: one chunk, one pop", () => {
    const plan = planStream(LINE, { reduced: true, lead: 40 });
    expect(plan.chunks).toEqual([{ text: LINE, at: 40 }]);
    expect(plan.doneAt).toBe(40);
  });

  it("says what is on screen at any moment", () => {
    const plan = planStream("Sell me this pen.", { rng: always(0) });
    expect(shownAt(plan, -1)).toBe(0);
    expect(textAt(plan, 0)).toBe(plan.chunks[0].text);
    expect(textAt(plan, plan.doneAt)).toBe("Sell me this pen.");
  });
});

describe("playing a plan on a held clock", () => {
  it("lands each chunk at its millisecond, then says it is done", () => {
    const plan = planStream(LINE, { rng: seeded(4) });
    const { clock, advance } = heldClock();
    const seen: { i: number; t: number; text: string }[] = [];
    let doneAt: number | null = null;
    let t = 0;
    playStream(plan, (i, text) => seen.push({ i, t, text }), () => (doneAt = t), clock);
    for (t = 0; t <= plan.doneAt + 10; t += 1) {
      advance(t === 0 ? 0 : 1);
    }
    expect(seen.map((s) => s.i)).toEqual(plan.chunks.map((_, i) => i));
    seen.forEach((s, i) => expect(s.t).toBe(plan.chunks[i].at));
    expect(seen[seen.length - 1].text).toBe(LINE);
    expect(doneAt).toBe(plan.doneAt);
  });

  it("catches up after a late frame instead of drifting", () => {
    const plan = planStream(LINE, { rng: seeded(9) });
    const { clock, advance } = heldClock();
    const seen: number[] = [];
    playStream(plan, (i) => seen.push(i), () => {}, clock);
    advance(plan.doneAt);
    expect(seen).toHaveLength(plan.chunks.length);
  });

  it("stops when told, mid-line, and leaves no timer behind", () => {
    const plan = planStream(LINE, { rng: seeded(2) });
    const { clock, advance, pending } = heldClock();
    const seen: number[] = [];
    let done = false;
    const stop = playStream(plan, (i) => seen.push(i), () => (done = true), clock);
    advance(plan.chunks[2].at);
    stop();
    advance(5000);
    expect(seen).toEqual([0, 1, 2]);
    expect(done).toBe(false);
    expect(pending()).toBe(0);
  });
});
