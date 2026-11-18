import { describe, expect, it } from "vitest";
// @ts-expect-error: the cameras' fixtures are plain JavaScript.
import { LEVEL_MIX, reps as FIXTURE_REPS } from "../scripts/look-fixtures.mjs";
import { achievements } from "./achievements";
import { buildChallenge } from "./challenge";
import { LIST_COLUMNS, type RepRow } from "./client-data";
import { fillerTrend } from "./dimension-rows";
import { aboutSeconds, lineFigure, runFigure, todayHref, todaysPractice } from "./home";
import { lessonProgress } from "./lesson-progress";
import { bestRecording, sinceDayOne } from "./log";
import { substance } from "./metrics";
import { starsByLesson } from "./path";
import { nextMilestones } from "./progress";
import { substanceColumns, withTranscripts } from "./rep-substance";
import { computeStreak } from "./streak";
import { measured, readTraitsFromRow } from "./trait-readings";
import { traitLevels } from "./traits";

/*
 * #511 review: the lists stopped reading every transcript and read 0037's
 * three columns instead (lib/client-data.ts LIST_COLUMNS). Over the
 * cameras' own recordings, every reader Today, the streak, the road, the
 * pool, the Log and You run on the list must answer exactly what it
 * answered from the whole rows it read before: the columns as the server
 * writes them (lib/db.ts saveRep, from the stored transcript), and a row
 * stored by an older server after 0037 (columns empty) with its
 * transcript read on its own.
 */

type Whole = RepRow & { transcript: string } & Record<string, unknown>;

const listed = LIST_COLUMNS.split(",").map((c) => c.trim());

/** What the list read returns for a stored row: its listed columns, the three written from its transcript. */
function asListed(row: Whole): RepRow {
  const out: Record<string, unknown> = {};
  for (const c of listed) if (c in row) out[c] = row[c];
  return { ...(out as unknown as RepRow), ...substanceColumns(substance(row.transcript))! };
}

/** The same, from an older server after 0037: the three empty, so the read hands it its transcript. */
function asListedEmpty(row: Whole): RepRow {
  const out: Record<string, unknown> = {};
  for (const c of listed) if (c in row) out[c] = row[c];
  return { ...(out as unknown as RepRow), scorable: null, word_count: null, distinct_words: null };
}

const NOW = new Date();

function everything(rows: RepRow[]) {
  const streak = computeStreak(rows.map((r) => new Date(r.created_at)), NOW);
  const badges = achievements(rows);
  const challenge = buildChallenge(rows, NOW);
  return {
    streak,
    practice: todaysPractice(rows, NOW, "all"),
    href: todayHref(rows, NOW, "all"),
    run: runFigure(rows),
    line: lineFigure(challenge),
    about: aboutSeconds(rows),
    trend: fillerTrend({ reps: rows, complete: true, now: { fillerCount: 3, durationS: 60 }, at: NOW }),
    trendThin: fillerTrend({ reps: rows, complete: true, now: { fillerCount: 0, durationS: 8, scorable: false }, at: NOW }),
    dayOne: sinceDayOne(rows) && { first: sinceDayOne(rows)!.first.id, last: sinceDayOne(rows)!.last.id },
    best: bestRecording(rows)?.id ?? null,
    lessons: lessonProgress(rows),
    stars: starsByLesson(rows),
    levels: traitLevels(rows),
    badges,
    milestones: nextMilestones({ reps: rows, starMap: starsByLesson(rows), streak, xp: 500, freezesEquipped: 0, achievements: badges }),
    measured: rows.map((r) => measured(r)),
    traits: rows.map((r) => readTraitsFromRow(r as Parameters<typeof readTraitsFromRow>[0])),
  };
}

describe("the list read over the cameras' recordings", () => {
  const sets: [string, Whole[]][] = [
    ["three weeks of practice", FIXTURE_REPS as Whole[]],
    ["the fourteen of LEVEL_MIX", LEVEL_MIX as Whole[]],
  ];

  for (const [name, set] of sets) {
    const whole = [...set].sort((a, b) => a.created_at.localeCompare(b.created_at));

    it(`answers what the whole rows answered: ${name}`, () => {
      expect(whole.length).toBeGreaterThan(5);
      // Both sides of the line are in the set, so the columns are read for both.
      const verdicts = whole.map((r) => substanceColumns(substance(r.transcript))!.scorable);
      expect(verdicts).toContain(true);
      expect(everything(whole.map(asListed))).toEqual(everything(whole));
    });

    it(`answers it again for rows an older server stored after 0037: ${name}`, async () => {
      const byId = new Map(whole.map((r) => [r.id, r.transcript]));
      const reads: string[][] = [];
      const rows = await withTranscripts(whole.map(asListedEmpty), async (ids) => {
        reads.push(ids);
        return ids.map((id) => ({ id, transcript: byId.get(id) ?? null }));
      });
      expect(reads).toHaveLength(1);
      expect(everything(rows)).toEqual(everything(whole));
    });
  }
});
