import { describe, expect, it } from "vitest";
import { gameById, type Game } from "./games";
import { ladderState, type LadderRow, type LadderState } from "./ladder";
import type { Word } from "./metrics";
import { measureRound, type CutInFact, type GameRound, type QaRound } from "./round";
import {
  bestMoment,
  clock,
  clockTenth,
  decidingCutIn,
  heldInARow,
  ladderView,
  roundHeader,
  roundReveal,
  roundWon,
  secs,
  stripLabel,
  TASTE_LINE,
  tasteHeadline,
  tasteKey,
  waitFact,
  waitTicks,
  xpLine,
} from "./round-copy";

const QA = gameById("qa") as Game;
const RUSH = gameById("rush") as Game;
const INTERVIEW = gameById("interview") as Game;

const base = {
  v: 1 as const,
  level: 1 as const,
  cap: 90,
  durationS: 40,
  stoppedBy: "you" as const,
  lastWord: 39.5,
  stars: 2,
  scorable: true,
  counted: true,
  best: null,
};

const fact = (over: Partial<CutInFact> = {}): CutInFact => ({
  at: 17.2,
  line: "Says who?",
  gap: 1.2,
  gapFrom: 17.4,
  gapTo: 18.6,
  verdict: "held",
  fillerAt: null,
  fillerWord: null,
  cleanAfter: 22,
  spokeAfter: 22.3,
  ...over,
});

const qa = (over: Partial<QaRound> = {}): QaRound => ({
  ...base,
  game: "qa",
  cutIns: [fact()],
  best: 22,
  ...over,
});

const rush = (over: Record<string, unknown> = {}): GameRound =>
  ({ ...base, game: "rush", cap: 30, lastWord: 27.4, spare: 2.6, landed: true, ...over }) as GameRound;

const interview = (over: Record<string, unknown> = {}): GameRound =>
  ({
    ...base,
    game: "interview",
    durationS: 75,
    lastWord: 74.2,
    firstWord: 1.1,
    inWindow: true,
    numberAtEnd: null,
    cutIns: [],
    best: 650,
    ...over,
  }) as GameRound;

/** Every string the walk prints, against COPY-RULES: no em dash, no banned word. */
function clean(s: string | null | undefined) {
  if (!s) return;
  expect(s).not.toMatch(/—/);
  expect(s).not.toMatch(/\b(gyms?|workouts?|drills?|training|reps?)\b/i);
}

describe("numbers as the screen writes them", () => {
  it("reads a clock as a clock does, and to the tenth where asked", () => {
    expect(clock(17.8)).toBe("0:17");
    expect(clock(74)).toBe("1:14");
    expect(clockTenth(27.4)).toBe("0:27.4");
    expect(clockTenth(29.96)).toBe("0:30.0");
    expect(secs(1.24)).toBe("1.2s");
    expect(secs(2.6)).toBe("2.6s");
  });
});

