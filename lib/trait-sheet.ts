import { lessonsForTrait } from "@/content/lessons";
import { TRAIT, type TraitId } from "@/content/traits";
import { withFrom } from "./back-from";
import type { RepRow } from "./client-data";
import { upNextLesson } from "./lesson-up-next";
import type { TraitKey } from "./traits";
import { fmtRaw, ordinal, readTraitsFromRow } from "./trait-readings";

/**
 * What You's trait sheet says about how you speak (D37): the last
 * reading, in the trait's own unit, and where it places you. It
 * explained levels and never showed the number.
 *
 * A taught trait reads the newest recording the way Lessons and the
 * trait page do (readTraitsFromRow), "155 wpm" and "72nd percentile". A
 * trait the Index only reads has a score out of 100 on the recordings
 * the coach judged, and no percentile. Null when nothing has been read:
 * the sheet draws a dash, never a zero.
 */
export interface SheetReading {
  value: string;
  unit: string;
  /** "72nd percentile", or null where the trait has no scale. */
  placement: string | null;
}

const TAUGHT = new Set<string>(["pause", "fillers", "repairs", "pace", "range"]);

export function isTaught(key: string): key is TraitId {
  return TAUGHT.has(key);
}

export function sheetReading(key: TraitKey, reps: RepRow[]): SheetReading | null {
  if (reps.length === 0) return null;
  if (isTaught(key)) {
    const reading = readTraitsFromRow(reps[reps.length - 1]).find((r) => r.id === key);
    if (!reading || !Number.isFinite(reading.raw)) return null;
    const value = fmtRaw(reading.raw);
    return {
      value,
      unit: value === "1" ? TRAIT[key].unitOne : TRAIT[key].unit,
      placement: `${ordinal(reading.percentile)} percentile`,
    };
  }
  for (let i = reps.length - 1; i >= 0; i--) {
    const score = (reps[i].dimensions?.tier2 as Record<string, { score?: number }> | null | undefined)?.[key]?.score;
    if (typeof score === "number" && Number.isFinite(score)) {
      return { value: String(Math.round(score)), unit: "/ 100", placement: null };
    }
  }
  return null;
}

/**
 * Where "Practise <trait>" goes (D37): the trait's next lesson, the one
 * the Lessons tab would carry on with inside that trait (started first,
 * then the first not finished, then its first when all three are), so
 * the tap lands on a lesson with its Start, opened from You so its back
 * says You. It went to the trait walk, whose one tap is "Why it
 * matters". `done` is practices recorded per lesson (lessonProgress).
 * Null for the four the Index only reads.
 */
export function practiseHref(key: string, done: Record<string, number> = {}): string | null {
  if (!isTaught(key)) return null;
  const mine = lessonsForTrait(key);
  const next = upNextLesson(done, key, mine) ?? mine[0];
  return next ? withFrom(`/lessons/${next.id}`, "you") : withFrom(`/practice/${key}`, "you");
}
