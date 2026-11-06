import { describe, expect, it } from "vitest";
import type { RepRow } from "./client-data";
import { dimensionPoints, ethosIndex, INDEX_WEIGHTS, pauseScore, type Tier1Scores } from "./index-score";
import { movedRows, skillRows } from "./log";
import { computeMetrics, type Word } from "./metrics";
import { pauseReport, reportJudged, type JudgedPause } from "./pause-quality";
import { celebrates, personalBests } from "./rewards";
import { skillStates } from "./schedule";
import { readTraitsFromRow } from "./trait-readings";
import { repTraitGain } from "./traits";
import { weekView } from "./home";
import { achievements } from "./achievements";
import { insights } from "./insights";

/*
 * Nothing is rescored (DECISIONS #422, Timothy, 6 Nov: "fix it but dont
 * rescore"). A recording stored before the fix keeps the pause list it
 * was shown, two gaps "with a sound in it", and the Pause score and
 * Index it was given, which read those gaps as landings. Every place
 * that reads a stored recording reads its stored numbers, so none of
 * them moves, whatever the stored verdicts now say.
 */

const SENTENCES = [
  "The first thing I learned about speaking is that silence works.",
  "Most people rush because they think a gap means they lost.",
  "When I slow down the room actually leans in toward me.",
  "My manager noticed it during the quarterly review last month.",
  "She said the update finally sounded like a real decision.",
];

function take() {
  const words: Word[] = [];
  let t = 0.4;
  SENTENCES.forEach((s, k) => {
    for (const raw of s.split(" ")) {
      words.push({ word: ` ${raw}`, start: t, end: t + 0.3 });
      t += 0.38;
    }
    if (k < SENTENCES.length - 1) t += 1.4;
  });
  const durationS = Math.round((t + 0.6) * 100) / 100;
  return { words, durationS, metrics: computeMetrics(words, durationS, []) };
}

const TIER2 = { structure: 60, credibility: 60, engagement: 60, confidence: 60 };
const judgedDim = (score: number) => ({ score, citedMoment: '"the first thing"', improve: "Land it." });

/**
 * A row as the route stored it before #422: the pauses judged with the
 * envelope (gaps 1 and 2 voiced, so filled), and the Pause score judged
 * again from the words alone (both gaps landings).
 */
function storedBefore(id: string, createdAt: string): RepRow {
  const tk = take();
  const rate = 20;
  const levels = new Array(Math.ceil(tk.durationS * rate)).fill(0.5);
  tk.metrics.pauses
    .filter((p) => p.kind !== "beat")
    .forEach((p, k) => {
      for (let i = Math.round(p.t * rate); i < Math.round((p.t + p.len) * rate); i++) {
        levels[i] = k === 1 || k === 2 ? 0.3 : 0.02;
      }
    });
  const shown = pauseReport({
    pauses: tk.metrics.pauses,
    words: tk.words,
    fillers: tk.metrics.fillers,
    durationS: tk.durationS,
    envelope: { levels, rate, clock: true },
  });
  const tier1: Tier1Scores = {
    pause: pauseScore(shown.pauses, tk.durationS, tk.words, tk.metrics.fillers),
    fillers: 88,
    repairs: 90,
    pace: 82,
    range: 74,
  };
  return {
    id,
    lesson_id: "f1",
    created_at: createdAt,
    duration_s: tk.durationS,
    transcript: SENTENCES.join(" "),
    wpm: tk.metrics.wpm,
    filler_count: 0,
    fillers: [],
    pauses: shown.pauses,
    stars: tk.metrics.stars,
    focus: "Hold the gap.",
    strength: "Five sentences.",
    supply: null,
    ethos_index: ethosIndex(tier1, TIER2),
    audio_path: null,
    dimensions: {
      tier1,
      anchors: { hedgeCount: 0, restartCount: 0 },
      tier2: {
        structure: judgedDim(60),
        credibility: judgedDim(60),
        engagement: judgedDim(60),
        confidence: judgedDim(60),
      },
    },
    mode: "daily",
    mods: [],
    xp_multiplier: 1,
    boss_topic_id: null,
    accuracy: null,
    capture_mode: "voice",
    delivery_metrics: null,
    presence_score: null,
    delivery_moments: null,
  } as RepRow;
}

const ROWS = [
  storedBefore("a", "2026-11-03T08:00:00.000Z"),
  storedBefore("b", "2026-11-04T08:00:00.000Z"),
  storedBefore("c", "2026-11-05T08:00:00.000Z"),
];
const NOW = new Date("2026-11-06T09:00:00.000Z");

/** The same rows with their pause lists judged afresh from the words alone. */
function rejudged(rows: RepRow[]): RepRow[] {
  return rows.map((r) => {
    const tk = take();
    const words = pauseReport({ pauses: tk.metrics.pauses, words: tk.words, fillers: [], durationS: r.duration_s });
    return { ...r, pauses: words.pauses };
  });
}

/** Everything a stored row shows a number through. */
function readAll(rows: RepRow[]) {
  return {
    moved: movedRows(rows),
    skills: skillRows(rows),
    schedule: skillStates(rows, NOW),
    traits: rows.map((r) => readTraitsFromRow(r)),
    gains: rows.map((r) => repTraitGain(r)),
    week: weekView(rows, NOW),
    achievements: achievements(rows),
    insights: insights(rows),
    bests: personalBests(rows, take().metrics, 900),
    celebrates: [celebrates(rows, 2, 900), celebrates(rows, 2, 600)],
  };
}

describe("a recording stored before #422 keeps its numbers", () => {
  it("is a row whose stored Pause score read its filled gaps as landings", () => {
    const row = ROWS[0];
    const verdicts = (row.pauses as JudgedPause[]).map((p) => p.verdict);
    expect(verdicts.filter((v) => v === "filled")).toHaveLength(2);
    // What the fix would score those verdicts: lower than what was stored.
    const fixed = reportJudged(row.pauses as JudgedPause[], row.duration_s).score;
    expect(fixed).toBeLessThan(row.dimensions!.tier1.pause);
  });

  it("reads its stored Index, Pause score and stars on every path", () => {
    const row = ROWS[2];
    const out = readAll(ROWS);
    const stored = row.dimensions!.tier1.pause;
    expect(out.moved.find((m) => m.key === "index")!.series).toEqual(ROWS.map((r) => r.ethos_index));
    expect(out.skills.find((m) => m.key === "pause")!.series).toEqual(
      ROWS.map(() => dimensionPoints(stored, INDEX_WEIGHTS.pause))
    );
    expect(out.schedule.find((s) => s.skill === "pause")!.score).toBe(stored);
    expect(out.bests.find((b) => b.headline === "Best Ethos yet")?.detail).toBe(`900, past your ${row.ethos_index}`);
    expect(out.celebrates).toEqual([true, false]);
    expect(row.stars).toBe(take().metrics.stars);
  });

  it("gives every path the same answer whatever its stored verdicts say", () => {
    expect(readAll(rejudged(ROWS))).toEqual(readAll(ROWS));
  });
});