describe("the round card, Q&A (F3)", () => {
  it("held: the seconds, held after he cut in, sage and a win", () => {
    const r = roundReveal(QA, qa());
    expect(r.eyebrow).toBe("Demos cut in at 0:17");
    expect(r.number).toBe("1.2s");
    expect(r.note).toBe("held after he cut in");
    expect(r.line).toBe("You spoke 22s clean after it.");
    expect(r.win).toBe(true);
  });

  it("says a run of holds when there is one", () => {
    expect(roundReveal(QA, qa(), 3).line).toBe("You've held 3 in a row.");
    expect(roundReveal(QA, qa(), 1).line).toBe("You spoke 22s clean after it.");
  });

  it("breath, filled, long and through each say their own line, and none is a win", () => {
    const breath = roundReveal(QA, qa({ cutIns: [fact({ verdict: "breath", gap: 0.5 })] }));
    expect([breath.number, breath.note, breath.line]).toEqual(["0.5s", "after he cut in", "Held starts at 0.8s."]);
    const filled = roundReveal(QA, qa({ cutIns: [fact({ verdict: "filled", gap: 0.9, fillerAt: 18.3, fillerWord: "um" })] }));
    expect(filled.line).toBe("An “um” at 0:18 broke it.");
    const like = roundReveal(QA, qa({ cutIns: [fact({ verdict: "filled", gap: 0.9, fillerAt: 18.3, fillerWord: "like" })] }));
    expect(like.line).toBe("A “like” at 0:18 broke it.");
    const heard = roundReveal(QA, qa({ cutIns: [fact({ verdict: "filled", gap: 0.9, fillerAt: 18.3, fillerWord: null })] }));
    expect(heard.line).toBe("A sound at 0:18 broke it.");
    const long = roundReveal(QA, qa({ cutIns: [fact({ verdict: "long", gap: 4.1 })] }));
    expect([long.number, long.line]).toEqual(["4.1s", "Past 3.5s, a pause reads as lost."]);
    const through = roundReveal(QA, qa({ cutIns: [fact({ verdict: "through", gap: 0.1 })] }));
    expect([through.number, through.line]).toEqual(["<0.3s", "You kept talking through him."]);
    for (const r of [breath, filled, long, through]) expect(r.win).toBe(false);
  });

  it("missed: he didn't get in, and when he would have", () => {
    const r = roundReveal(QA, qa({ lastWord: 10.4, cutIns: [fact({ at: null, verdict: "missed", gap: null })] }));
    expect(r.eyebrow).toBe("Demos didn't get in");
    expect(r.number).toBeNull();
    expect(r.line).toBe("You stopped at 0:10. He cuts in after 0:12.");
    expect(r.win).toBe(false);
    const two = roundReveal(QA, qa({ level: 2, lastWord: 4, cutIns: [fact({ at: null, verdict: "missed", gap: null })] }));
    expect(two.line).toBe("You stopped at 0:04. He cuts in after 0:06.");
  });

  it("held but stopped soon after says so, since that round does not count", () => {
    const r = roundReveal(QA, qa({ counted: false, cutIns: [fact({ spokeAfter: 2.2 })] }));
    expect(r.line).toBe("You stopped 2s after he cut in.");
    // Not a win: no sage, no sound, since the ladder did not count it (plan 3, 11).
    expect(r.win).toBe(false);
    // The engine's own round, held 1.2s and stopped 2s after him, agrees.
    const words: Word[] = [];
    for (let t = 0.5; t < 16.9; t += 0.3) words.push({ word: " word", start: t, end: t + 0.28 });
    words.push({ word: " so", start: 18.2, end: 18.5 }, { word: " no.", start: 18.6, end: 19.2 });
    const measured = measureRound({
      game: "qa", level: 1, cutIns: [{ at: 17, line: "Says who?" }], stoppedBy: "you",
      words, fillers: [], durationS: 19.5, stars: 3, scorable: true,
    }) as QaRound;
    expect(measured.cutIns[0].verdict).toBe("held");
    expect(measured.counted).toBe(false);
    expect(roundWon(QA, measured)).toBe(measured.counted);
  });

  it("level 3: the cut-in that decides, both times in the eyebrow", () => {
    const both = qa({
      level: 3,
      cutIns: [fact({ at: 8.1, gap: 1.0 }), fact({ at: 36.4, gap: 1.4 })],
    });
    const r = roundReveal(QA, both);
    expect(r.eyebrow).toBe("Demos cut in at 0:08 and 0:36");
    expect(r.number).toBe("1.0s");
    expect(r.line).toBe("Both held: 1.0s and 1.4s.");
    expect(r.win).toBe(true);
    const second = qa({
      level: 3,
      cutIns: [fact({ at: 8.1, gap: 1.0 }), fact({ at: 36.4, gap: 0.4, verdict: "breath" })],
    });
    expect(decidingCutIn(second)?.at).toBe(36.4);
    expect(roundReveal(QA, second).win).toBe(false);
    const early = qa({ level: 3, lastWord: 28, cutIns: [fact({ at: 8.1, gap: 1.0 }), fact({ at: null, verdict: "missed", gap: null })] });
    expect(roundReveal(QA, early).line).toBe("You stopped at 0:28, before he cut in again.");
    expect(roundReveal(QA, early).win).toBe(false);
  });

  it("an unscorable take wins nothing", () => {
    expect(roundReveal(QA, qa({ scorable: false })).win).toBe(false);
  });

  it("reads a round measured from real word times the same way", () => {
    // He cuts in at 17.0; you stop at 17.3 and come back at 18.5: 1.2s held.
    const words: Word[] = [];
    let t = 0.4;
    while (t < 17) {
      words.push({ word: "word", start: t, end: t + 0.3 });
      t += 0.4;
    }
    words.push({ word: "mine.", start: 16.9, end: 17.3 });
    t = 18.5;
    while (t < 40) {
      words.push({ word: "word", start: t, end: t + 0.3 });
      t += 0.4;
    }
    const round = measureRound({
      game: "qa",
      level: 1,
      cutIns: [{ at: 17, line: "Says who?" }],
      words,
      fillers: [],
      durationS: 41,
      stars: 3,
      scorable: true,
    }) as GameRound;
    const r = roundReveal(QA, round);
    expect(r.number).toBe("1.2s");
    expect(r.win).toBe(true);
    expect(roundWon(QA, round)).toBe(true);
  });
});

