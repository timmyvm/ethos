import { describe, expect, it } from "vitest";
import type { RepRow } from "./client-data";
import { computeMetrics, substance, type RepMetrics } from "./metrics";
import { resolveRepConfig } from "./rep-config";
import {
  backLabel,
  celebratesStreak,
  defaultBack,
  recordCue,
  takeRewards,
  thinksFirst,
} from "./rep-screen";
import { endNote, personalBests } from "./rewards";
import type { StreakState } from "./streak";

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
    expect(cue?.headline).toMatch(/·/);
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
  const base = { prior, metrics: twoWords, ethosIndex: null, gains: [], repCount: 9 };

  it("breaks no record on a take too short to score", () => {
    const r = takeRewards({ ...base, scorable: false, streak: streak({ current: 1, didToday: true }) });
    expect(r.bests).toEqual([]);
  });

  it("ends an unscored take on the count, never a number read off it", () => {
    const r = takeRewards({ ...base, scorable: false, streak: streak({ current: 1, didToday: true }) });
    expect(r.closing.headline).toBe("Recording 9 logged");
    expect(`${r.closing.headline} ${r.closing.detail}`).not.toMatch(/filler|clean|words a minute|pause/i);
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
    expect(r.closing).toEqual(endNote({ gains: [], metrics: m, streak: s, repCount: 9 }));
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
    expect(backLabel("/boss/crispr")).toBe("Boss");
    expect(backLabel("/lessons/h4?from=today")).toBe("Lesson");
    expect(backLabel("/practice/x")).toBe("Lesson");
    expect(backLabel("/games#qa")).toBe("Practice");
    expect(backLabel("/you")).toBe("Back");
  });
});
