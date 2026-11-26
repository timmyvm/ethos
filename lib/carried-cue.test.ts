import { describe, expect, it } from "vitest";
import {
  addDays,
  answerLine,
  ASIDE_DAYS,
  ASIDE_MAX,
  CARRY_DAYS,
  carryCue,
  chooseCue,
  cueEvidence,
  cueGlance,
  cueKey,
  cueSentence,
  cueShortSentence,
  cueTitle,
  holds,
  measure,
  newerCue,
  parseCueState,
  PAUSE_MARK,
  reminderCue,
  saidLastTime,
  warmsUp,
  warmupLead,
  warmupPieces,
  warmupSentence,
  type Cue,
  type CueKind,
  type CueState,
  type CueTake,
} from "./carried-cue";
import { countWords, fitGlance, GLANCE_WORDS } from "./glance";
import { computeMetrics, type RepMetrics, type Word } from "./metrics";

/*
 * Feedback that sticks (#477). The look fixture's live take
 * (scripts/look-fixtures.mjs), rebuilt as lib/glance.test.ts rebuilds it:
 * 62 seconds, "um" twice (the first at 0:02), "like" and "you know" once,
 * one searching pause at 0:20, 145 words a minute, one restart, and
 * "five" said four times.
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
const TIER1 = { pause: 72, fillers: 55, repairs: 66, pace: 93, range: 66 };

const take = (over: Partial<RepMetrics> = {}, tier1: Partial<typeof TIER1> = {}): CueTake => ({
  metrics: {
    ...computeMetrics([], 62),
    durationS: 62,
    wpm: 145,
    fillerCount: FILLERS.length,
    fillers: FILLERS,
    fillerCounts: { um: 2, like: 1, "you know": 1 },
    repairCount: 1,
    pauses: PAUSES,
    ...over,
  },
  tier1: { ...TIER1, ...tier1 },
  transcript: TRANSCRIPT,
  words: WORDS,
});
/** The fixture's fillers with "um" said `n` times. */
const ums = (n: number) => [
  ...Array.from({ length: n }, (_, i) => ({ word: "um", t: 2.68 + i * 9 })),
  { word: "like", t: 7.9 },
];

const TODAY = "2026-11-16";
const YESTERDAY = addDays(TODAY, -1);
const cue = (over: Partial<Cue> = {}): Cue => ({
  kind: "filler",
  word: "um",
  from: 5,
  last: 5,
  givenOn: YESTERDAY,
  answeredOn: null,
  tries: 0,
  line: { text: `So the thing about habits is ${PAUSE_MARK} they compound.`, at: 2.68 },
  ...over,
});
const state = (c: Cue | null, over: Partial<CueState> = {}): CueState => ({ v: 1, cue: c, aside: [], at: "2026-11-15T09:00:00.000Z", ...over });
const AT = new Date("2026-11-16T08:30:00.000Z");