describe("the round card, Speed rush (F3)", () => {
  it("stopped by you: the spare seconds and the last word", () => {
    const r = roundReveal(RUSH, rush());
    expect([r.eyebrow, r.number, r.note, r.line]).toEqual(["30 seconds", "2.6s", "to spare", "Last word at 0:27.4."]);
    expect(r.win).toBe(true);
  });

  it("stopped by the clock: the cap, and no win", () => {
    const r = roundReveal(RUSH, rush({ stoppedBy: "clock", lastWord: 29.8, spare: 0.2, landed: false }));
    expect([r.number, r.note, r.line]).toEqual(["0:30", "the clock stopped you", "Last word at 0:29.8."]);
    expect(r.win).toBe(false);
  });

  it("too early, too close and too few words each say why", () => {
    expect(roundReveal(RUSH, rush({ lastWord: 9, spare: 21, landed: false })).line).toBe("A round counts from 0:15.");
    // Level 1's half is 22.5s, said to the tenth: a 22.3s round has not passed it.
    expect(
      roundReveal(RUSH, rush({ level: 1, cap: 45, lastWord: 22.3, spare: 22.7, landed: false })).line
    ).toBe("A round counts from 0:22.5.");
    expect(roundReveal(RUSH, rush({ level: 3, cap: 20, lastWord: 8, spare: 12, landed: false })).line).toBe(
      "A round counts from 0:10."
    );
    expect(roundReveal(RUSH, rush({ lastWord: 29.7, spare: 0.3, landed: false })).line).toBe(
      "A round needs 0.5s to spare."
    );
    const short = roundReveal(RUSH, rush({ scorable: false }));
    expect(short.line).toBe("It takes 20 words to count.");
    expect(short.win).toBe(false);
  });
});

describe("the round card, Interview (F3)", () => {
  it("inside the window: the last word, sage", () => {
    const r = roundReveal(INTERVIEW, interview());
    expect([r.eyebrow, r.number, r.note]).toEqual(["1:00 to 1:30", "1:14", "inside the window"]);
    expect(r.win).toBe(true);
  });

  it("names the number in the last sentence", () => {
    const r = roundReveal(INTERVIEW, interview({ numberAtEnd: "30 percent" }));
    expect(r.line).toBe("Your last sentence had a number: “30 percent”.");
  });

  it("short, and stopped by the clock", () => {
    const short = roundReveal(INTERVIEW, interview({ lastWord: 48.2, inWindow: false }));
    expect([short.number, short.note, short.line]).toEqual(["0:48", "under 1:00", "12 seconds short."]);
    expect(short.win).toBe(false);
    const clockStop = roundReveal(INTERVIEW, interview({ lastWord: 89.8, inWindow: false, stoppedBy: "clock" }));
    expect([clockStop.number, clockStop.note]).toEqual(["1:30", "the clock stopped you"]);
  });

  it("past the window by your own stop, to the tenth, so the number agrees with its note", () => {
    const r = roundReveal(INTERVIEW, interview({ lastWord: 89.7, inWindow: false, stoppedBy: "you" }));
    expect([r.number, r.note]).toEqual(["1:29.7", "past 1:29.5"]);
    expect(r.win).toBe(false);
  });
});

describe("the XP line (F3)", () => {
  it("names what multiplied it, from the stored multiplier", () => {
    expect(xpLine({ gameId: "qa", xpMultiplier: 2, mods: ["interrupt"], level: 1 })).toEqual({
      amount: "+20 XP",
      note: "×2 for the cut-in",
    });
    expect(xpLine({ gameId: "rush", xpMultiplier: 1.5, mods: ["tight"], level: 1 })).toEqual({
      amount: "+15 XP",
      note: "×1.5 for the tight timer",
    });
    expect(xpLine({ gameId: "qa", xpMultiplier: 2.5, mods: ["interrupt"], level: 2 }).note).toBe(
      "×2.5 for the cut-in at level 2"
    );
    expect(xpLine({ gameId: "interview", xpMultiplier: 3, mods: ["interrupt"], level: 3 }).note).toBe(
      "×3 for the follow-up at level 3"
    );
    expect(xpLine({ gameId: "interview", xpMultiplier: 1.25, mods: [], level: 2 }).note).toBe("×1.25 for level 2");
  });

  it("says nothing more at ×1: no cut-in, no multiplier", () => {
    expect(xpLine({ gameId: "qa", xpMultiplier: 1, mods: [], level: 1 })).toEqual({ amount: "+10 XP", note: null });
  });
});

