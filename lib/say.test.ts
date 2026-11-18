import { describe, expect, it } from "vitest";
import {
  DUE_A_DAY,
  addDays,
  afterTest,
  backLine,
  chipDay,
  coachSwap,
  dueToday,
  endLine,
  freshState,
  markIn,
  mergeSwaps,
  nextDue,
  phraseAt,
  proofIn,
  proofWords,
  saidBetter,
  saidOn,
  sayLists,
  timesIn,
  timesLine,
  timesUsed,
  usesOf,
  wordSwap,
  type Swap,
  type SwapState,
  type SwapView,
  type TakeText,
} from "./say";
import { GLANCE_WORDS, countWords, earnedLine, fitGlanceProof, starsBudget } from "./glance";
import { levelUpLine } from "./traits";
import { starGoals } from "./metrics";

const at = (day: string, hour = 18) => new Date(`${day}T${String(hour).padStart(2, "0")}:12:00`).toISOString();

const swap = (over: Partial<Swap> = {}): Swap => ({
  key: "c:1",
  source: "coach",
  id: "1",
  said: "the thing is",
  better: "the point is",
  sentence: "So the thing is, habits compound when nobody's watching.",
  repId: "rep-src",
  savedAt: at("2026-11-16"),
  ...over,
});

/** Whisper's timed words for a sentence, one every 0.4s from `from`. */
const timed = (text: string, from = 0) =>
  text.split(/\s+/).map((word, i) => ({ word, start: from + i * 0.4, end: from + i * 0.4 + 0.3 }));

describe("the spacing: 1, 3, 7, then 14 days; a miss is back tomorrow", () => {
  it("is first due the day after it was saved", () => {
    expect(freshState(swap()).due).toBe("2026-11-17");
    expect(freshState(swap()).step).toBe(0);
  });

  it("walks 1, 3, 7, 14 and stays at 14 on every said", () => {
    let s: SwapState = freshState(swap());
    let day = s.due;
    const gaps: number[] = [];
    for (let i = 0; i < 6; i++) {
      const next = afterTest(s, "said", day, new Date(at(day)));
      const [y1, m1, d1] = day.split("-").map(Number);
      const [y2, m2, d2] = next.due.split("-").map(Number);
      gaps.push(Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000));
      s = next;
      day = next.due;
    }
    expect(gaps).toEqual([3, 7, 14, 14, 14, 14]);
    expect(s.last).toBe("said");
  });

  it("brings a miss back tomorrow and starts its gaps again", () => {
    const deep: SwapState = { ...freshState(swap()), step: 3, due: "2026-11-30" };
    const missed = afterTest(deep, "missed", "2026-11-30");
    expect(missed).toMatchObject({ step: 0, due: "2026-12-01", last: "missed", testedOn: "2026-11-30" });
    // The next said after a miss is three days, as after a first said.
    expect(afterTest(missed, "said", "2026-12-01").due).toBe("2026-12-04");
  });

  it("brings a shown answer back tomorrow without losing its place", () => {
    const s: SwapState = { ...freshState(swap()), step: 2 };
    expect(afterTest(s, "shown", "2026-11-20")).toMatchObject({ step: 2, due: "2026-11-21", last: "shown" });
  });

  it("tests three a day at most, the longest waiting first, never one you now say", () => {
    const v = (key: string, due: string, savedAt: string, uses = 0): SwapView => ({
      swap: swap({ key, savedAt }),
      state: { ...freshState(swap({ savedAt })), due },
      uses: Array.from({ length: uses }, (_, i) => ({ repId: `r${i}`, createdAt: at("2026-11-17"), times: 1, at: 1 })),
    });
    const views = [
      v("a", "2026-11-18", at("2026-11-10")),
      v("b", "2026-11-12", at("2026-11-11")),
      v("c", "2026-11-18", at("2026-11-09")),
      v("d", "2026-11-15", at("2026-11-08"), 2),
      v("e", "2026-11-17", at("2026-11-12")),
      v("f", "2026-11-19", at("2026-11-13")),
    ];
    const due = dueToday(views, "2026-11-18");
    expect(due).toHaveLength(DUE_A_DAY);
    expect(due.map((d) => d.swap.key)).toEqual(["b", "e", "c"]);
    expect(nextDue(views.filter((x) => x.swap.key === "f"), "2026-11-18")).toBe("2026-11-19");
  });

  it("never tests a swap taken off the list, and drops it from the count", () => {
    const hidden: SwapView = { swap: swap({ key: "h" }), state: { ...freshState(swap()), due: "2026-11-01", hidden: true }, uses: [] };
    const kept: SwapView = { swap: swap({ key: "k" }), state: { ...freshState(swap()), due: "2026-11-01" }, uses: [] };
    const lists = sayLists([hidden, kept], "2026-11-18");
    expect(lists.due.map((d) => d.swap.key)).toEqual(["k"]);
    expect(lists.m).toBe(1);
  });

  it("splits the page into today's test, you now say and learning", () => {
    const now: SwapView = { swap: swap({ key: "n" }), state: freshState(swap()), uses: [{ repId: "r", createdAt: at("2026-11-17"), times: 6, at: 3 }] };
    const learning: SwapView = { swap: swap({ key: "l" }), state: { ...freshState(swap()), due: "2026-11-21" }, uses: [] };
    const due: SwapView = { swap: swap({ key: "d" }), state: { ...freshState(swap()), due: "2026-11-18" }, uses: [] };
    const lists = sayLists([now, learning, due], "2026-11-18");
    expect(lists.due.map((d) => d.swap.key)).toEqual(["d"]);
    expect(lists.nowSay.map((d) => d.swap.key)).toEqual(["n"]);
    expect(lists.learning.map((d) => d.swap.key)).toEqual(["l"]);
    expect([lists.n, lists.m]).toEqual([1, 3]);
  });
});

