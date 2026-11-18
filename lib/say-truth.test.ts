import { describe, expect, it } from "vitest";
import {
  DUE_A_DAY,
  SAY_LIMITED,
  afterTest,
  emptyLine,
  checkLine,
  freshState,
  markIn,
  mergeSwaps,
  nextDue,
  nextTestLine,
  nowSays,
  phraseAt,
  proofIn,
  sayLists,
  stateOf,
  timesIn,
  usesOf,
  coachSwap,
  wordSwap,
  type Swap,
  type SwapState,
  type SwapView,
  type TakeText,
} from "./say";
import { countWords, fitGlanceProof } from "./glance";

/*
 * The #507 review: every way "you now say" could count something that is
 * not a later recording saying the better phrase, and every way the test's
 * spacing could give more than three a day.
 */

const at = (day: string, hour = 18) => new Date(`${day}T${String(hour).padStart(2, "0")}:12:00`).toISOString();
const timed = (text: string, from = 0) =>
  text.split(/\s+/).map((word, i) => ({ word, start: from + i * 0.4, end: from + i * 0.4 + 0.3 }));
const take = (id: string, day: string, transcript: string): TakeText => ({ id, created_at: at(day), transcript });

const swap = (over: Partial<Swap> = {}): Swap => ({
  key: "c:1",
  source: "coach",
  id: "1",
  said: "kind of unique",
  better: "unique",
  sentence: "The plan was kind of unique.",
  repId: "src",
  savedAt: at("2026-11-16"),
  ...over,
});

describe("the struck phrase is never the better one", () => {
  // A better phrase inside the weak one ("unique" in "kind of unique"):
  // saying the weak phrase again must not count, prove, or pass the test.
  const s = swap();

  it("never counts a recording that said the weak phrase again", () => {
    const uses = usesOf(s, [
      take("again", "2026-11-17", "Honestly the menu was kind of unique again."),
      take("better", "2026-11-18", "The menu was unique."),
    ]);
    expect(uses.map((u) => u.repId)).toEqual(["better"]);
    expect(timesIn("It was kind of unique, and unique.", "unique", "kind of unique")).toBe(1);
  });

  it("never passes the test on the weak phrase, and says it was the old one", () => {
    const again = checkLine({ text: "The plan was kind of unique.", words: timed("The plan was kind of unique") }, "unique", "kind of unique");
    expect(again).toMatchObject({ heard: false, old: true });
    const better = checkLine({ text: "The plan was unique.", words: timed("The plan was unique") }, "unique", "kind of unique");
    expect(better).toMatchObject({ heard: true, old: false });
    // The other way round: the old phrase inside the better one is the better one said.
    expect(checkLine({ text: "It was really good.", words: timed("It was really good") }, "really good", "good")).toMatchObject({ heard: true, old: false });
  });

  it("never fires the proof line on the weak phrase", () => {
    const words = timed("The plan was kind of unique", 2);
    expect(proofIn([s], {}, { id: "new", transcript: "The plan was kind of unique.", words, startedAt: new Date(at("2026-11-18")) })).toBeNull();
    const ok = proofIn([s], {}, { id: "new", transcript: "The plan was unique.", words: timed("The plan was unique", 2), startedAt: new Date(at("2026-11-18")) });
    expect(ok?.at).toBeCloseTo(3.2);
  });
});

