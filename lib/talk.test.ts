import { describe, expect, it } from "vitest";
import { landedAt, planTalk, stepFor, TALK_PACE } from "./talk";
import { PICK, TALK, talkBlip } from "./intro-sound";
import { QUESTIONS, PLAN_COPY } from "./onboarding";
import { INTERVIEW, ROOM_COPY } from "./room-script";

describe("Demos talking (#501)", () => {
  it("lands a word at a time, quick, his question then the line under it", () => {
    const p = planTalk(["What do I call you?", "I'm Demos."], { lead: 200 });
    expect(p.lines).toEqual([["What", "do", "I", "call", "you?"], ["I'm", "Demos."]]);
    expect(p.at[0]).toBe(200);
    const step = stepFor(5);
    expect(p.at.slice(0, 5)).toEqual([200, 200 + step, 200 + 2 * step, 200 + 3 * step, 200 + 4 * step]);
    /* The second line waits a beat after the first. */
    expect(p.at[5] - p.at[4]).toBe(TALK_PACE.lineGapMs);
    expect(p.doneAt).toBe(p.at[p.at.length - 1]);
    /* A blip under every word. */
    expect(p.blips).toEqual(p.at);
  });

  it("never holds a reader up: every line of the walk is said in about a second", () => {
    const lines = [
      ...QUESTIONS.flatMap((q) => [q.title, q.line ?? ""]),
      PLAN_COPY.next,
      ROOM_COPY.guide,
      ...INTERVIEW.after,
    ].filter(Boolean);
    for (const line of lines) {
      const p = planTalk([line]);
      /* A reader takes about 240 ms a word; he is never slower than a third of that. */
      expect([line, p.doneAt <= TALK_PACE.lineMs + TALK_PACE.maxStepMs]).toEqual([line, true]);
      expect([line, p.doneAt / Math.max(1, p.at.length - 1) <= 85]).toEqual([line, true]);
    }
  });

  it("keeps a word's step between 50 and 85 ms", () => {
    expect(stepFor(1)).toBe(85);
    expect(stepFor(6)).toBe(85);
    expect(stepFor(12)).toBe(75);
    expect(stepFor(40)).toBe(50);
  });

  it("under reduced motion lands whole, with one blip", () => {
    const p = planTalk(["How old are you?", "A second line."], { lead: 120, reduced: true });
    expect(p.at.every((t) => t === 120)).toBe(true);
    expect(p.blips).toEqual([120]);
    expect(landedAt(p, 119)).toBe(0);
    expect(landedAt(p, 120)).toBe(7);
  });

  it("says nothing for nothing", () => {
    expect(planTalk(["", "  "]).at).toEqual([]);
    expect(planTalk([]).blips).toEqual([]);
  });

  it("counts what has landed", () => {
    const p = planTalk(["One two three"]);
    expect([landedAt(p, 0), landedAt(p, p.at[1]), landedAt(p, 10_000)]).toEqual([1, 2, 3]);
  });
});

describe("the introduction's sounds (#501)", () => {
  it("are quiet: under the room's own pops", () => {
    expect(TALK.peak).toBeLessThanOrEqual(0.05);
    for (const n of PICK) expect(n.peak).toBeLessThanOrEqual(0.05);
  });

  it("moves each talk blip's pitch a little, never far", () => {
    const low = talkBlip(() => 0);
    const high = talkBlip(() => 0.999999);
    expect(low.freq).toBeCloseTo(TALK.freq * (1 - TALK.spread));
    expect(high.freq).toBeCloseTo(TALK.freq * (1 + TALK.spread), 2);
    /* It falls, which is what makes it round rather than a beep. */
    expect(low.endFreq).toBeLessThan(low.freq);
  });

  it("picks rise", () => {
    expect(PICK[1].freq).toBeGreaterThan(PICK[0].freq);
    expect(PICK[1].at).toBeGreaterThan(PICK[0].at);
  });
});