describe("the walk around the round", () => {
  it("names the round in the header from round 2 (F6a)", () => {
    expect(roundHeader("Q&A", 1)).toBe("Q&A");
    expect(roundHeader("Q&A", 0)).toBe("Q&A");
    expect(roundHeader("Q&A", 3)).toBe("Q&A, round 3");
  });

  it("says one fact during the wait (F7)", () => {
    const qaWait = { gameId: "qa", cutInStaged: true, stoppedBy: "you" as const, seconds: 41 };
    expect(waitFact({ ...qaWait, cutIns: [17.4] })).toBe("Demos cut in at 0:17.");
    expect(waitFact({ ...qaWait, cutIns: [] })).toBe("Demos didn't get in.");
    const rushWait = { gameId: "rush", cutInStaged: false, cutIns: [] };
    expect(waitFact({ ...rushWait, stoppedBy: "you", seconds: 27 })).toBe("You stopped it at 0:27.");
    expect(waitFact({ ...rushWait, stoppedBy: "clock", seconds: 30 })).toBe("The clock stopped it at 0:30.");
    expect(waitFact({ gameId: null, cutInStaged: false, cutIns: [], stoppedBy: "you", seconds: 30 })).toBeNull();
  });

  it("marks the cut-in on the wait's wave only where the fact line says it (regression review)", () => {
    expect(waitTicks({ gameId: "qa", cutIns: [17.4] })).toEqual([17.4]);
    // A daily take with the Interruption mod: Demos cut in, but nothing
    // on its wait or its results says so, so the wave carries no tick.
    expect(waitTicks({ gameId: null, cutIns: [14.5] })).toEqual([]);
    const fact = waitFact({ gameId: null, cutInStaged: true, cutIns: [14.5], stoppedBy: "clock", seconds: 30 });
    expect(fact).toBeNull();
  });
});

describe("Tomorrow names the ladder (M5)", () => {
  const state = (over: Partial<LadderState> = {}): LadderState => ({
    open: 1,
    counted: 1,
    of: 2,
    countedToday: true,
    mastered: false,
    best: { 1: null, 2: null, 3: null },
    chain: 0,
    ...over,
  });

  it("progress toward the next level", () => {
    const v = ladderView(QA, state({ counted: 0, countedToday: false }), state({ open: 2 }), true);
    expect(v.head).toBe("Q&A, level 2");
    expect(v.line).toBe("1 of 2 counted. One more on another day opens level 3.");
    expect(v.rule).toBeNull();
  });

  it("says the rule once when the round did not count", () => {
    const v = ladderView(QA, state({ countedToday: false }), state({ countedToday: false }), false);
    expect(v.line).toBe("1 of 2 counted. One more opens level 2.");
    expect(v.rule).toBe(QA.countsWhen);
  });

  it("level 3 counts days at three stars toward mastery", () => {
    const v = ladderView(QA, null, state({ open: 3, of: 3, counted: 2 }), true);
    expect(v.line).toBe("2 of 3 days at three stars. One more on another day masters Q&A.");
    expect(ladderView(QA, null, state({ open: 3, of: 3, counted: 0, countedToday: false }), true).line).toBe(
      "0 of 3 days at three stars. Three on three different days master Q&A."
    );
    expect(ladderView(QA, null, state({ open: 3, of: 3, counted: 1, countedToday: true }), true).line).toBe(
      "1 of 3 days at three stars. Two more on other days master Q&A."
    );
    expect(ladderView(QA, null, state({ open: 3, of: 3, counted: 1, countedToday: false }), true).line).toBe(
      "1 of 3 days at three stars. Two more master Q&A."
    );
    expect(ladderView(QA, null, state({ open: 3, of: 3, counted: 2, countedToday: false }), true).line).toBe(
      "2 of 3 days at three stars. One more masters Q&A."
    );
  });

  it("a level opening is the closing moment, with its condition", () => {
    const v = ladderView(QA, state({ open: 2 }), state({ open: 3, of: 3, counted: 0 }), true);
    expect(v.moment).toEqual({ headline: "Level 3 is open", detail: "Demos cuts in twice.", tone: "earned" });
    const r = ladderView(RUSH, state(), state({ open: 2, counted: 0 }), true);
    expect(r.moment?.detail).toBe("30 seconds.");
    expect(r.line).toBe("0 of 2 counted. Two on two different days open level 3.");
  });

  it("mastery is the closing moment", () => {
    const v = ladderView(
      QA,
      state({ open: 3, of: 3, counted: 2 }),
      state({ open: 3, of: 3, counted: 3, mastered: true }),
      true
    );
    expect(v.moment).toEqual({
      headline: "Q&A mastered",
      detail: "Three days at level 3, three stars each.",
      tone: "earned",
    });
    expect(v.line).toBe("3 of 3 days at three stars.");
  });

  it("claims nothing opened when the history before could not be read", () => {
    expect(ladderView(QA, null, state({ open: 2 }), true).moment).toBeNull();
  });

  it("matches what the ladder reads off stored rows", () => {
    const day = (d: number) => new Date(2026, 10, d, 12).toISOString();
    const rows: LadderRow[] = [
      { created_at: day(10), lesson_id: "game:qa:qa1", stars: 3, round: qa() },
      { created_at: day(11), lesson_id: "game:qa:qa2", stars: 3, round: qa() },
    ];
    const now = new Date(2026, 10, 11, 18);
    const before = ladderState(rows.slice(0, 1), "qa", now);
    const after = ladderState(rows, "qa", now);
    const v = ladderView(QA, before, after, true);
    expect(v.moment?.headline).toBe("Level 2 is open");
    expect(v.line).toBe("0 of 2 counted. Two on two different days open level 3.");
  });
});