describe("you now say: only a later real recording counts", () => {
  const s = swap();
  const take = (id: string, day: string, transcript: string, words?: TakeText["words"]): TakeText => ({ id, created_at: at(day), transcript, words });

  it("counts a recording stored after the swap was saved that says the better phrase", () => {
    const uses = usesOf(s, [take("r1", "2026-11-17", "Look, the point is we ship. And the point is it works.")]);
    expect(uses).toEqual([{ repId: "r1", createdAt: at("2026-11-17"), times: 2, at: null }]);
    expect(timesUsed(uses)).toBe(2);
  });

  it("never counts the recording the swap came from, or one before it was saved", () => {
    expect(usesOf(s, [take("rep-src", "2026-11-17", "the point is")])).toEqual([]);
    expect(usesOf(s, [take("r0", "2026-11-15", "the point is")])).toEqual([]);
    expect(usesOf(s, [{ id: "r0", created_at: s.savedAt, transcript: "the point is" }])).toEqual([]);
  });

  it("never counts the test's one-liners, which are never stored: only stored takes are read", () => {
    // The test's take is answered by /api/say and kept nowhere, so the
    // count's only input is the reps table. A recording that is not
    // passed in cannot count, however clearly it said the phrase.
    expect(usesOf(s, [])).toEqual([]);
  });

  it("needs whole words: 'the pointy island' is not 'the point'", () => {
    const short = swap({ better: "the point" });
    expect(usesOf(short, [take("r1", "2026-11-17", "We sailed to the pointy island.")])).toEqual([]);
    expect(timesIn("The POINT is, it works.", "the point is")).toBe(1);
    expect(timesIn("I don’t know. Dont know.", "dont know")).toBe(2);
  });

  it("never matches across a full stop", () => {
    expect(timesIn("That was the point. Is it?", "the point is")).toBe(0);
  });

  it("takes the moment from Whisper's timed words, and drops a take whose words do not hold it", () => {
    const words = timed("so the point is we ship", 10);
    expect(usesOf(s, [take("r1", "2026-11-17", "So the point is we ship.", words)])[0].at).toBeCloseTo(10.4);
    expect(usesOf(s, [take("r2", "2026-11-17", "So the point is we ship.", timed("so we ship"))])).toEqual([]);
  });

  it("keeps counting a swap once heard, when that recording is past the newest the page reads", () => {
    const heard: SwapView = { swap: swap({ key: "h" }), state: { ...freshState(swap()), heardAt: at("2026-10-01") }, uses: [] };
    const fresh: SwapView = { swap: swap({ key: "f" }), state: freshState(swap()), uses: [] };
    expect(sayLists([heard, fresh], "2026-11-18")).toMatchObject({ n: 1, m: 2 });
    expect(dueToday([heard], "2026-11-18")).toEqual([]);
  });

  it("lists the newest recording first", () => {
    const uses = usesOf(s, [take("old", "2026-11-17", "the point is"), take("new", "2026-11-18", "the point is")]);
    expect(uses.map((u) => u.repId)).toEqual(["new", "old"]);
  });
});

