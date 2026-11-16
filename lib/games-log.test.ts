import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOSTILE_TAKE_LESSON } from "./client-data";
import { bossWeekRows, gamesLog, roundLine, roundRows, type GamesLogRow } from "./games-log";
import { HOSTILE_TAKE_ID, hostileRecord } from "./hostile";
import type { InterviewRound, QaRound, RushRound } from "./round";

/** #486: the Log's Games side, the weekly boss and every round. */

const at = (m: number, d: number, h = 9) => new Date(2026, m, d, h).toISOString();
const take = (over: Partial<GamesLogRow> & { id: string; created_at: string }): GamesLogRow => ({
  lesson_id: null,
  ethos_index: null,
  ...over,
});
const boss = (id: string, created_at: string, ethos_index: number | null, topic = "great-vowel-shift", score?: number) =>
  take({ id, created_at, lesson_id: `boss:${topic}`, ethos_index, accuracy: score === undefined ? null : { score } });

const qa: QaRound = {
  game: "qa",
  v: 1,
  level: 2,
  cap: 90,
  durationS: 49,
  stoppedBy: "you",
  lastWord: 48.4,
  stars: 3,
  scorable: true,
  counted: true,
  best: 31,
  cutIns: [
    {
      at: 7.4,
      line: "Says who?",
      gap: 1.2,
      gapFrom: 7.6,
      gapTo: 8.8,
      verdict: "held",
      fillerAt: null,
      fillerWord: null,
      cleanAfter: 31,
      spokeAfter: 33.2,
    },
  ],
};
const rush: RushRound = {
  game: "rush",
  v: 1,
  level: 3,
  cap: 20,
  durationS: 17.6,
  stoppedBy: "you",
  lastWord: 17.6,
  stars: 3,
  scorable: true,
  counted: true,
  best: null,
  spare: 2.4,
  landed: true,
};
const verdict = {
  held: { score: 72, citedMoment: "kept the claim", improve: "Name the cost." },
  answered: { score: 64, citedMoment: "answered it", improve: "Shorter." },
  composed: { score: 70, citedMoment: "steady", improve: "Slow down." },
  coachLine: "You held it.",
};

describe("the weekly boss's rows", () => {
  it("is empty before any boss, and never counts a daily take or a game", () => {
    expect(bossWeekRows([])).toEqual([]);
    expect(
      bossWeekRows([
        take({ id: "d", created_at: at(10, 3), lesson_id: "topic:t1", ethos_index: 700 }),
        take({ id: "g", created_at: at(10, 4), lesson_id: "game:qa:qa2", ethos_index: 640 }),
      ])
    ).toEqual([]);
  });

  it("lists each week taken once, newest first, with its topic, Index, date and fact-check", () => {
    const weeks = bossWeekRows([
      boss("old", at(9, 13), 612, "dunning-kruger", 70), // week of 12 Oct
      boss("new", at(10, 4), 684, "great-vowel-shift", 82), // week of 2 Nov
    ]);
    expect(weeks.map((w) => w.id)).toEqual(["new", "old"]);
    expect(weeks[0]).toMatchObject({ topic: "The Great Vowel Shift", index: 684, accuracy: 82, at: at(10, 4) });
    expect(weeks[0].week.getDay()).toBe(1);
    expect(weeks[1].topic).not.toBe("Cold Topic");
  });

  it("counts a week's first scored take, as the lobby and the delta do", () => {
    const weeks = bossWeekRows([
      boss("later", at(10, 5), 690),
      boss("short", at(10, 3), null),
      boss("scored", at(10, 4), 684),
    ]);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].id).toBe("scored");
  });

  it("keeps a week whose only take was too short to score, with no Index and no zero", () => {
    const [w] = bossWeekRows([boss("short", at(10, 3), null)]);
    expect(w.index).toBeNull();
    expect(w.accuracy).toBeNull();
  });

  it("files Sunday night and Monday morning in their own weeks, on the device's calendar", () => {
    const weeks = bossWeekRows([
      boss("sun", new Date(2026, 10, 1, 23, 59).toISOString(), 650),
      boss("mon", new Date(2026, 10, 2, 0, 0).toISOString(), 684),
    ]);
    expect(weeks.map((w) => w.id)).toEqual(["mon", "sun"]);
  });

  it("names a topic it does not know as the boss", () => {
    expect(bossWeekRows([boss("x", at(10, 3), 600, "gone-topic")])[0].topic).toBe("Cold Topic");
  });
});

