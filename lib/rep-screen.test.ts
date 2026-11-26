import { describe, expect, it } from "vitest";
import type { RepRow } from "./client-data";
import { computeMetrics, substance, type RepMetrics } from "./metrics";
import { resolveRepConfig } from "./rep-config";
import {
  backLabel,
  celebratesStreak,
  cueAfterTake,
  defaultBack,
  exitBeat,
  recordCue,
  roundChimes,
  takeRewards,
  thinksFirst,
  underRecord,
} from "./rep-screen";
import { endNote, personalBests } from "./rewards";
import { repairWayOn } from "./glance";
import { SCORED_USED } from "./allowance-copy";
import { localDayKey, scoredUsed } from "./scored-left";
import { keptDays, repairAfterTake, type RepairState, type StreakState } from "./streak";
import { DONE_FOR_TODAY } from "./way-on";

const streak = (over: Partial<StreakState> = {}): StreakState => ({
  current: 0,
  longest: 0,
  atRisk: false,
  didToday: false,
  frozenInRun: 0,
  ...over,
});

const metrics = (over: Partial<RepMetrics> = {}): RepMetrics => ({
  ...computeMetrics([], 60),
  durationS: 60,
  wpm: 145,
  fillerCount: 3,
  fillersPerMin: 3,
  heldPauses: 2,
  composedPauses: 0,
  midSentencePauses: 2,
  stars: 2,
  ...over,
});

const rep = (over: Partial<RepRow> = {}): RepRow =>
  ({
    id: Math.random().toString(36),
    duration_s: 60,
    filler_count: 5,
    ethos_index: 600,
    pauses: [],
    created_at: new Date().toISOString(),
    ...over,
  }) as RepRow;

describe("celebratesStreak", () => {
  it("rolls the streak up on the take that made today count", () => {
    expect(celebratesStreak(streak({ current: 7, didToday: true }), { didToday: false })).toBe(true);
  });

  it("stays down on a second take of a day already spoken", () => {
    // Retake, Go again, Practice 2 of 3, or an evening take: the roll
    // and the day-7 fanfare used to replay on every one.
    expect(celebratesStreak(streak({ current: 7, didToday: true }), { didToday: true })).toBe(false);
  });

  it("stays down when the take's row never landed", () => {
    // Yesterday keeps a 6-day streak alive; nothing grew today.
    expect(celebratesStreak(streak({ current: 6, didToday: false }), { didToday: false })).toBe(false);
  });

  it("celebrates when the screen never learned the day's start", () => {
    expect(celebratesStreak(streak({ current: 1, didToday: true }), null)).toBe(true);
    expect(celebratesStreak(streak({ current: 0 }), null)).toBe(false);
  });
});

describe("recordCue", () => {
  const reps = [rep({ created_at: new Date(Date.now() - 86_400_000).toISOString() })];

  it("names the streak on the line before the day's first take", () => {
    const cue = recordCue({ reps, starMap: {}, streak: streak({ current: 6 }), xp: 0 });
    expect(cue?.headline).toBe("This one keeps a 6-day streak alive");
  });

  it("moves on once today is spoken, instead of repeating the old count", () => {
    const cue = recordCue({
      reps,
      starMap: {},
      streak: streak({ current: 7, didToday: true }),
      xp: 0,
    });
    expect(cue?.headline ?? "").not.toMatch(/streak alive/);
    // The closest milestone, in its two-second line (#483).
    expect(cue?.headline).toBe("Your best score is 600. Next: 700.");
  });
});

/*
 * The day after a miss (closure.md row 14), on one screen: the take's
 * own answer moves the repair the next take is judged from, read back or
 * not. The review (26 Nov): a read that failed after the first take left
 * the screen on its opening state, so the second take, which kept the
 * day, still drew "One more", and the line still asked for two.
 */