describe("held in a row", () => {
  const day = (d: number) => new Date(2026, 10, d, 12).toISOString();
  it("counts back from the newest round, skipping the ones he never got into", () => {
    const rows: LadderRow[] = [
      { created_at: day(1), lesson_id: "game:qa:qa1", round: qa({ cutIns: [fact({ verdict: "breath" })] }) },
      { created_at: day(2), lesson_id: "game:qa:qa2", round: qa() },
      { created_at: day(3), lesson_id: "game:qa:qa3", round: qa({ cutIns: [fact({ at: null, verdict: "missed" })] }) },
      { created_at: day(4), lesson_id: "game:qa:qa4", round: qa() },
      { created_at: day(5), lesson_id: "game:rush:ru1", round: rush() },
    ];
    expect(heldInARow(rows)).toBe(2);
    expect(heldInARow(rows.slice(0, 1))).toBe(0);
  });
});

describe("Best round yet (M4)", () => {
  it("names the beaten best in the game's own unit", () => {
    expect(bestMoment({ gameId: "qa", level: 2, before: 22, now: 31 })).toEqual({
      headline: "Best round yet",
      detail: "31s clean after the cut-in, past your 22s",
      tone: "earned",
      record: { value: "31s", rest: "clean after the cut-in", past: "past your 22s" },
    });
    expect(bestMoment({ gameId: "rush", level: 1, before: 4, now: 5 })?.detail).toBe("5 landed in a row, past your 4");
    expect(bestMoment({ gameId: "interview", level: 2, before: 712, now: 741 })?.detail).toBe(
      "741 at level 2, past your 712"
    );
  });

  it("breaks nothing on a first round, a tie or a drop", () => {
    expect(bestMoment({ gameId: "qa", level: 1, before: null, now: 20 })).toBeNull();
    expect(bestMoment({ gameId: "qa", level: 1, before: 20, now: 20 })).toBeNull();
    expect(bestMoment({ gameId: "qa", level: 1, before: 20, now: 12 })).toBeNull();
  });

  it("tells two close runs apart by their tenths", () => {
    expect(bestMoment({ gameId: "qa", level: 1, before: 22.1, now: 22.4 })?.detail).toBe(
      "22.4s clean after the cut-in, past your 22.1s"
    );
    expect(bestMoment({ gameId: "qa", level: 1, before: 22.1, now: 22.4 })?.record).toEqual({
      value: "22.4s",
      rest: "clean after the cut-in",
      past: "past your 22.1s",
    });
  });

  it("splits the same words for the eye: the new number, its words, the best it beat (#421)", () => {
    expect(bestMoment({ gameId: "rush", level: 1, before: 4, now: 5 })?.record).toEqual({
      value: "5",
      rest: "landed in a row",
      past: "past your 4",
    });
    expect(bestMoment({ gameId: "interview", level: 2, before: 712, now: 741 })?.record).toEqual({
      value: "741",
      rest: "Index at level 2",
      past: "past your 712",
    });
    // Every word the eye reads is in the sentence a screen reader hears.
    for (const m of [
      bestMoment({ gameId: "qa", level: 2, before: 22, now: 31 }),
      bestMoment({ gameId: "rush", level: 1, before: 4, now: 5 }),
    ]) {
      const r = m?.record;
      expect(r).toBeTruthy();
      expect(m?.detail).toBe(`${r?.value} ${r?.rest}, ${r?.past}`);
    }
    for (const part of Object.values(bestMoment({ gameId: "qa", level: 2, before: 22, now: 31 })?.record ?? {})) {
      expect(part).not.toMatch(/—/);
      expect(part).not.toMatch(/\b(reps?|gym|workout|drill|training)\b/i);
    }
  });
});