describe("finding a phrase", () => {
  it("finds a phrase across Whisper's words, punctuation and case aside", () => {
    expect(phraseAt([{ word: " So", start: 1, end: 1.2 }, { word: "the", start: 1.3, end: 1.4 }, { word: "Point", start: 1.5, end: 1.7 }, { word: "is,", start: 1.8, end: 1.9 }], "the point is")).toEqual({ start: 1.3, end: 1.9 });
    expect(phraseAt(timed("the pointy is"), "the point is")).toBeNull();
    expect(phraseAt(null, "x")).toBeNull();
  });

  it("marks where the weak phrase stood, and says the sentence better", () => {
    expect(markIn("So the thing is, habits compound.", "the thing is")).toEqual({ before: "So ", match: "the thing is", after: ", habits compound." });
    expect(saidBetter("The thing is, it works.", "the thing is", "the point is")).toEqual({ before: "", match: "The point is", after: ", it works." });
    expect(saidBetter("It works.", "the thing is", "the point is")).toBeNull();
  });
});

describe("one list from the coach and the word sheet", () => {
  it("merges a pair saved both ways into the first saved, its sentence and recording from one row", () => {
    const coach = coachSwap({ id: "c1", original: "very cold", upgrade: "freezing", created_at: at("2026-11-10"), rep_id: "r1" });
    const word = wordSwap({ id: "w1", word: "Very cold", instead: "freezing", sentence: "It was very cold.", rep_id: null, created_at: at("2026-11-12") });
    const other = wordSwap({ id: "w2", word: "got", instead: "landed", sentence: null, rep_id: null, created_at: at("2026-11-14") });
    const merged = mergeSwaps([coach], [word, other]);
    expect(merged.map((s) => s.key)).toEqual(["w:w2", "c:c1"]);
    // The word save's sentence may come from any recording: the coach's
    // recording is the one with a moment, so its own sentence is read
    // from it (lib/say-store.ts), never the other row's beside it.
    expect(merged[1]).toMatchObject({ sentence: null, repId: "r1" });
    expect(merged[1].rows?.map((s) => s.key)).toEqual(["c:c1", "w:w1"]);
    // A save from the same recording lends its sentence.
    const sameRep = wordSwap({ id: "w3", word: "very cold", instead: "freezing", sentence: "It was very cold.", rep_id: "r1", created_at: at("2026-11-12") });
    expect(mergeSwaps([coach], [sameRep])[0]).toMatchObject({ key: "c:c1", sentence: "It was very cold.", repId: "r1" });
  });
});