describe("a repair carried from take to take on one screen", () => {
  const open: RepairState = { run: 5, missed: new Date(2026, 11, 1), counted: 0 };
  const at = new Date(2026, 11, 2, 19);
  const cueAtOpen = recordCue({ reps: [], starMap: {}, streak: streak({ current: 0 }), xp: 0, repair: open });
  const glanceWay = (repair: RepairState | null) =>
    repairWayOn({ repair, scorable: true, label: DONE_FOR_TODAY, doneForToday: DONE_FOR_TODAY, lesson: false, game: false, boss: false });

  it("asks for one more after the first, and for nothing after the second, with no read between", () => {
    expect(cueAtOpen?.headline).toBe("Two recordings of 20+ words keep a 5-day streak alive");
    const first = repairAfterTake(open, { scorable: true, stored: true, at });
    expect(glanceWay(first)?.tap).toBe("One more");
    const cue1 = cueAfterTake(cueAtOpen, open, first);
    expect(cue1?.headline).toBe("One more of 20+ words keeps a 5-day streak alive");
    expect(cue1?.tone).toBe("earned");
    // The second take is judged from what the first left, not the opening state.
    const second = repairAfterTake(first, { scorable: true, stored: true, at });
    expect(second).toBeNull();
    expect(glanceWay(second)).toBeNull();
    expect(cueAfterTake(cue1, first, second)).toBeNull();
  });

  it("leaves the line alone for a take too short to count, or on a day with no repair", () => {
    const short = repairAfterTake(open, { scorable: false, stored: true, at });
    expect(short).toBe(open);
    expect(cueAfterTake(cueAtOpen, open, short)).toBe(cueAtOpen);
    const plain = recordCue({ reps: [], starMap: {}, streak: streak({ current: 3 }), xp: 0 });
    expect(cueAfterTake(plain, null, null)).toBe(plain);
  });
});

/**
 * The two lines that can meet under Record (the integration of builds 1
 * and 5): the day after a miss, with this phone sure today's 3 scored
 * recordings are used. A capped fourth take still has 20+ words, is stored
 * scorable and keeps the missed day, so the repair's line wins; once the
 * day is kept, the used line takes the slot.
 */
describe("underRecord: the repair's line outranks today's scored recordings used", () => {
  const at = new Date(2026, 11, 2, 19);
  const usedHere = scoredUsed({ uid: "u1", day: localDayKey(at), left: 0 }, { uid: "u1", now: at, free: true });
  const half: RepairState = { run: 5, missed: new Date(2026, 11, 1), counted: 1 };
  const repairLine = recordCue({ reps: [], starMap: {}, streak: streak({ current: 0 }), xp: 0, repair: half });
  const plainLine = recordCue({ reps: [], starMap: {}, streak: streak({ current: 6, didToday: true }), xp: 0 });

  it("keeps the repair's line and holds the used line back while the repair is open", () => {
    expect(usedHere).toBe(true);
    expect(repairLine?.repair).toBe(true);
    const shown = underRecord({ cue: repairLine, usedOnPhone: usedHere, plan: false, premium: false });
    expect(shown.used).toBe(false);
    expect(shown.cue?.headline).toBe("One more of 20+ words keeps a 5-day streak alive");
    // The plan still being read changes nothing for the repair's line.
    expect(underRecord({ cue: repairLine, usedOnPhone: usedHere, plan: null, premium: false }).cue).toBe(repairLine);
    // Before the first counted take too.
    const open = recordCue({ reps: [], starMap: {}, streak: streak({ current: 0 }), xp: 0, repair: { ...half, counted: 0 } });
    expect(underRecord({ cue: open, usedOnPhone: true, plan: false, premium: false }).cue?.headline).toBe(
      "Two recordings of 20+ words keep a 5-day streak alive"
    );
  });

  it("a capped take keeps the day, and then the used line stands", () => {
    // The capped fourth: scorable and stored, with no Ethos score.
    const after = repairAfterTake(half, { scorable: true, stored: true, at });
    expect(after).toBeNull();
    expect(cueAfterTake(repairLine, half, after)).toBeNull();
    // The rows say the same: the second take of the day is the capped one.
    const iso = (month: number, d: number, h: number) => new Date(2026, month, d, h).toISOString();
    const takes = [
      ...[26, 27, 28, 29, 30].map((d) => ({ created_at: iso(10, d, 18), scorable: true, ethos_index: 640 })),
      { created_at: iso(11, 2, 9), scorable: true, ethos_index: 650 },
      { created_at: iso(11, 2, 19), scorable: true, ethos_index: null },
    ];
    expect(keptDays(takes, [], at, "2026-11-27").map((d) => d.getDate())).toEqual([1]);
    // Read back, the cue is the plain one, and the used line takes its place.
    const shown = underRecord({ cue: plainLine, usedOnPhone: usedHere, plan: false, premium: false });
    expect(shown).toEqual({ cue: null, used: true });
    expect(SCORED_USED).toBe("You've used today's 3 scored recordings. Ethos score back tomorrow.");
  });

  it("says nothing while the plan is unread, and never to Premium", () => {
    expect(underRecord({ cue: plainLine, usedOnPhone: true, plan: null, premium: false })).toEqual({ cue: null, used: false });
    expect(underRecord({ cue: plainLine, usedOnPhone: true, plan: true, premium: false })).toEqual({ cue: plainLine, used: false });
    expect(underRecord({ cue: plainLine, usedOnPhone: true, plan: false, premium: true })).toEqual({ cue: plainLine, used: false });
    expect(underRecord({ cue: plainLine, usedOnPhone: false, plan: false, premium: false })).toEqual({ cue: plainLine, used: false });
  });
});

