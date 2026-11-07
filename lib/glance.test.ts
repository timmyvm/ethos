import { describe, expect, it } from "vitest";
import type { TraitId } from "@/content/traits";
import {
  clock,
  countWords,
  cueLead,
  earnedLine,
  fitGlance,
  GLANCE_WORDS,
  glanceLine,
  glanceTrait,
  ladderLine,
  sheetSections,
  unscoredReason,
  type GlanceLine,
} from "./glance";
import { computeMetrics, substance, type RepMetrics, type Word } from "./metrics";
import { heldPauseMarks } from "./pause-mark";
import { endNote, type RewardMoment } from "./rewards";
import type { StreakState } from "./streak";

/*
 * The look fixture's live take (scripts/look-fixtures.mjs), rebuilt here:
 * 62 seconds, four fillers (the first "um" at 0:02), four held pauses,
 * the opening and a landing judged, one mid-sentence pause at 0:20 and
 * one before a sentence with no verdict, 145 words a minute, one restart.
 */
const TRANSCRIPT =
  "So the thing about habits is, um, they compound. You do the small version every day and, like, it builds on its own. Um, the mistake people make is waiting to feel ready. You know, ready is a feeling that shows up after you start. I used to think discipline was the whole answer, and I would plan a week nobody could really do, then miss a day and quit the plan instead of the day. What changed was making the habit small enough that missing it felt stupid. Five minutes. Not an hour, just five minutes I can do standing in a kitchen. And the five minutes usually turns into more, but only because it was allowed to be five.";