describe("a different phrase that holds the better one is not it", () => {
  const aware = swap({ said: "conscious", better: "aware", sentence: null });

  it("never finds a word inside a hyphened one", () => {
    expect(timesIn("I'm self-aware about it.", "aware")).toBe(0);
    expect(timesIn("I'm aware of it.", "aware")).toBe(1);
    expect(phraseAt(timed("I'm self-aware about it"), "aware")).toBeNull();
    expect(usesOf(aware, [take("t", "2026-11-17", "Very self-aware, long-term.")])).toEqual([]);
    expect(timesIn("We planned for the long-term.", "term")).toBe(0);
    expect(markIn("A long-term plan, for the term.", "term")).toEqual({ before: "A long-term plan, for the ", match: "term", after: "." });
  });

  it("still finds a hyphened better phrase spelt either way, and whole words only", () => {
    expect(timesIn("It's a well-known rule.", "well-known")).toBe(1);
    expect(timesIn("It's a well known rule.", "well-known")).toBe(1);
    expect(timesIn("The pointer moved.", "the point")).toBe(0);
    expect(timesIn("The point isn't that.", "the point is")).toBe(0);
  });

  it("never runs a phrase across a full stop, so the proof agrees with the count", () => {
    const p = swap({ said: "the thing is", better: "the point is" });
    const text = "That's the point. Is it working?";
    expect(timesIn(text, "the point is")).toBe(0);
    expect(usesOf(p, [take("t", "2026-11-17", text)])).toEqual([]);
    // Whisper's timed words carry no full stop; the text decides.
    const words = timed("That's the point Is it working");
    expect(proofIn([p], {}, { id: "t", transcript: text, words, startedAt: new Date(at("2026-11-18")) })).toBeNull();
    expect(timesIn("Prices rose 1.5 percent, the point is.", "the point is")).toBe(1);
  });
});

describe("only a later stored recording counts", () => {
  it("proves nothing from a take that was not stored, or the take a swap came from", () => {
    const s = swap({ said: "the thing is", better: "the point is", repId: "src" });
    const text = "So the point is we start.";
    const words = timed("So the point is we start");
    const startedAt = new Date(at("2026-11-18"));
    expect(proofIn([s], {}, { id: null, transcript: text, words, startedAt })).toBeNull();
    expect(proofIn([s], {}, { id: "src", transcript: text, words, startedAt })).toBeNull();
    expect(proofIn([s], {}, { id: "stored", transcript: text, words, startedAt })?.key).toBe("c:1");
  });

  it("never counts a recording either row of a merged pair came from", () => {
    // The coach's pair from r1; the same pair saved later from r2's words.
    // r2 is a source, not a later use, even though it says "freezing".
    const coach = coachSwap({ id: "c1", original: "very cold", upgrade: "freezing", created_at: at("2026-11-10"), rep_id: "r1" });
    const word = wordSwap({ id: "w1", word: "very cold", instead: "freezing", sentence: "It was very cold, freezing really.", rep_id: "r2", created_at: at("2026-11-12") });
    const [merged] = mergeSwaps([coach], [word]);
    expect(usesOf(merged, [take("r2", "2026-11-11", "It was very cold, freezing really."), take("r3", "2026-11-13", "Freezing out.")]).map((u) => u.repId)).toEqual(["r3"]);
  });

  it("orders by time, not by how a timestamp is spelt", () => {
    // 11:00 at +01:00 is 10:00 UTC, before a save at 10:00:00.5 UTC.
    const s = swap({ said: "the thing is", better: "the point is", savedAt: "2026-11-16T10:00:00.5+00:00" });
    expect(usesOf(s, [{ id: "t", created_at: "2026-11-16T11:00:00+01:00", transcript: "The point is this." }])).toEqual([]);
    expect(usesOf(s, [{ id: "t", created_at: "2026-11-16T11:00:01+01:00", transcript: "The point is this." }])).toHaveLength(1);
  });

  it("is never moved by the test: an answer leaves the swap unheard", () => {
    const s = swap();
    const said = afterTest(freshState(s), "said", "2026-11-17");
    expect(said.heardAt).toBeNull();
    expect(nowSays({ swap: s, state: said, uses: [] })).toBe(false);
  });
});