describe("the ask after the taste (plan 13)", () => {
  it("leads with that round's real number", () => {
    expect(tasteHeadline(RUSH, rush({ cap: 45, lastWord: 42.4, spare: 2.6 }))).toBe("Speed rush, level 1. 2.6s to spare.");
    expect(tasteHeadline(RUSH, rush({ stoppedBy: "clock", lastWord: 44.8, landed: false }))).toBe(
      "Speed rush, level 1. Last word at 0:44.8."
    );
    expect(tasteHeadline(INTERVIEW, interview())).toBe("Interview, level 1. 1:14 inside the window.");
    expect(tasteHeadline(INTERVIEW, interview({ lastWord: 48, inWindow: false }))).toBe("Interview, level 1. Finished at 0:48.");
    expect(tasteHeadline(RUSH, null)).toBe("Speed rush, level 1.");
    expect(TASTE_LINE).toBe("Play it any day.");
    expect(tasteKey("rush")).toBe("ethos.taste.rush");
  });
});

describe("copy rules on every string the walk prints", () => {
  it("has no em dash and no banned word anywhere", () => {
    const rounds: [Game, GameRound][] = [
      [QA, qa()],
      [QA, qa({ cutIns: [fact({ verdict: "filled", fillerWord: "um", fillerAt: 18 })] })],
      [QA, qa({ cutIns: [fact({ at: null, verdict: "missed" })] })],
      [RUSH, rush()],
      [RUSH, rush({ stoppedBy: "clock", landed: false })],
      [INTERVIEW, interview({ numberAtEnd: "two" })],
      [INTERVIEW, interview({ lastWord: 40, inWindow: false })],
    ];
    for (const [g, r] of rounds) {
      const v = roundReveal(g, r, 2);
      for (const s of [v.eyebrow, v.number, v.note, v.line]) clean(s);
      clean(tasteHeadline(g, r));
    }
    for (const g of [QA, RUSH, INTERVIEW]) {
      const s: LadderState = { open: 2, counted: 1, of: 2, countedToday: true, mastered: false, best: { 1: null, 2: null, 3: null }, chain: 0 };
      const v = ladderView(g, { ...s, open: 1 }, s, false);
      for (const x of [v.head, v.line, v.rule, v.moment?.headline, v.moment?.detail]) clean(x);
    }
    clean(TASTE_LINE);
  });
});

describe("the strip's spoken label (games review, finding 14)", () => {
  it("says the silence as the card writes it", () => {
    expect(stripLabel([fact({ at: 17.2, gap: 1.23 })])).toBe(
      "Demos cut in at 17 seconds, then 1.2 seconds of silence"
    );
    expect(stripLabel([fact({ at: 17.2, gap: 0.2, verdict: "through" })])).toBe(
      "Demos cut in at 17 seconds, then under 0.3 seconds of silence"
    );
    expect(stripLabel([fact({ at: null, verdict: "missed", gap: null })])).toBe("");
    expect(
      stripLabel([fact({ at: 8.1, gap: 1.0 }), fact({ at: 36.4, gap: 1.44 })])
    ).toBe("Demos cut in at 8 seconds, then 1.0 seconds of silence. Demos cut in at 36 seconds, then 1.4 seconds of silence");
  });
});