describe("every round", () => {
  it("lists game rounds and Hostile takes newest first, and nothing else", () => {
    const rounds = roundRows([
      take({ id: "q", created_at: at(10, 3), lesson_id: "game:qa:qa14", ethos_index: 652, round: qa }),
      take({ id: "b", created_at: at(10, 4), lesson_id: "boss:great-vowel-shift", ethos_index: 684 }),
      take({ id: "h", created_at: at(10, 5), lesson_id: HOSTILE_TAKE_ID, ethos_index: 641, round: hostileRecord("zoos", verdict, []) }),
      take({ id: "r", created_at: at(10, 1), lesson_id: "game:rush:ru1", ethos_index: 620, round: rush }),
      take({ id: "d", created_at: at(10, 6), lesson_id: "topic:t1", ethos_index: 700 }),
    ]);
    expect(rounds.map((r) => r.id)).toEqual(["h", "q", "r"]);
  });

  it("says each round's one number in words that stand alone, with the level in its name", () => {
    const [q] = roundRows([take({ id: "q", created_at: at(10, 3), lesson_id: "game:qa:qa14", ethos_index: 652, round: qa })]);
    expect(q).toMatchObject({ kind: "game", name: "Q&A, level 2", line: "Held 1.2s at the cut-in", index: 652 });
    const [r] = roundRows([take({ id: "r", created_at: at(10, 3), lesson_id: "game:rush:ru1", ethos_index: 620, round: rush })]);
    expect(r).toMatchObject({ name: "Speed rush, level 3", line: "Finished 2.4s early" });
  });

  it("says every way a round ends, with its number and never a pronoun with nobody behind it", () => {
    const cut = qa.cutIns[0];
    expect(roundLine({ ...qa, cutIns: [{ ...cut, verdict: "breath", gap: 0.5 }] })).toBe("Paused 0.5s at the cut-in");
    expect(roundLine({ ...qa, cutIns: [{ ...cut, verdict: "through", gap: null }] })).toBe("Talked through the cut-in");
    expect(roundLine({ ...qa, cutIns: [{ ...cut, at: null }] })).toBe("Demos didn't get in");
    expect(roundLine({ ...rush, stoppedBy: "clock", landed: false })).toBe("Clock ran out at 0:20");
    const iv: InterviewRound = {
      game: "interview", v: 1, level: 1, cap: 90, durationS: 74, stoppedBy: "you", lastWord: 73.4, stars: 2,
      scorable: true, counted: true, best: 712, firstWord: 0.6, inWindow: true, numberAtEnd: null, cutIns: [],
    };
    expect(roundLine(iv)).toBe("Ended at 1:13, in time");
    expect(roundLine({ ...iv, inWindow: false, lastWord: 48 })).toBe("Ended at 0:48, 12s short");
    expect(roundLine({ ...iv, inWindow: false, lastWord: 89.7 })).toBe("Ended at 1:29.7, too long");
    expect(roundLine({ ...iv, inWindow: false, stoppedBy: "clock", lastWord: 89.9 })).toBe("Clock ran out at 1:30");
    for (const line of [roundLine(qa), roundLine(rush), roundLine(iv)]) expect(line).not.toMatch(/\bhe\b/);
  });

  it("says Hostile's first verdict out of 100, and nothing it does not have", () => {
    const [h] = roundRows([
      take({ id: "h", created_at: at(10, 5), lesson_id: HOSTILE_TAKE_ID, ethos_index: 641, round: hostileRecord("zoos", verdict, []) }),
    ]);
    expect(h).toMatchObject({ kind: "hostile", name: "Hostile Q&A", line: "Held the claim 72 of 100", index: 641 });
    const [bare] = roundRows([take({ id: "h2", created_at: at(10, 5), lesson_id: HOSTILE_TAKE_ID, ethos_index: null })]);
    expect(bare).toMatchObject({ line: null, index: null });
  });

  it("draws no line for a round stored before 0026, or in a shape it cannot read", () => {
    const rows = roundRows([
      take({ id: "a", created_at: at(10, 3), lesson_id: "game:qa:qa2", ethos_index: 600, round: null }),
      take({ id: "b", created_at: at(10, 4), lesson_id: "game:qa:qa3", ethos_index: 600, round: { game: "rush", level: 1 } }),
    ]);
    expect(rows.map((r) => r.line)).toEqual([null, null]);
    expect(rows.find((r) => r.id === "a")?.name).toBe("Q&A");
  });
});

describe("both lists", () => {
  it("reads one row once, wherever it came from", () => {
    const q = take({ id: "q", created_at: at(10, 3), lesson_id: "game:qa:qa14", ethos_index: 652, round: qa });
    const log = gamesLog([q, q, boss("b", at(10, 4), 684)]);
    expect(log.rounds).toHaveLength(1);
    expect(log.weeks).toHaveLength(1);
  });

  it("files Hostile under the lesson id the server banks it with", () => {
    expect(HOSTILE_TAKE_LESSON).toBe(HOSTILE_TAKE_ID);
  });

  it("says every line in the copy rules' words", () => {
    const src = readFileSync("components/log/GamesLog.tsx", "utf8") + readFileSync("lib/games-log.ts", "utf8");
    expect(src).toContain("Take the weekly boss on <PracticeLink /> and its score lands here.");
    expect(src).toContain("Play a game on <PracticeLink /> and every round lands here.");
    expect(src).not.toMatch(/\b(gym|workout|drill|training)\b/i);
  });
});