describe("three a day, however the day goes", () => {
  const v = (key: string, state: Partial<SwapState>): SwapView => {
    const s = swap({ key, savedAt: at("2026-11-01") });
    return { swap: s, state: { ...freshState(s), due: "2026-11-10", ...state }, uses: [] };
  };

  it("brings no more the same day once three were answered", () => {
    const today = "2026-11-18";
    const tested = ["a", "b", "c"].map((k) => v(k, { testedOn: today, due: "2026-11-21", last: "said" }));
    const waiting = ["d", "e"].map((k) => v(k, {}));
    const lists = sayLists([...tested, ...waiting], today);
    expect(lists.due).toEqual([]);
    expect(nextDue([...tested, ...waiting], today)).toBe("2026-11-19");
    expect(nextTestLine(nextDue([...tested, ...waiting], today)!, today)).toBe("Next test tomorrow");
    // One answered (a miss is back tomorrow): two more today.
    const one = [v("a", { testedOn: today, due: "2026-11-19", last: "missed" }), ...["b", "c", "d"].map((k) => v(k, {}))];
    expect(sayLists(one, today).due).toHaveLength(DUE_A_DAY - 1);
  });

  it("never says the next test is today in words that do not read", () => {
    expect(nextTestLine("2026-11-18", "2026-11-18")).toBe("Next test today");
  });
});

describe("a merged pair keeps its state whichever row is left", () => {
  it("reads the newest state under any of its keys", () => {
    const coach = coachSwap({ id: "c1", original: "very cold", upgrade: "freezing", created_at: at("2026-11-10"), rep_id: "r1" });
    const word = wordSwap({ id: "w1", word: "very cold", instead: "freezing", sentence: null, rep_id: "r1", created_at: at("2026-11-09") });
    const [merged] = mergeSwaps([coach], [word]);
    expect(merged.key).toBe("w:w1");
    const step1: SwapState = { ...freshState(merged), step: 1, due: "2026-11-20", at: "2026-11-15T09:00:00.000Z" };
    const step2: SwapState = { ...freshState(merged), step: 2, due: "2026-11-25", at: "2026-11-18T09:00:00.000Z" };
    // The newer copy wins whichever key holds it.
    expect(stateOf(merged, { "w:w1": step1, "c:c1": step2 }).step).toBe(2);
    // Written under every key (lib/say-store.ts saveSwapState); the coach's row alone still knows it.
    const [coachAlone] = mergeSwaps([coach], []);
    expect(stateOf(coachAlone, { "c:c1": step2 }).step).toBe(2);
  });
});

describe("the proof line never costs Demos's cue", () => {
  it("waits rather than push the cue off, at every budget", () => {
    const p = { fixed: ["665", "/1000", "Every number", "Done for today", "Retake"], line: "4 fillers, first 0:02", cue: "Tomorrow: a pause instead.", earned: null };
    const proof = { full: "the thing is → ✓ the point is 0:14", short: "✓ the point is 0:14" };
    const tight = countWords([...p.fixed, p.line, p.cue, proof.short].join(" "));
    for (let budget = 8; budget <= tight + 6; budget++) {
      const fit = fitGlanceProof(p, budget, proof);
      const without = fitGlanceProof(p, budget, null);
      expect(fit.cue).toBe(without.cue);
      expect(fit.earned).toBe(without.earned);
      expect(fit.words).toBeLessThanOrEqual(Math.max(budget, without.words));
    }
    expect(fitGlanceProof(p, tight - 1, proof).proof).toBeNull();
  });
});

describe("the lines a list taken off reads", () => {
  it("never calls the next one the first to someone who had a list", () => {
    expect(emptyLine(false)).toBe("Your first one comes from today's recording.");
    expect(emptyLine(true)).toBe("Your next one comes from today's recording.");
    for (const l of [emptyLine(false), emptyLine(true), SAY_LIMITED, nextTestLine("2026-11-18", "2026-11-18")]) {
      expect(l).not.toMatch(/—|–/);
      expect(l).not.toMatch(/\b(gym|workout|drill|reps?|training|lexicon)\b/i);
    }
  });
});
