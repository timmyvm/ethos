import { describe, expect, it } from "vitest";
import {
  DUE_A_DAY,
  addDays,
  afterTest,
  backLine,
  chipDay,
  cleanPhrase,
  coachSwap,
  dueToday,
  endLine,
  freshState,
  heardIn,
  markIn,
  mergeSwaps,
  nextDue,
  phraseAt,
  proofIn,
  provedView,
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
import { GLANCE_WORDS, countWords, earnedLine, fitGlance, fitGlanceProof, proofToken, starsBudget } from "./glance";
import { levelUpLine } from "./traits";
import { starGoals } from "./metrics";
import { readFileSync } from "node:fs";

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

  /* The #509 review: the recorder's screen read the swaps once, as it
     opened, and kept that read for every take on it. A Retake, Practice 2
     of 3 or the next lesson that said the same phrase proved it again:
     the token, the round's sound and Demos's cheer on every take. */
  it("says it once on the same screen too: the next take there (Retake, the next practice) never proves the swap again", () => {
    const shownAt = new Date(at("2026-11-18", 21));
    const after = heardIn({}, swaps[0], shownAt);
    expect(proofIn(swaps, after, take)?.key).toBe("c:2");
    // Its place in the test is kept: only when it was heard moves.
    expect(after["c:1"]).toEqual({ ...freshState(swaps[0]), heardAt: shownAt.toISOString(), at: shownAt.toISOString() });
    // A merged swap is heard under every key it stands for, as markHeard keeps it.
    const merged = mergeSwaps(
      [coachSwap({ id: "m1", original: "the thing is", upgrade: "the point is", created_at: at("2026-11-15"), rep_id: null })],
      [wordSwap({ id: "m2", word: "the thing is", instead: "the point is", sentence: null, rep_id: null, created_at: at("2026-11-16") })]
    )[0];
    const both = heardIn({}, merged, shownAt);
    expect(Object.keys(both).sort()).toEqual(["c:m1", "w:m2"]);
    expect(proofIn([merged], both, take)).toBeNull();
    // The screen keeps the mark it shows: the recorder holds the read its next take proves from.
    const page = readFileSync("app/rep/page.tsx", "utf8");
    expect(page).toMatch(/onHeard=\{\(swap\) => setSayData\(\(d\) => \(d \? \{ \.\.\.d, states: heardIn\(d\.states, swap\) \} : d\)\)\}/);
    expect(page.slice(page.indexOf("function Results("))).toMatch(/void markHeard\(sayAtLanding\.states, swap\)[\s\S]{0,80}onHeard\?\.\(swap\)/);
  });

  /* The #509 review: the swaps were read once, as the recorder opened.
     Every take stored with a coach's pair saves that pair (lib/db.ts
     saveRep), so a Retake or Practice 2 of 3 that said the pair it had just
     been given proved nothing, and Today's read then marked it heard: the
     moment the proof exists for, lost for good (probe: coachretake). */
  it("is read again for every take the recorder opens to, so the pair the last take was given can be proved on the next", () => {
    const page = readFileSync("app/rep/page.tsx", "utf8");
    const screen = page.slice(0, page.indexOf("function Results("));
    const read = /const awaitingTake = result === null;\s*useEffect\(\(\) => \{\s*if \(!awaitingTake\) return;[\s\S]{0,120}fetchSwapsForProof\(\)[\s\S]{0,200}\}, \[awaitingTake\]\);/;
    expect(screen).toMatch(read);
    // Read after the result's own state, never before it (a hook reading it earlier would throw).
    expect(screen.indexOf("const awaitingTake")).toBeGreaterThan(screen.indexOf("const [result, setResult]"));
    expect(screen.match(/fetchSwapsForProof\(\)/g)).toHaveLength(1);
  });

  /* The #509 review: the door waited on Say it better's whole read (every
     swap, their state, 200 recordings' text). On mobile data a tap did
     nothing for as long as that took (probe: the read held 15 s, the
     sheet opened 10.9 s after the tap, out of nowhere). */
  it("opens the swap's sheet at once on what this take proved, the page's read taking its place when it lands", () => {
    const shownAt = new Date(at("2026-11-18", 21));
    const v = provedView(swaps[0], {}, { id: "rep-new", transcript: "The point is, the point is clear." }, shownAt);
    expect(v.swap.key).toBe("c:1");
    expect(v.state.heardAt).toBe(shownAt.toISOString());
    expect(v.uses).toEqual([{ repId: "rep-new", createdAt: shownAt.toISOString(), times: 2, at: null }]);
    expect(v.saidOn).toBe(swaps[0].savedAt);
    const page = readFileSync("app/rep/page.tsx", "utf8");
    const results = page.slice(page.indexOf("function Results("));
    expect(results).toMatch(/const sheetItem = swapItem \?\? proved;/);
    expect(results).toMatch(/const swapOpen = swapAsked && sheetItem !== null;/);
    expect(results).toMatch(/<SwapSheet\s+item=\{sheetItem\}/);
  });

  it("hands the glance the pair and where it was said: the token's words, the struck phrase and the better one", () => {
    const p = proofIn(swaps, {}, take)!;
    expect(proofToken(p)).toMatchObject({ key: "c:1", better: "the point is", said: "the thing is", struck: "always" });
    expect(proofToken(p).moment.clock).toBe("0:03");
  });

  it("holds the ceiling in the worst case and never waits: the goals, a two-trait level-up, Demos's cue and the longest pair", () => {
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
    const fit = fitGlanceProof(p, budget, longest);
    expect(fit.words).toBeLessThanOrEqual(budget);
    // Everything at once: #507's line waited here. The token stands, the
    // level-up keeps its place and the glance is word for word the one
    // without it; the longest pair's struck phrase is left to the sheet.
    expect(fit.proof).toMatchObject({ key: "c:9", struck: "never" });
    expect(fit.earned).toMatch(/^Pace/);
    const { proof: _proof, ...rest } = fit;
    expect(rest).toEqual(fitGlance(p, budget));
    const drawn = (f: typeof fit) => countWords([...fixed, f.short ? p.lineShort : p.line, f.cue ?? "", f.earned ?? ""].join(" "));
    expect(drawn(fit)).toBe(fit.words);
    // One level crossed, no cue to carry and a common pair: the token whole.
    const common = { key: "c:1", said: "the thing is", better: "the point is", at: 14, end: 15 };
    const oneUp = levelUpLine([{ key: "pace", from: 2, to: 3, paid: 93 }], () => "Pace")!;
    const lighter = { ...p, cue: null, cueShort: null, lineShort: null, line: "4 fillers.", earned: earnedLine({ bests: [], levelUp: oneUp, trait: "fillers" }) };
    const fit2 = fitGlanceProof(lighter, budget, common);
    expect(fit2.proof).toMatchObject({ said: "the thing is", struck: "always" });
    expect(fit2.words).toBe(fitGlance(lighter, budget).words);
  });

  it("never costs the cue, at any budget, and shows at every one", () => {
    const p = { fixed: ["665", "/1000", "Every number", "Done for today", "Retake"], line: "4 fillers, first 0:02", cue: "Tomorrow: a pause instead.", earned: null };
    const pair = { key: "c:1", said: "the thing is", better: "the point is", at: 14, end: 15 };
    for (let budget = 6; budget <= 30; budget++) {
      const f = fitGlanceProof(p, budget, pair);
      expect(f.cue).toBe(fitGlance(p, budget).cue);
      expect(f.words).toBe(fitGlance(p, budget).words);
      expect(f.proof).not.toBeNull();
    }
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

describe("a long better phrase from before #429 (18 Nov)", () => {
  it("is still a phrase the test can check: production holds one of 71 characters", () => {
    const better = "make the most of every chance you get to speak in front of other people";
    expect(better.length).toBeGreaterThan(60);
    expect(cleanPhrase(better)).toBe(better);
    expect(cleanPhrase("x ".repeat(80))).toBeNull();
  });
});