describe("takeRewards", () => {
  // Two words in five seconds, after takes at 5 and 3 fillers a minute.
  const prior = [rep({ filler_count: 5 }), rep({ filler_count: 3 })];
  const twoWords = metrics({
    durationS: 5,
    wordCount: 2,
    wpm: 24,
    fillerCount: 0,
    fillersPerMin: 0,
    heldPauses: 0,
    midSentencePauses: 0,
  });
  const base = { prior, metrics: twoWords, ethosIndex: null, repCount: 9 };

  it("breaks no record on a take too short to score", () => {
    const r = takeRewards({ ...base, scorable: false, streak: streak({ current: 1, didToday: true }) });
    expect(r.bests).toEqual([]);
  });

  it("ends an unscored take on the count, never a number read off it", () => {
    const r = takeRewards({ ...base, scorable: false, streak: streak({ current: 1, didToday: true }) });
    expect(r.closing.headline).toBe("Recording 9 logged");
    expect(`${r.closing.headline} ${r.closing.detail}`).not.toMatch(/filler|clean|words a minute|pause|measured/i);
  });

  it("ends an unscored take on the streak when there is one", () => {
    const r = takeRewards({ ...base, scorable: false, streak: streak({ current: 7, didToday: true }) });
    expect(r.closing.headline).toBe("7 days running");
    expect(r.closing.tone).toBe("earned");
  });

  it("leaves a scored take to the records and the end note", () => {
    /* A take and a history that measured something (lib/rewards.ts only
       holds records on those): enough words to score, on both sides. */
    const said =
      "The best part of my week was a long walk by the river with my sister after work on Friday, talking about nothing much.";
    const measuredPrior = prior.map((r) => ({ ...r, transcript: said }));
    const m = metrics({ substance: substance(said), fillersPerMin: 1, fillerCount: 1, composedPauses: 1 });
    const s = streak({ current: 3, didToday: true });
    const r = takeRewards({ ...base, prior: measuredPrior, metrics: m, ethosIndex: 640, scorable: true, streak: s });
    expect(r.bests).toEqual(personalBests(measuredPrior, m, 640));
    expect(r.bests.length).toBeGreaterThan(0);
    expect(r.closing).toEqual(endNote({ metrics: m, streak: s, repCount: 9 }));
  });
});

describe("takeRewards, a game round's best (M4)", () => {
  const said =
    "The best part of my week was a long walk by the river with my sister after work on Friday, talking about nothing much.";
  const m = metrics({ substance: substance(said), fillersPerMin: 1, fillerCount: 1 });
  const base = {
    prior: [],
    metrics: m,
    ethosIndex: 640,
    repCount: 9,
    streak: streak({ current: 3, didToday: true }),
  };

  it("leads the records with Best round yet when the level's best went up", () => {
    const r = takeRewards({
      ...base,
      scorable: true,
      gameBest: { game: "qa", level: 2, before: 22, now: 31 },
    });
    expect(r.bests[0]).toEqual({
      headline: "Best round yet",
      detail: "31s clean after the cut-in, past your 22s",
      tone: "earned",
      record: { value: "31s", rest: "clean after the cut-in", past: "past your 22s" },
    });
  });

  it("breaks nothing on a first round, a tie, or a take too short to score", () => {
    expect(takeRewards({ ...base, scorable: true, gameBest: { game: "qa", level: 1, before: null, now: 20 } }).bests).toEqual([]);
    expect(takeRewards({ ...base, scorable: true, gameBest: { game: "rush", level: 1, before: 4, now: 4 } }).bests).toEqual([]);
    expect(takeRewards({ ...base, scorable: false, gameBest: { game: "qa", level: 1, before: 10, now: 30 } }).bests).toEqual([]);
  });
});

describe("roundChimes (F5)", () => {
  it("plays on the round's real win, once", () => {
    expect(roundChimes({ win: true, played: false })).toBe(true);
    expect(roundChimes({ win: true, played: true })).toBe(false);
  });

  it("never on a miss", () => {
    expect(roundChimes({ win: false, played: false })).toBe(false);
  });

});

describe("thinksFirst", () => {
  it("opens think time before a take when it is on", () => {
    expect(thinksFirst(true, false)).toBe(true);
    expect(thinksFirst(false, false)).toBe(false);
  });

  it("lets Record start the take once the think time ran out", () => {
    // It used to open another thirty seconds, so the countdown never
    // led to a recording.
    expect(thinksFirst(true, true)).toBe(false);
  });
});