describe("the cue a take carries: its weakest measurable thing", () => {
  it("the fixture carries its fillers, the trait that scored lowest, and the one said most", () => {
    const c = chooseCue(take(), { today: TODAY, practice: "pause" });
    expect(c).toMatchObject({ kind: "filler", word: "um", from: 2, last: 2, givenOn: TODAY, answeredOn: null, tries: 0 });
  });

  it("rehearses on the take's own sentence, the pause where the filler was", () => {
    const c = chooseCue(take(), { today: TODAY })!;
    expect(c.line).toEqual({ text: `So the thing about habits is ${PAUSE_MARK} they compound.`, at: FILLERS[0].t });
    /* "Um" opening a sentence leaves the mark first and the sentence's own capital. */
    const c2 = chooseCue(take({ fillers: [{ word: "um", t: FILLERS[2].t }, { word: "um", t: FILLERS[2].t + 0.1 }], fillerCounts: { um: 2 } }), { today: TODAY })!;
    expect(c2.line?.text).toBe(`So the thing about habits is ${PAUSE_MARK} they compound.`);
  });

  it("takes the other fillers in that sentence out, and cuts a long sentence round the mark", () => {
    const long = "I think, um, the hard part about this whole thing, uh, is that you never really know when the work is finished or good enough.";
    const words = (long.match(/[A-Za-z0-9']+/g) ?? []).map((w, i) => ({ word: w, start: i * 0.4, end: i * 0.4 + 0.3 }));
    const t: CueTake = {
      metrics: { durationS: 60, wpm: 140, fillerCount: 3, fillers: [{ word: "um", t: 0.8 }, { word: "um", t: 30 }, { word: "uh", t: 4.4 }], fillerCounts: { um: 2, uh: 1 }, repairCount: 0, pauses: PAUSES },
      tier1: { fillers: 40 },
      transcript: long,
      words,
    };
    const c = chooseCue(t, { today: TODAY })!;
    expect(c.word).toBe("um");
    expect(c.line?.text).not.toMatch(/\buh\b/i);
    expect(c.line?.text.startsWith(`I think ${PAUSE_MARK} the hard part`)).toBe(true);
    expect(c.line!.text.split(" ").length).toBeLessThanOrEqual(15);
    expect(c.line?.text.endsWith("…")).toBe(true);
  });

  it("a tie goes to the practice's own trait", () => {
    const t = take({}, { fillers: 66, repairs: 66 });
    expect(chooseCue(t, { today: TODAY, practice: "repairs" })?.kind).toBe("restarts");
    expect(chooseCue(t, { today: TODAY, practice: "fillers" })?.kind).toBe("filler");
  });

  it("a pace out of the zone, pauses that searched, a word said again and again", () => {
    expect(chooseCue(take({ wpm: 178 }, { pace: 40 }), { today: TODAY })).toMatchObject({ kind: "fast", from: 178 });
    expect(chooseCue(take({ wpm: 112 }, { pace: 40 }), { today: TODAY })).toMatchObject({ kind: "slow", from: 112 });
    expect(chooseCue(take({}, { pause: 30 }), { today: TODAY })).toMatchObject({ kind: "searching", from: 1 });
    expect(chooseCue(take({}, { range: 30 }), { today: TODAY })).toMatchObject({ kind: "repeat", word: "five", from: 4 });
  });

  it("a pause with a sound comes before a searching one, and no pause at all asks for one", () => {
    const filled = [...PAUSES, { t: 30, len: 1, kind: "pre", verdict: "filled" }] as RepMetrics["pauses"];
    expect(chooseCue(take({ pauses: filled }, { pause: 30 }), { today: TODAY })).toMatchObject({ kind: "filled", from: 1 });
    expect(chooseCue(take({ pauses: [] }, { pause: 30 }), { today: TODAY })).toMatchObject({ kind: "unheld", from: 0 });
  });

  it("a clean take carries nothing", () => {
    const clean = take({ fillers: [], fillerCounts: {}, fillerCount: 0, repairCount: 0, pauses: [PAUSES[0], PAUSES[2]] });
    const t = { ...clean, transcript: "One clear point. Then a second.", words: null };
    expect(chooseCue(t, { today: TODAY })).toBeNull();
  });

  it("skips a cue set aside until its day", () => {
    const aside = [{ key: "filler:um", until: addDays(TODAY, 3) }];
    expect(chooseCue(take(), { today: TODAY, aside })?.kind).toBe("restarts");
    expect(chooseCue(take(), { today: addDays(TODAY, 3), aside })?.kind).toBe("filler");
  });

  it("never writes what the store cannot read back: an over-long word or sentence (the #477 review)", () => {
    const w = (c: string) => c.repeat(31);
    const said = `${w("a")} ${w("b")} ${w("c")}, um, ${w("d")} ${w("e")} ${w("f")} ${w("g")} ${w("h")}. ${"q".repeat(41)} ${"q".repeat(41)} ${"q".repeat(41)} ${"q".repeat(41)}.`;
    const words = (said.match(/[A-Za-z0-9']+/g) ?? []).map((x, i) => ({ word: x, start: i * 0.5, end: i * 0.5 + 0.4 }));
    const t: CueTake = {
      metrics: { durationS: 60, wpm: 140, fillerCount: 1, fillers: [{ word: "um", t: 1.5 }], fillerCounts: { um: 1 }, repairCount: 0, pauses: PAUSES },
      tier1: { fillers: 40, range: 10 },
      transcript: said,
      words,
    };
    /* Variety scored lowest, but its word is longer than the store keeps: the filler is carried. */
    const s = carryCue({ before: null, take: t, today: TODAY, at: AT });
    expect(s.cue).toMatchObject({ kind: "filler", word: "um", line: null });
    expect(parseCueState(JSON.parse(JSON.stringify(s.next)))?.cue).toEqual(s.cue);
  });

  it("skips every cue set aside, not only the newest", () => {
    const aside = [
      { key: "filler:um", until: addDays(TODAY, 5) },
      { key: "restarts:", until: addDays(TODAY, 6) },
    ];
    /* Fillers lowest, then restarts and variety at 66: both of the first two are away. */
    expect(chooseCue(take(), { today: TODAY, aside })?.kind).toBe("repeat");
  });
});

describe("its words: what to do instead", () => {
  const all: Pick<Cue, "kind" | "word">[] = [
    { kind: "filler", word: "like" },
    { kind: "searching", word: null },
    { kind: "filled", word: null },
    { kind: "unheld", word: null },
    { kind: "restarts", word: null },
    { kind: "fast", word: null },
    { kind: "slow", word: null },
    { kind: "repeat", word: "really" },
  ];
  it("says the filler's replacement is a pause (plan section 9, idea 5)", () => {
    expect(cueSentence({ kind: "filler", word: "like" })).toBe("Tomorrow: pause where “like” was.");
    /* #493, the morning tour: "Tomorrow: a pause instead." was vaguer than
       its own short form. The line says the word every time. */
    expect(cueSentence({ kind: "filler", word: "um" })).toBe("Tomorrow: pause where “um” was.");
    expect(cueTitle({ kind: "filler", word: "like" })).toBe("Pause where “like” was");
    expect(cueShortSentence({ kind: "filler", word: "like" })).toBe("Pause where “like” was.");
  });
  it("every cue is one short sentence, no dash, a title without a stop", () => {
    for (const c of all) {
      for (const s of [cueSentence(c)]) {
        expect(s).toMatch(/^Tomorrow: [a-z“].*\.$/);
        expect(countWords(s)).toBeLessThanOrEqual(7);
        expect(s).not.toMatch(/[—–]/);
        /* What to do instead, never a ban ("kill like"). */
        expect(s).not.toMatch(/\b(kill|don't|never|no more)\b/i);
      }
      expect(cueTitle(c)).not.toMatch(/\.$/);
    }
  });
  it("leads the warm-up with the number behind it", () => {
    expect(warmupLead(cue({ last: 9, word: "like" }))).toBe("Last time, “like” 9 times");
    expect(warmupLead(cue({ last: 1, word: "like" }))).toBe("Last time, “like” once");
    expect(warmupLead({ kind: "fast", word: null, last: 178 })).toBe("Last time, 178 words a minute");
    expect(warmupLead({ kind: "searching", word: null, last: 1 })).toBe("Last time, 1 misplaced pause");
    expect(warmupLead({ kind: "unheld", word: null, last: 0 })).toBe("Last time, no pauses between sentences");
  });
  it("has a sentence to rehearse for every cue, the pause marked", () => {
    for (const c of all) {
      const s = warmupSentence({ kind: c.kind, line: null });
      expect(s).toContain(PAUSE_MARK);
      expect(s).not.toMatch(/[—–]/);
      expect(countWords(s)).toBeLessThanOrEqual(12);
    }
    expect(warmupPieces(`So the thing ${PAUSE_MARK} they compound.`)).toEqual([
      { kind: "words", text: "So the thing" },
      { kind: "pause" },
      { kind: "words", text: "they compound." },
    ]);
  });
  it("its evidence names the count and plays the first one", () => {
    const e = cueEvidence({ kind: "filler", word: "um" }, take());
    expect(e.line.sentence).toBe("“um” 2 times, first 0:02");
    expect(e.line.moment).toMatchObject({ clock: "0:02", label: "Play 0:02, the first “um”" });
    expect(e.short.sentence).toBe("“um” 2 times.");
    expect(cueEvidence({ kind: "filler", word: "like" }, take()).line.sentence).toBe("“like” once, at 0:07");
    expect(cueEvidence({ kind: "searching", word: null }, take()).line.sentence).toBe("1 misplaced pause, at 0:20");
    expect(cueEvidence({ kind: "restarts", word: null }, take()).line.sentence).toBe("1 sentence restart in 62s.");
    expect(cueEvidence({ kind: "filler", word: "so" }, take()).line.sentence).toBe("No “so” in 62s.");
  });
});

describe("carry and retire", () => {
  it("a first take sets the cue and stores it", () => {
    const s = carryCue({ before: null, take: take(), today: TODAY, practice: "pause", at: AT });
    expect(s.answer).toBeNull();
    expect(s.fresh).toBe(true);
    expect(s.cue).toMatchObject({ kind: "filler", word: "um", from: 2, givenOn: TODAY });
    expect(s.next).toEqual({ v: 1, cue: s.cue, aside: [], at: AT.toISOString() });
  });

  it("a later take the same day keeps it as it is and writes nothing", () => {
    const today = cue({ givenOn: TODAY });
    const s = carryCue({ before: state(today), take: take({ wpm: 190 }, { pace: 10 }), today: TODAY, at: AT });
    expect(s).toEqual({ answer: null, cue: today, fresh: false, next: null });
    const answered = cue({ answeredOn: TODAY, tries: 1 });
    expect(carryCue({ before: state(answered), take: take(), today: TODAY, at: AT }).answer).toBeNull();
  });

  it("the next day's first take answers it; held, it retires and the take sets the next", () => {
    const s = carryCue({ before: state(cue({ from: 5, last: 5 })), take: take({ fillers: ums(2) }), today: TODAY, at: AT });
    expect(s.answer).toEqual({ kind: "filler", word: "um", now: 2, before: 5, held: true, rested: false });
    expect(s.cue?.kind).toBe("restarts");
    expect(s.fresh).toBe(true);
    expect(s.next?.aside).toEqual([{ key: "filler:um", until: addDays(TODAY, ASIDE_DAYS) }]);
  });

  it("a cue that held stays aside its seven days when the next one retires inside them (the #477 review)", () => {
    /* Monday's "um" holds on Tuesday; Tuesday sets restarts. */
    const tue = carryCue({ before: state(cue({ from: 5, last: 5 })), take: take({ fillers: ums(2) }), today: TODAY, at: AT });
    expect(tue.cue?.kind).toBe("restarts");
    /* Wednesday's take holds restarts and still says "um" twice, its lowest
       trait: "um" held a day ago, so it is not handed back. */
    const wed = addDays(TODAY, 1);
    const w = carryCue({ before: tue.next, take: take({ fillers: ums(2), repairCount: 0 }), today: wed, at: AT });
    expect(w.answer).toMatchObject({ kind: "restarts", held: true });
    expect(w.cue?.kind).not.toBe("filler");
    expect(w.next?.aside.map((a) => a.key)).toEqual(["filler:um", "restarts:"]);
    /* A week after it held, "um" can come back. */
    const back = carryCue({ before: { ...w.next!, cue: null }, take: take(), today: addDays(TODAY, ASIDE_DAYS), at: AT });
    expect(back.cue?.kind).toBe("filler");
    expect(back.next?.aside.map((a) => a.key)).toEqual(["restarts:"]);
  });

  it(`keeps at most ${ASIDE_MAX} aside, the oldest let go first`, () => {
    const many = Array.from({ length: ASIDE_MAX }, (_, i) => ({ key: `repeat:w${i}`, until: addDays(TODAY, 5) }));
    const s = carryCue({ before: state(cue(), { aside: many }), take: take({ fillers: ums(1) }), today: TODAY, at: AT });
    expect(s.next?.aside).toHaveLength(ASIDE_MAX);
    expect(s.next?.aside[0].key).toBe("repeat:w1");
    expect(s.next?.aside.at(-1)?.key).toBe("filler:um");
  });

  it("not held, it is carried with today's number, its first answer counted", () => {
    const s = carryCue({ before: state(cue({ from: 5, last: 5 })), take: take({ fillers: ums(4) }), today: TODAY, at: AT });
    expect(s.answer).toMatchObject({ now: 4, before: 5, held: false, rested: false });
    expect(s.cue).toMatchObject({ kind: "filler", word: "um", from: 5, last: 4, answeredOn: TODAY, tries: 1, givenOn: YESTERDAY });
    expect(s.fresh).toBe(false);
    /* Read against the bar it was set on: 2 of 5 holds the next day, though 4 to 2 is not half. */
    const next = carryCue({ before: s.next, take: take({ fillers: ums(2) }), today: addDays(TODAY, 1), at: AT });
    expect(next.answer).toMatchObject({ now: 2, before: 4, held: true });
  });

  it(`rests after ${CARRY_DAYS} answers that did not hold, and is set aside`, () => {
    const s = carryCue({ before: state(cue({ from: 2, last: 2, tries: CARRY_DAYS - 1, answeredOn: YESTERDAY })), take: take(), today: TODAY, at: AT });
    expect(s.answer).toMatchObject({ now: 2, before: 2, held: false, rested: true });
    expect(s.cue?.kind).not.toBe("filler");
    expect(s.next?.aside.map((a) => a.key)).toEqual([cueKey({ kind: "filler", word: "um" })]);
  });

  it("days away still answer it on the day they come back", () => {
    const s = carryCue({ before: state(cue({ givenOn: addDays(TODAY, -6) })), take: take({ fillers: ums(1) }), today: TODAY, at: AT });
    expect(s.answer?.held).toBe(true);
  });

  it("holds at half or fewer, a landed pause, the zone, under three", () => {
    const kinds: [CueKind, number, number, boolean][] = [
      ["filler", 9, 4, true],
      ["filler", 9, 5, false],
      ["filler", 1, 0, true],
      ["filler", 1, 1, false],
      ["restarts", 4, 2, true],
      ["searching", 3, 2, false],
      ["unheld", 0, 1, true],
      ["unheld", 0, 0, false],
      ["fast", 178, 160, true],
      ["fast", 178, 161, false],
      ["slow", 112, 130, true],
      ["slow", 112, 129, false],
      ["repeat", 4, 2, true],
      ["repeat", 4, 3, false],
    ];
    for (const [kind, from, now, held] of kinds) expect([kind, from, now, holds({ kind, from }, now)]).toEqual([kind, from, now, held]);
  });

  it("measures the cue's own thing on a take", () => {
    expect(measure({ kind: "filler", word: "um" }, take())).toBe(2);
    expect(measure({ kind: "filler", word: "um" }, take({ fillers: [], fillerCounts: { um: 3 } }))).toBe(3);
    expect(measure({ kind: "searching", word: null }, take())).toBe(1);
    expect(measure({ kind: "unheld", word: null }, take())).toBe(3);
    expect(measure({ kind: "repeat", word: "five" }, take())).toBe(4);
    expect(measure({ kind: "fast", word: null }, take({ wpm: 171.6 }))).toBe(172);
  });
});

describe("the next day's answer, first on the glance", () => {
  const a = (now: number, before: number, held = false, kind: CueKind = "filler", word: string | null = "like") =>
    answerLine({ kind, word, now, before, held, rested: false });
  it("says the count with the one before it", () => {
    expect(a(3, 9, true).line.sentence).toBe("“like” 3 times, down from 9.");
    expect(a(3, 9, true).short.sentence).toBe("“like” 3, down from 9.");
    expect(a(0, 9, true).line.sentence).toBe("No “like”, down from 9.");
    expect(a(1, 9, true).line.sentence).toBe("“like” once, down from 9.");
    expect(a(9, 9).line.sentence).toBe("“like” 9 times again.");
    expect(a(11, 9).line.sentence).toBe("“like” 11 times, up from 9.");
    expect(a(152, 178, true, "fast", null).short.sentence).toBe("Pace 152, down from 178.");
    expect(a(2, 0, true, "unheld", null).line.sentence).toBe("2 pauses between sentences, up from none.");
    expect(a(0, 0, false, "unheld", null).line.sentence).toBe("No pauses between sentences again.");
    expect(a(2, 5, true, "restarts", null).line.sentence).toBe("2 sentence restarts, down from 5.");
  });
  /* The review of #490: "Pauses silent, down from 3." left the 3 with no
     unit; the short form counts the ums, still five words at most. */
  it("a filled pause's short form counts ums, so its number has a unit", () => {
    expect(a(0, 3, true, "filled", null).short.sentence).toBe("No ums, down from 3.");
    expect(a(1, 3, true, "filled", null).short.sentence).toBe("1 um, down from 3.");
    expect(a(2, 2, false, "filled", null).short.sentence).toBe("2 ums again.");
    expect(a(0, 3, true, "filled", null).line.sentence).toBe("No pause had an um, down from 3.");
  });

  it("a short form is still a sentence: a misplaced pause keeps its noun (the #477 review)", () => {
    expect(a(1, 3, true, "searching", null).short.sentence).toBe("1 misplaced pause, down from 3.");
    expect(a(0, 3, true, "searching", null).short.sentence).toBe("No misplaced pauses, down from 3.");
    /* With no shorter line, a full glance gives up "Tomorrow:" and keeps the
       cue: here a way on of five words, as a lesson's ending has. */
    const fixed = ["Today's practice", "665", "/1000", "▲ 3 since last time", "Every number", "Next lesson: Pause between sentences", "Retake"];
    const line = a(1, 3, true, "searching", null);
    const fit = fitGlance({
      fixed,
      line: line.line.sentence,
      lineShort: line.short.sentence,
      cue: cueSentence({ kind: "searching", word: null }),
      cueShort: cueShortSentence({ kind: "searching", word: null }),
      earned: null,
    });
    expect([fit.cue, fit.words <= GLANCE_WORDS]).toEqual(["Pause between sentences.", true]);
  });
  it("held, the count is the earned part; not held, nothing is", () => {
    expect(a(3, 9, true).line.parts[0]).toEqual({ kind: "text", text: "“like” 3 times", earned: true });
    expect(a(9, 9).line.parts.some((p) => p.kind === "text" && p.earned)).toBe(false);
  });

  it("the glance: the answer, then a new cue in full, or the same one named", () => {
    const held = carryCue({ before: state(cue()), take: take({ fillers: ums(2) }), today: TODAY, at: AT });
    const g = cueGlance(held, take({ fillers: ums(2) }))!;
    expect(g.line.sentence).toBe("“um” 2 times, down from 5.");
    expect(g.cue).toBe("Tomorrow: pause, then finish.");
    expect(g.cueShort).toBe("Pause, then finish.");
    expect(g.held).toBe(true);
    const kept = carryCue({ before: state(cue({ from: 2, last: 2 })), take: take(), today: TODAY, at: AT });
    const k = cueGlance(kept, take())!;
    expect(k.line.sentence).toBe("“um” 2 times again.");
    expect(k.cue).toBe("Tomorrow: pause where “um” was.");
    expect(k.held).toBe(false);
  });

  it("the glance on a take that sets it: the evidence with its moment, then the cue", () => {
    const s = carryCue({ before: null, take: take(), today: TODAY, at: AT });
    const g = cueGlance(s, take())!;
    expect(g.line.sentence).toBe("“um” 2 times, first 0:02");
    expect(g.cue).toBe("Tomorrow: pause where “um” was.");
    expect(g.cueShort).toBe("Pause where “um” was.");
  });

  it("nothing carried and nothing to carry: the glance keeps its own line", () => {
    expect(cueGlance({ answer: null, cue: null, fresh: false, next: null }, take())).toBeNull();
  });

  it("fits the glance's 25 words on the daily practice, the cue kept", () => {
    /* scripts/look-sticks.mjs's daily glance: the header, the score and its
       delta, the door, the way on ("Done for today" since #493) and Retake
       are 14 of the 25. */
    const fixed = ["Today's practice", "665", "/1000", "▲ 3 since last time", "Every number", "Done for today", "Retake"];
    expect(countWords(fixed.join(" "))).toBe(14);
    const cases: [CueState | null, Partial<RepMetrics>][] = [
      [null, {}],
      [state(cue()), { fillers: ums(2) }],
      [state(cue({ from: 2, last: 2 })), {}],
      [state(cue({ kind: "fast", word: null, from: 178, last: 178, line: null })), { wpm: 152 }],
      [state(cue({ kind: "filled", word: null, from: 3, last: 3, line: null })), {}],
    ];
    const kept: string[] = [];
    for (const [before, over] of cases) {
      const t = take(over);
      const g = cueGlance(carryCue({ before, take: t, today: TODAY, at: AT }), t)!;
      const fit = fitGlance({ fixed, line: g.line.sentence, lineShort: g.lineShort.sentence, cue: g.cue, cueShort: g.cueShort, earned: null });
      expect([g.line.sentence, fit.words <= GLANCE_WORDS, fit.cue !== null]).toEqual([g.line.sentence, true, true]);
      kept.push(fit.cue ?? "");
    }
    /* The look fixture's three glances keep "Tomorrow:": set, held, carried. */
    expect(kept.slice(0, 3)).toEqual(["Tomorrow: pause where “um” was.", "Tomorrow: pause, then finish.", "Tomorrow: pause where “um” was."]);
  });
});

describe("the store's shape", () => {
  it("reads back what it wrote", () => {
    const s = state(cue(), { aside: [{ key: "fast:", until: "2026-11-20" }, { key: "filler:um", until: "2026-11-21" }] });
    expect(parseCueState(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(parseCueState({ ...s, cue: null })).toEqual({ ...s, cue: null });
  });
  it("reads the aside as a list: none, one on its own, the bad ones dropped, at most the cap", () => {
    const s = state(cue());
    expect(parseCueState({ ...s, aside: null })?.aside).toEqual([]);
    expect(parseCueState({ ...s, aside: { key: "fast:", until: "2026-11-20" } })?.aside).toEqual([{ key: "fast:", until: "2026-11-20" }]);
    expect(parseCueState({ ...s, aside: [{ key: "fast:", until: "soon" }, 3, null, { key: "slow:", until: "2026-11-20" }] })?.aside).toEqual([
      { key: "slow:", until: "2026-11-20" },
    ]);
    const lots = Array.from({ length: ASIDE_MAX + 3 }, (_, i) => ({ key: `repeat:w${i}`, until: "2026-11-20" }));
    expect(parseCueState({ ...s, aside: lots })?.aside.map((a) => a.key)).toEqual(lots.slice(-ASIDE_MAX).map((a) => a.key));
  });
  it("reads anything else as nothing", () => {
    for (const bad of [null, "x", 3, {}, { v: 2, cue: null, aside: null, at: "2026-11-15T00:00:00Z" }, { v: 1, cue: null, aside: null }]) {
      expect(parseCueState(bad)).toBeNull();
    }
    const s = state(cue());
    for (const c of [
      { ...cue(), kind: "shout" },
      { ...cue(), word: null },
      { ...cue(), kind: "fast", word: "um" },
      { ...cue(), from: -1 },
      { ...cue(), givenOn: "yesterday" },
      { ...cue(), word: "x".repeat(41) },
      { ...cue(), line: { text: "no mark here", at: 1 } },
      { ...cue(), line: { text: `${PAUSE_MARK} ${"word ".repeat(60)}`, at: 1 } },
    ]) {
      expect(parseCueState({ ...s, cue: c })?.cue).toBeNull();
    }
  });
  it("the newer copy wins", () => {
    const a = state(cue(), { at: "2026-11-15T09:00:00.000Z" });
    const b = state(null, { at: "2026-11-16T09:00:00.000Z" });
    expect(newerCue(a, b)).toBe(b);
    expect(newerCue(b, a)).toBe(b);
    expect(newerCue(null, a)).toBe(a);
  });
  it("warms up only on a cue carried in from an earlier day and not yet answered", () => {
    expect(warmsUp(state(cue()), TODAY)).toMatchObject({ word: "um" });
    expect(warmsUp(state(cue({ givenOn: TODAY })), TODAY)).toBeNull();
    expect(warmsUp(state(cue({ answeredOn: TODAY })), TODAY)).toBeNull();
    expect(warmsUp(state(null), TODAY)).toBeNull();
    expect(warmsUp(undefined, TODAY)).toBeNull();
  });
});

/*
 * The reminder says the cue only while its number is the last take's (the
 * psych review, 26 Nov). The cue is written only by the take that set or
 * answered it, so a take landing after `at` never touched it.
 */
describe("the reminder's cue: the last time is the last take", () => {
  it("a second take on the cue's own day leaves the cue as it was, so the cue is not the last time", () => {
    // 18:00 Today's practice, "um" 5 times, sets the cue; 18:05 One more, "um" once.
    const set = carryCue({ before: null, take: take({ fillers: ums(5), fillerCount: 6, fillerCounts: { um: 5, like: 1 } }), today: YESTERDAY, at: new Date("2026-11-15T07:00:30.000Z") });
    expect(set.cue).toMatchObject({ kind: "filler", word: "um", last: 5 });
    const more = carryCue({ before: set.next, take: take({ fillers: ums(1), fillerCount: 2, fillerCounts: { um: 1, like: 1 } }), today: YESTERDAY });
    expect(more.next).toBeNull();
    // The account's copy the next day still warms up on 5.
    expect(warmsUp(set.next, TODAY)).toMatchObject({ last: 5 });
    // Its own take was stopped before its results wrote it; One more after.
    expect(reminderCue(set.next, TODAY, "2026-11-15T07:00:00.000Z")).toMatchObject({ word: "um", last: 5 });
    expect(reminderCue(set.next, TODAY, "2026-11-15T07:05:40.000Z")).toBeNull();
  });
  it("needs a take to have said it, with a time that reads", () => {
    const s = state(cue(), { at: "2026-11-15T09:00:00.000Z" });
    expect(saidLastTime(s, "2026-11-15T09:00:00.000Z")).toBe(true);
    expect(saidLastTime(s, "2026-11-15T08:59:59.000+00:00")).toBe(true);
    expect(saidLastTime(s, "2026-11-15T09:00:01.000Z")).toBe(false);
    expect(saidLastTime(s, null)).toBe(false);
    expect(saidLastTime(s, undefined)).toBe(false);
    expect(saidLastTime(s, "not a time")).toBe(false);
  });
  it("is the warm-up's cue and nothing else", () => {
    const before = "2026-11-15T08:00:00.000Z";
    expect(reminderCue(state(cue()), TODAY, before)).toMatchObject({ word: "um" });
    expect(reminderCue(state(cue({ givenOn: TODAY })), TODAY, before)).toBeNull();
    expect(reminderCue(state(cue({ answeredOn: TODAY })), TODAY, before)).toBeNull();
    expect(reminderCue(state(null), TODAY, before)).toBeNull();
    expect(reminderCue(null, TODAY, before)).toBeNull();
  });
});