const WORDS: Word[] = (() => {
  const raw = TRANSCRIPT.match(/[A-Za-z0-9']+/g) ?? [];
  const spaced = TRANSCRIPT.split(/\s+/);
  let t = 0.4;
  return raw.map((word, i) => {
    const w = { word, start: Math.round(t * 100) / 100, end: Math.round((t + 0.3) * 100) / 100 };
    t += 0.38 + (/[.?!]/.test(spaced[i] ?? "") ? 0.9 : 0);
    return w;
  });
})();
const FILLERS = (() => {
  const out: { word: string; t: number }[] = [];
  const w = WORDS.map((x) => x.word.toLowerCase());
  for (let i = 0; i < w.length; i++) {
    if (w[i] === "you" && w[i + 1] === "know") out.push({ word: "you know", t: WORDS[i++].start });
    else if (w[i] === "um" || (w[i] === "like" && w[i + 1] === "it")) out.push({ word: w[i], t: WORDS[i].start });
  }
  return out;
})();
const PAUSES = [
  { t: 2.1, len: 1.2, kind: "pre", verdict: "opening" },
  { t: 20, len: 0.9, kind: "mid" },
  { t: 41, len: 1.5, kind: "pre", verdict: "landing" },
  { t: 58, len: 1.1, kind: "pre" },
] as unknown as RepMetrics["pauses"];

const take = (over: Partial<RepMetrics> = {}): RepMetrics => ({
  ...computeMetrics([], 62),
  durationS: 62,
  wordCount: WORDS.length,
  wpm: 145,
  fillerCount: FILLERS.length,
  fillersPerMin: 3.9,
  fillers: FILLERS,
  topFiller: "um",
  repairCount: 1,
  pauses: PAUSES,
  heldPauses: 4,
  composedPauses: 3,
  midSentencePauses: 1,
  stars: 2,
  substance: { wordCount: WORDS.length, distinctRatio: 0.62, repeatShare: 0.05 },
  ...over,
});
const line = (trait: TraitId, over: Partial<RepMetrics> = {}, extra: Partial<Parameters<typeof glanceLine>[0]> = {}): GlanceLine =>
  glanceLine({ trait, metrics: take(over), words: WORDS, transcript: TRANSCRIPT, lead: "Next time:", ...extra });

const streak = (over: Partial<StreakState> = {}): StreakState => ({
  current: 0,
  longest: 0,
  atRisk: false,
  didToday: false,
  frozenInRun: 0,
  ...over,
});

describe("the fixture's two glances", () => {
  it("a lesson practice on Fillers: the count, the first one playing, and practice 2's target", () => {
    const g = glanceLine({
      trait: "fillers",
      metrics: take(),
      words: WORDS,
      transcript: TRANSCRIPT,
      lead: cueLead({ lesson: { practice: 1, of: 3 } }),
    });
    expect(g.sentence).toBe("4 fillers, first at 0:02.");
    expect(g.moment?.t).toBe(FILLERS[0].t);
    expect(g.moment?.label).toBe("Play 0:02, the first filler");
    expect(g.cue).toBe("Practice 2: under 4.");
    expect(g.parts).toEqual([{ kind: "text", text: "4 fillers, first at " }, { kind: "moment" }, { kind: "text", text: "." }]);
  });

  it("a daily take on Pausing: landed and searching, the searching one playing", () => {
    const g = line("pause");
    expect(g.sentence).toBe("3 landed, 1 searching at 0:20.");
    expect(g.cue).toBe("Next time: land 4.");
    expect(g.moment).toMatchObject({ t: 20, from: 19, until: 21.9, label: "Play 0:20, a searching pause" });
  });
});

describe("glanceLine, every row of the tables", () => {
  it("Fillers: two or more, one, none", () => {
    expect(line("fillers").sentence).toBe("4 fillers, first at 0:02.");
    const one = line("fillers", { fillerCount: 1, fillers: [{ word: "um", t: 31.2 }] });
    expect([one.sentence, one.cue, one.moment?.label]).toEqual(["1 filler, at 0:31.", "Next time: none.", "Play 0:31, the filler"]);
    const none = line("fillers", { fillerCount: 0, fillers: [] });
    expect([none.sentence, none.cue, none.moment]).toEqual(["No fillers in 62s.", "Next time: none again.", null]);
  });

  it("Fillers, capped: the hero has the count, so the line says where", () => {
    const g = line("fillers", {}, { capped: true, lead: "Practice 2:" });
    expect([g.sentence, g.cue]).toEqual(["The first at 0:02.", "Practice 2: under 4."]);
    const one = line("fillers", { fillerCount: 1, fillers: [{ word: "um", t: 31.2 }] }, { capped: true });
    expect(one.sentence).toBe("At 0:31.");
    const none = line("fillers", { fillerCount: 0, fillers: [] }, { capped: true });
    expect([none.sentence, none.cue]).toEqual(["No fillers in 62s.", null]);
  });

  it("Fillers counted with no times kept: the count and no chip", () => {
    const g = line("fillers", { fillers: [] });
    expect([g.sentence, g.moment, g.cue]).toEqual(["4 fillers in 62s.", null, "Next time: under 4."]);
  });

  it("Pausing: filled, searching, all landed, none held", () => {
    const filled1 = line("pause", {
      pauses: [...PAUSES, { t: 15, len: 1, kind: "pre", verdict: "filled" }] as unknown as RepMetrics["pauses"],
    });
    expect([filled1.sentence, filled1.cue, filled1.moment?.label]).toEqual([
      "0:15 had a sound in it.",
      "Next time: none with a sound.",
      "Play 0:15, a pause with a sound in it",
    ]);
    expect(filled1.parts[0]).toEqual({ kind: "moment" });
    const filled2 = line("pause", {
      pauses: [
        { t: 15, len: 1, kind: "pre", verdict: "filled" },
        { t: 33, len: 1, kind: "mid", verdict: "filled" },
      ] as unknown as RepMetrics["pauses"],
    });
    expect(filled2.sentence).toBe("2 pauses had a sound, first 0:15.");
    const two = line("pause", {
      pauses: [...PAUSES, { t: 30, len: 1, kind: "mid", verdict: "hesitation" }] as unknown as RepMetrics["pauses"],
    });
    expect([two.sentence, two.cue]).toEqual(["3 landed, 2 searching, first 0:20.", "Next time: land 5."]);
    const all = line("pause", {
      pauses: [
        { t: 2.1, len: 1.2, kind: "pre", verdict: "opening" },
        { t: 41, len: 1.5, kind: "pre", verdict: "landing" },
        { t: 58, len: 1.1, kind: "pre", verdict: "landing" },
      ] as unknown as RepMetrics["pauses"],
    });
    expect([all.sentence, all.cue, all.moment?.t, all.moment?.label]).toEqual([
      "All 3 landed, longest at 0:41.",
      "Next time: land 4.",
      41,
      "Play 0:41, the longest landed pause",
    ]);
    const oneLanded = line("pause", { pauses: [{ t: 41, len: 1.5, kind: "pre", verdict: "landing" }] as unknown as RepMetrics["pauses"] });
    expect(oneLanded.sentence).toBe("1 landed, at 0:41.");
    const none = line("pause", { pauses: [{ t: 9, len: 0.4, kind: "beat", verdict: "beat" }] as unknown as RepMetrics["pauses"] });
    expect([none.sentence, none.cue, none.moment]).toEqual(["No held pauses in 62s.", "Next time: hold 1 after a point.", null]);
    const noneLanded = line("pause", { pauses: [{ t: 20, len: 0.9, kind: "mid", verdict: "hesitation" }] as unknown as RepMetrics["pauses"] });
    expect(noneLanded.sentence).toBe("None landed, 1 searching at 0:20.");
  });

  it("a pause before a sentence judged dead is searching, never landed", () => {
    const g = line("pause", {
      pauses: [{ t: 41, len: 1.5, kind: "pre", verdict: "landing" }, { t: 50, len: 3.9, kind: "pre", verdict: "dead" }] as unknown as RepMetrics["pauses"],
    });
    expect(g.sentence).toBe("1 landed, 1 searching at 0:50.");
  });

  it("Restarts: two or more, one, none, with no chip this pass", () => {
    expect([line("repairs", { repairCount: 3 }).sentence, line("repairs", { repairCount: 3 }).cue]).toEqual(["3 restarts in 62s.", "Next time: under 3."]);
    expect([line("repairs").sentence, line("repairs").cue]).toEqual(["1 restart in 62s.", "Next time: none."]);
    expect([line("repairs", { repairCount: 0 }).sentence, line("repairs", { repairCount: 0 }).cue]).toEqual(["No restarts in 62s.", "Next time: none again."]);
    expect(line("repairs", { repairCount: 3 }).moment).toBeNull();
  });

  it("Pace: in the zone, over, under", () => {
    expect([line("pace").sentence, line("pace").cue]).toEqual(["145 words a minute, in the zone.", "Next time: 130 to 160 again."]);
    expect([line("pace", { wpm: 172 }).sentence, line("pace", { wpm: 172 }).cue]).toEqual(["172 words a minute.", "Next time: under 160."]);
    expect([line("pace", { wpm: 112 }).sentence, line("pace", { wpm: 112 }).cue]).toEqual(["112 words a minute.", "Next time: over 130."]);
  });

  it("Variety: the word said most, else a vague word, else none (no cue)", () => {
    const said = "The habit is a habit. A habit I keep, my habits.";
    const words = (said.match(/[A-Za-z0-9']+/g) ?? []).map((word, i) => ({ word, start: 1 + i * 0.5, end: 1.3 + i * 0.5 }));
    const rep = glanceLine({ trait: "range", metrics: take({ fillers: [] }), words, transcript: said, lead: "Next time:" });
    expect([rep.sentence, rep.cue, rep.moment?.label]).toEqual(["“habit” 4 times, first 0:01.", "Next time: “habit” once.", "Play 0:01, “habit”"]);
    const vagueText = "I did some stuff after work and it was fine overall today.";
    const vw = (vagueText.match(/[A-Za-z0-9']+/g) ?? []).map((word, i) => ({ word, start: 2 + i * 0.5, end: 2.3 + i * 0.5 }));
    const vague = glanceLine({ trait: "range", metrics: take({ fillers: [] }), words: vw, transcript: vagueText, lead: "Next time:" });
    expect([vague.sentence, vague.cue]).toEqual(["“stuff” at 0:03 was vague.", "Next time: name it instead."]);
    const plainText = "Every morning I walk along the river before work starts.";
    const none = glanceLine({ trait: "range", metrics: take({ fillers: [] }), words: null, transcript: plainText, lead: "Next time:" });
    expect([none.sentence, none.cue, none.moment]).toEqual(["No word said 3 times.", null, null]);
  });

  it("an unscored take says why, with no cue and no chip", () => {
    const short = line("fillers", { substance: substance("So the thing about habits is um they compound you do it") }, { scorable: false });
    expect([short.sentence, short.cue, short.moment]).toEqual(["12 words. Give it 60 to 90 seconds.", null, null]);
    expect(unscoredReason({ substance: { wordCount: 1, distinctRatio: 1, repeatShare: 0 } })).toBe("1 word. Give it 60 to 90 seconds.");
    expect(unscoredReason({ substance: { wordCount: 40, distinctRatio: 0.2, repeatShare: 0.6 } })).toBe("That was mostly repeats. Try a real answer.");
  });

  it("a game says the ladder's first sentence and no cue", () => {
    expect(ladderLine("1 of 2 counted. One more on another day opens level 3.")).toBe("1 of 2 counted.");
    expect(ladderLine("0 of 2 counted. Two on two different days open level 2.")).toBe("0 of 2 counted.");
    expect(cueLead({ game: true })).toBeNull();
    expect(line("fillers", {}, { lead: null }).cue).toBeNull();
  });
});

describe("every number Demos says traces to the take", () => {
  const cases: [TraitId, Partial<RepMetrics>][] = [
    ["fillers", {}],
    ["fillers", { fillerCount: 1, fillers: [{ word: "um", t: 31.2 }] }],
    ["fillers", { fillerCount: 0, fillers: [] }],
    ["pause", {}],
    ["pause", { pauses: [{ t: 15, len: 1, kind: "pre", verdict: "filled" }] as unknown as RepMetrics["pauses"] }],
    ["pause", { pauses: [] }],
    ["repairs", { repairCount: 3 }],
    ["pace", { wpm: 172 }],
    ["pace", {}],
    ["range", {}],
  ];
  for (const [trait, over] of cases) {
    it(`${trait} ${JSON.stringify(over).slice(0, 40)}`, () => {
      const m = take(over);
      const g = line(trait, over, { lead: "Practice 2:" });
      const marks = heldPauseMarks(m.pauses);
      const fields = new Set(
        [
          m.fillerCount,
          Math.round(m.durationS),
          m.wpm,
          marks.landed,
          marks.searching,
          marks.held,
          marks.landed + 1,
          m.repairCount,
          m.pauses.filter((p) => (p as { verdict?: string }).verdict === "filled").length,
          ...(trait === "pace" ? [130, 160] : []),
          ...(trait === "range" ? [3, 4] : []),
          2, // "Practice 2:", the next practice's number
          1,
        ].map(String)
      );
      const clocks = new Set([...m.fillers.map((f) => f.t), ...m.pauses.map((p) => p.t), ...WORDS.map((w) => w.start)].map(clock));
      const text = `${g.sentence} ${g.cue ?? ""}`;
      for (const run of text.match(/\d+(?::\d+)?/g) ?? []) {
        expect(fields.has(run) || clocks.has(run), `${run} in "${text}"`).toBe(true);
      }
      if (g.moment) {
        const times = [...m.fillers.map((f) => f.t), ...m.pauses.map((p) => p.t), ...WORDS.map((w) => w.start)];
        expect(times).toContain(g.moment.t);
        expect(g.moment.from).toBeGreaterThanOrEqual(0);
        expect(g.moment.until).toBeGreaterThan(g.moment.from);
        expect(g.parts.filter((p) => p.kind === "moment")).toHaveLength(1);
      } else {
        expect(g.parts.some((p) => p.kind === "moment")).toBe(false);
      }
    });
  }

  it("the landed count is heldPauseMarks' and the closing note's", () => {
    const m = take();
    expect(heldPauseMarks(m.pauses).landed).toBe(3);
    expect(line("pause").sentence.startsWith("3 landed")).toBe(true);
    expect(endNote({ gains: [], metrics: m, streak: streak(), repCount: 4 }).headline).toBe("3 landed pauses");
    /* A pause before a sentence judged dead counts in neither. */
    const dead = take({
      pauses: [...PAUSES, { t: 50, len: 3.9, kind: "pre", verdict: "dead" }] as unknown as RepMetrics["pauses"],
    });
    expect(heldPauseMarks(dead.pauses).landed).toBe(3);
    expect(endNote({ gains: [], metrics: dead, streak: streak(), repCount: 4 }).headline).toBe("3 landed pauses");
  });

  it("a chip window never starts before the take", () => {
    const early = line("fillers", { fillers: [{ word: "um", t: 0.3 }], fillerCount: 1 });
    expect(early.moment).toMatchObject({ from: 0, until: 1.8 });
  });
});

describe("countWords, as the camera counts", () => {
  it("counts a token with a letter or a digit", () => {
    expect(countWords("▲ 3")).toBe(1);
    expect(countWords("0:02.")).toBe(1);
    expect(countWords("“thing”")).toBe(1);
    expect(countWords("/1000")).toBe(1);
    expect(countWords("665 /1000")).toBe(2);
    expect(countWords("  The whole   recording ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});

describe("fitGlance, the budget", () => {
  const fixed = ["The cold open", "+1", "665", "/1000", "▲ 3", "The whole recording", "Practice 2 of 3", "Retake"];
  it("keeps everything under the budget", () => {
    const f = fitGlance({ fixed, line: "4 fillers, first at 0:02.", cue: "Practice 2: under 4.", earned: null });
    expect(f).toEqual({ cue: "Practice 2: under 4.", earned: null, words: 24 });
  });
  it("over it, the cue goes first, then the earned line's tail", () => {
    const best = earnedLine({ bests: [{ headline: "Best Ethos yet", detail: "849, past your 690", tone: "earned" }], trait: "fillers" });
    const f = fitGlance({ fixed, line: "4 fillers, first at 0:02.", cue: "Practice 2: under 4.", earned: best });
    expect(f.cue).toBeNull();
    expect(f.earned).toBe("Best yet, past 690");
    expect(f.words).toBe(24);
    const tight = fitGlance({ fixed, line: "4 fillers, first at 0:02.", cue: "Practice 2: under 4.", earned: best }, 22);
    expect([tight.cue, tight.earned]).toEqual([null, "Best yet"]);
  });
  it("never drops the score, the line or the tap", () => {
    const f = fitGlance({ fixed, line: "4 fillers, first at 0:02.", cue: "Practice 2: under 4.", earned: null }, 3);
    expect(f.cue).toBeNull();
    expect(f.words).toBe(countWords([...fixed, "4 fillers, first at 0:02."].join(" ")));
  });
  it("is 25 words", () => expect(GLANCE_WORDS).toBe(25));
});

describe("cueLead", () => {
  it("names the next practice, then next time, then next week", () => {
    expect(cueLead({ lesson: { practice: 1, of: 3 } })).toBe("Practice 2:");
    expect(cueLead({ lesson: { practice: 2, of: 3 } })).toBe("Practice 3:");
    expect(cueLead({ lesson: { practice: 3, of: 3 } })).toBe("Next time:");
    expect(cueLead({})).toBe("Next time:");
    expect(cueLead({ boss: true })).toBe("Next week:");
  });
});

describe("glanceTrait", () => {
  it("reads the lesson, then Today's card, then Fillers", () => {
    expect(glanceTrait({ lessonId: "lesson:the-cold-open:1" })).toBe("fillers");
    expect(glanceTrait({ lessonId: "lesson:the-landing:2" })).toBe("pause");
    expect(glanceTrait({ lessonId: "topic:t5", practice: { trait: "pace" } })).toBe("pace");
    expect(glanceTrait({ lessonId: "game:qa:qa2" })).toBe("fillers");
  });
});

describe("earnedLine", () => {
  const ladder: RewardMoment = { headline: "Level 3 is open", detail: "x", tone: "earned" };
  const index: RewardMoment = { headline: "Best Ethos yet", detail: "849, past your 690", tone: "earned" };
  const clean: RewardMoment = { headline: "Cleanest recording yet", detail: "1.2/min, under your 2", tone: "earned" };
  const held: RewardMoment = { headline: "Most silence you've held", detail: "5 held pauses, past 4", tone: "earned" };
  const round: RewardMoment = { headline: "Best round yet", detail: "22s", tone: "earned" };
  it("takes the ladder over the Index over the trait's record over the best round", () => {
    expect(earnedLine({ bests: [index, clean, round], ladderMoment: ladder, trait: "fillers" })?.text).toBe("Level 3 is open");
    expect(earnedLine({ bests: [round, clean, index], trait: "fillers" })?.text).toBe("Best yet, past 690");
    expect(earnedLine({ bests: [round, clean], trait: "fillers" })?.text).toBe("Cleanest recording yet");
    expect(earnedLine({ bests: [round, held], trait: "pause" })?.text).toBe("Most silence you've held");
    expect(earnedLine({ bests: [round, held], trait: "fillers" })?.text).toBe("Best round yet");
  });
  it("is empty when nothing was earned, and ink for a second score", () => {
    expect(earnedLine({ bests: [], trait: "fillers" })).toBeNull();
    expect(earnedLine({ bests: [], trait: "fillers", presence: { score: 72, previous: 68 } })).toEqual({
      text: "Presence 72",
      short: null,
      tone: "plain",
      delta: 4,
    });
    expect(earnedLine({ bests: [], trait: "fillers", accuracy: 72 })).toMatchObject({ text: "Accuracy 72", tone: "plain" });
    expect(earnedLine({ bests: [index], trait: "fillers", accuracy: 72 })?.tone).toBe("earned");
  });
});

describe("sheetSections, the door's contents", () => {
  const base = {
    bests: 0, accuracy: false, roundNote: false, audio: true, fillers: 4,
    coach: true, capped: false, presence: false, closing: true, ladder: false,
  };
  it("a lesson practice: Hear it back, the coach, every dimension, the words, the closing note last", () => {
    expect(sheetSections(base)).toEqual(["hear", "coach", "dimensions", "words", "closing"]);
  });
  it("records first when a best fell; a game's round note on top and its ladder at the end", () => {
    expect(sheetSections({ ...base, bests: 2, roundNote: true, ladder: true })).toEqual([
      "records", "round-note", "hear", "coach", "dimensions", "words", "closing", "ladder",
    ]);
  });
  it("no audio lists every filler; capped says the read is back tomorrow; video adds Presence; the boss its accuracy", () => {
    expect(sheetSections({ ...base, audio: false, coach: false, capped: true, presence: true, accuracy: true })).toEqual([
      "accuracy", "fillers", "capped", "dimensions", "presence", "words", "closing",
    ]);
    expect(sheetSections({ ...base, audio: false, fillers: 0 })).not.toContain("fillers");
  });
  it("never drops the dimensions or the transcript", () => {
    const s = sheetSections({ ...base, audio: false, fillers: 0, coach: false, closing: false });
    expect(s).toEqual(["dimensions", "words"]);
  });
});

describe("the glance's copy", () => {
  const all: string[] = [];
  for (const trait of ["fillers", "pause", "repairs", "pace", "range"] as TraitId[]) {
    for (const over of [{}, { fillerCount: 0, fillers: [] }, { repairCount: 0 }, { wpm: 172 }, { pauses: [] }] as Partial<RepMetrics>[]) {
      const g = line(trait, over, { lead: "Practice 2:" });
      all.push(g.sentence, g.cue ?? "");
      const c = line(trait, over, { capped: true });
      all.push(c.sentence, c.cue ?? "");
    }
  }
  all.push(unscoredReason({ substance: { wordCount: 12, distinctRatio: 1, repeatShare: 0 } }), unscoredReason({ substance: { wordCount: 40, distinctRatio: 0.2, repeatShare: 0.6 } }));
  it("has no em dash, never says rep, and at most seven words before the cue", () => {
    for (const s of all) {
      expect(s).not.toContain("—");
      expect(s).not.toMatch(/\breps?\b/i);
      expect(s.match(/, not /g)?.length ?? 0).toBeLessThanOrEqual(1);
    }
    for (const trait of ["fillers", "pause", "repairs", "pace"] as TraitId[]) {
      expect(countWords(line(trait).sentence)).toBeLessThanOrEqual(7);
      expect(countWords(line(trait).cue ?? "")).toBeLessThanOrEqual(7);
    }
  });
});