describe("the recording screen's back link", () => {
  it("sends a game back to Practice, where it was opened", () => {
    const game = resolveRepConfig({ game: "qa", q: "qa1" });
    expect(game.lessonId.startsWith("game:")).toBe(true);
    expect(defaultBack(game)).toBe("/games");
    expect(backLabel(defaultBack(game))).toBe("Practice");
  });

  it("keeps a boss on Boss and everything else on Today", () => {
    expect(defaultBack(resolveRepConfig({ boss: "crispr" }))).toBe("/boss");
    expect(defaultBack(resolveRepConfig({ lesson: "h4" }))).toBe("/");
    expect(backLabel("/")).toBe("Today");
  });

  it("names every place it can go", () => {
    expect(backLabel("/boss/crispr")).toBe("Weekly boss");
    expect(backLabel("/boss?from=today")).toBe("Weekly boss");
    expect(backLabel("/lessons/h4?from=today")).toBe("Lesson");
    expect(backLabel("/practice/x")).toBe("Lesson");
    expect(backLabel("/games#qa")).toBe("Practice");
    expect(backLabel("/you")).toBe("Back");
  });
});

describe("exitBeat (#427): at most one beat per exit, and none between practices", () => {
  /* #430 took the reminder ask off the exit and onto the glance (people
     glance and leave), so its beat and its expectations here are gone:
     that move is the point. The rest is unchanged. */
  const none = { gate: false, tasteDue: false, proDue: false, leaves: true, streakDue: false };
  it("never shows Since day one on an exit that stays (Practice N of 3, Another round, Retake)", () => {
    for (const proDue of [true, false]) {
      const beat = exitBeat({ ...none, leaves: false, proDue });
      expect(beat === "pro").toBe(false);
    }
  });
  it("puts the save wall over every other ask, on any exit", () => {
    expect(exitBeat({ gate: true, tasteDue: true, proDue: true, leaves: true, streakDue: false })).toBe("gate");
    expect(exitBeat({ ...none, gate: true, leaves: false })).toBe("gate");
  });
  it("orders the rest: the taste, then Since day one, one at a time", () => {
    expect(exitBeat({ ...none, tasteDue: true, proDue: true })).toBe("taste");
    expect(exitBeat({ ...none, proDue: true })).toBe("pro");
    expect(exitBeat(none)).toBeNull();
  });
});

describe("exitBeat and the streak's moment (#480): after the results, before Today", () => {
  const none = { gate: false, tasteDue: false, proDue: false, leaves: true, streakDue: false };
  it("plays the moment first on an exit that leaves, whatever else is due", () => {
    expect(exitBeat({ ...none, streakDue: true })).toBe("streak");
    expect(exitBeat({ gate: true, tasteDue: true, proDue: true, leaves: true, streakDue: true })).toBe("streak");
  });
  it("never between a lesson's practices, on Another round or on Retake: it waits, owed", () => {
    expect(exitBeat({ ...none, leaves: false, streakDue: true })).toBeNull();
    // The asks of a staying exit are unchanged by an owed moment.
    expect(exitBeat({ ...none, leaves: false, streakDue: true, tasteDue: true })).toBe("taste");
    expect(exitBeat({ ...none, leaves: false, streakDue: true, gate: true })).toBe("gate");
  });
  it("after Continue, goes on through the asks in their order, at most one, and never replays the moment", () => {
    const after = { ...none, streakDue: true, afterStreak: true };
    expect(exitBeat(after)).toBeNull();
    expect(exitBeat({ ...after, gate: true, tasteDue: true, proDue: true })).toBe("gate");
    expect(exitBeat({ ...after, tasteDue: true, proDue: true })).toBe("taste");
    expect(exitBeat({ ...after, proDue: true })).toBe("pro");
  });
  it("never starves Since day one for someone who speaks once a day (#480 review)", () => {
    /* Day 3 onwards, one take a day: the day's first take owes the moment,
       and its exit is the only exit that leaves that day. Walk a week of
       such days with Since day one due from day 3 and see it shown. */
    let proShown = false;
    for (let day = 1; day <= 7 && !proShown; day++) {
      const due = { ...none, streakDue: true, proDue: day >= 3 && !proShown };
      expect(exitBeat(due)).toBe("streak");
      if (exitBeat({ ...due, afterStreak: true }) === "pro") proShown = true;
    }
    expect(proShown).toBe(true);
  });
  it("lets a free account's taste follow the moment on the round that spent today's free play", () => {
    // The taste is due once, on that round's own exit; there is no later one.
    const due = { ...none, streakDue: true, tasteDue: true };
    expect(exitBeat(due)).toBe("streak");
    expect(exitBeat({ ...due, afterStreak: true })).toBe("taste");
  });
});