describe("the glance's proof line", () => {
  const swaps = [
    swap({ key: "c:1", said: "the thing is", better: "the point is", savedAt: at("2026-11-16") }),
    swap({ key: "c:2", said: "a week nobody could really do", better: "an impossible week", savedAt: at("2026-11-16") }),
    swap({ key: "c:3", said: "kind of like", better: "for example", savedAt: at("2026-11-18", 23) }),
  ];
  const text = "For example, the point is we planned an impossible week.";
  const words = timed("for example the point is we planned an impossible week", 3);
  const started = new Date(at("2026-11-18", 20));
  const take = { id: "rep-new", transcript: text, words, startedAt: started };

  it("names the earliest saved swap the take said, saved before the take began", () => {
    const p = proofIn(swaps, {}, take);
    // "for example" was saved after this take began: it cannot be proof.
    expect(p).toMatchObject({ key: "c:1", better: "the point is" });
    expect(p!.at).toBeCloseTo(3.8);
  });

  it("says it once: a swap already heard, or taken off the list, is passed over", () => {
    const heard = { "c:1": { ...freshState(swaps[0]), heardAt: at("2026-11-17") } };
    expect(proofIn(swaps, heard, take)?.key).toBe("c:2");
    const hidden = { "c:1": { ...freshState(swaps[0]), hidden: true }, "c:2": { ...freshState(swaps[1]), hidden: true } };
    expect(proofIn(swaps, hidden, take)).toBeNull();
  });

  it("counts its words as the ceiling does: the struck phrase, then the better one and its time", () => {
    const p = proofIn(swaps, {}, take)!;
    expect(proofWords(p, "full")).toBe("the thing is → ✓ the point is 0:03");
    expect(countWords(proofWords(p, "full"))).toBe(7);
    expect(countWords(proofWords(p, "short"))).toBe(4);
  });

  it("holds the ceiling in the worst case: the goals, a two-trait level-up, Demos's cue and the longest pair", () => {
    // The longest pair #429 lets through: eight words said, six better.
    const longest = { key: "c:9", said: "a week that no person could actually do", better: "a week nobody could survive at all", at: 61, end: 63 };
    const levelUp = levelUpLine(
      [
        { key: "pace", from: 2, to: 3, paid: 93 },
        { key: "pause", from: 1, to: 2, paid: 72 },
      ],
      (k) => (k === "pace" ? "Pace" : "Pausing")
    )!;
    const goals = starGoals(62);
    const fixed = ["Today's practice", "665", "/1000", "▲ 3 since last time", "Every number", "Done for today", "Retake", ...goals];
    const p = {
      fixed,
      line: "“um” 2 times, first 0:02",
      cue: "Tomorrow: a pause instead.",
      earned: earnedLine({ bests: [], levelUp, trait: "fillers" }),
      lineShort: "“um” 2 times.",
      cueShort: "A pause instead.",
    };
    const budget = starsBudget(GLANCE_WORDS, goals);
    const fit = fitGlanceProof(p, budget, { full: proofWords(longest, "full"), short: proofWords(longest, "short") });
    expect(fit.words).toBeLessThanOrEqual(budget);
    // Everything at once leaves no room for even the short line: the
    // level-up, said only here, keeps its place and the proof waits (the
    // page still counts the recording, and the next take can say it).
    expect(fit.proof).toBeNull();
    expect(fit.earned).toMatch(/^Pace/);
    const drawn = (f: typeof fit, proof: string) =>
      countWords([...fixed, f.short ? p.lineShort : p.line, f.cue ?? "", f.earned ?? "", proof].join(" "));
    expect(drawn(fit, "")).toBe(fit.words);
    // One level crossed, no cue to carry and a common pair: the struck
    // phrase goes first and the short proof stands, inside the ceiling.
    const common = { key: "c:1", said: "the thing is", better: "the point is", at: 14, end: 15 };
    const oneUp = levelUpLine([{ key: "pace", from: 2, to: 3, paid: 93 }], () => "Pace")!;
    const lighter = { ...p, cue: null, cueShort: null, lineShort: null, line: "4 fillers.", earned: earnedLine({ bests: [], levelUp: oneUp, trait: "fillers" }) };
    const fit2 = fitGlanceProof(lighter, budget, { full: proofWords(common, "full"), short: proofWords(common, "short") });
    expect(fit2.proof).toBe("short");
    expect(fit2.words).toBeLessThanOrEqual(budget);
    expect(countWords([...fixed, lighter.line, fit2.earned ?? "", proofWords(common, "short")].join(" "))).toBe(fit2.words);
  });

  it("keeps the struck phrase where it costs nothing, and drops it before the cue", () => {
    const p = { fixed: ["665", "/1000", "Every number", "Done for today", "Retake"], line: "4 fillers, first 0:02", cue: "Tomorrow: a pause instead.", earned: null };
    const proof = { full: "the thing is → ✓ the point is 0:14", short: "✓ the point is 0:14" };
    expect(fitGlanceProof(p, GLANCE_WORDS, proof)).toMatchObject({ proof: "full", cue: "Tomorrow: a pause instead." });
    // Tight: the full line would cost the cue, so the struck phrase goes and the cue stays.
    const tight = countWords([...p.fixed, p.line, p.cue, proof.short].join(" "));
    expect(fitGlanceProof(p, tight, proof)).toMatchObject({ proof: "short", cue: "Tomorrow: a pause instead.", words: tight });
    // Tighter still: the proof waits rather than pass the ceiling.
    expect(fitGlanceProof(p, 8, proof).proof).toBeNull();
    expect(fitGlanceProof(p, GLANCE_WORDS, null).proof).toBeNull();
  });
});

describe("the words on the page", () => {
  it("says when a swap is back, and how often it was said", () => {
    expect(backLine("2026-11-19", "2026-11-18")).toBe("Back tomorrow");
    expect(backLine("2026-11-20", "2026-11-18")).toBe("Back Fri");
    expect(backLine("2026-12-02", "2026-11-18")).toBe("Back 2 Dec");
    expect(timesLine(1)).toBe("1 time");
    expect(timesLine(6)).toBe("6 times");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });

  it("dates the sentence and each later recording", () => {
    const now = new Date(at("2026-11-18"));
    expect(saidOn(at("2026-11-16"), now)).toBe("Monday");
    expect(saidOn(at("2026-11-17"), now)).toBe("yesterday");
    expect(saidOn(at("2026-11-02"), now)).toBe("2 Nov");
    expect(chipDay(at("2026-11-16"), now)).toBe("Mon");
  });

  it("ends the test on what was said out loud", () => {
    expect(endLine(3, 3)).toBe("You said all three out loud.");
    expect(endLine(2, 2)).toBe("You said both out loud.");
    expect(endLine(1, 1)).toBe("You said it out loud.");
    expect(endLine(2, 3)).toBe("You said 2 of 3 out loud.");
    expect(endLine(0, 3)).toBe("They're back tomorrow.");
  });

  it("holds no banned word and no dash", () => {
    const lines = [backLine("2026-11-20", "2026-11-18"), timesLine(6), endLine(3, 3), endLine(2, 3), endLine(0, 3)];
    for (const l of lines) {
      expect(l).not.toMatch(/—|–/);
      expect(l).not.toMatch(/\b(gym|workout|drill|reps?|training|lexicon)\b/i);
    }
  });
});
