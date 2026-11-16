import { lessonsForTrait } from "@/content/lessons";
import { TRAIT, type TraitId } from "@/content/traits";
import { withFrom } from "./back-from";
import type { RepRow } from "./client-data";
import { upNextLesson } from "./lesson-up-next";
import type { TraitKey } from "./traits";
import { BAND_WORD, bandOf } from "./dimension-rows";
import { fmtRaw, placeSource, placeWords, readTraitsFromRow } from "./trait-readings";

/**
 * What You's trait sheet says about how you speak (D37): the last
 * reading, in the trait's own unit, and where it places you. It
 * explained levels and never showed the number.
 *
 * A taught trait reads the newest recording the way Lessons and the
 * trait page do (readTraitsFromRow), "155 words a minute", and where
 * that places you in words with what it is measured against (#471). A
 * trait the Index only reads has a score out of 100 on the recordings
 * the coach judged, its band, and no percentile. Null when nothing has
 * been read: the sheet draws a dash, never a zero.
 */
export interface SheetReading {
  value: string;
  unit: string;
  /**
   * Where it places you, in words (#471): "Fewer ums and uhs than 72 in
   * 100 speakers" for a taught trait, the row's band ("Strong") for one
   * the coach judges. The ordinal ("72nd percentile") read as more
   * fillers than 72% beside Fillers, and nobody knew what it was against.
   */
  placement: string | null;
  /** What a placement is measured against, said under it; null where there is none. */
  source: string | null;
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
      placement: placeWords(reading),
      source: placeSource(reading.quality),
    };
  }
  for (let i = reps.length - 1; i >= 0; i--) {
    const score = (reps[i].dimensions?.tier2 as Record<string, { score?: number }> | null | undefined)?.[key]?.score;
    if (typeof score === "number" && Number.isFinite(score)) {
      const shown = Math.round(score);
      return { value: String(shown), unit: "/ 100", placement: BAND_WORD[bandOf(shown)], source: null };
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
