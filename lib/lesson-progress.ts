/**
 * How much of a lesson is done (DECISIONS #269).
 *
 * There is no lesson-progress table and no localStorage key for this.
 * The only durable record of "I practised that" is the `lesson_id`
 * stored on a recording, so progress is DERIVED from the log rather
 * than tracked beside it. That is deliberate: a counter that can drift
 * from the recordings is a counter that will, and the recordings are
 * the thing the whole product is made of.
 *
 * A lesson's practice N writes `lesson:<id>:<n>`. The namespace matters
 * for a reason found the hard way (#271): `resolveRepConfig` used to
 * fall back to today's rotation for any id it did not recognise, so an
 * unnamespaced lesson id filed its star against a real road lesson and
 * moved unit gates that nobody had earned.
 */

import { LESSONS, type Lesson } from "@/content/lessons";

/** What a recording started from practice `n` of `lesson` is filed as. */
export function practiceLessonId(lessonId: string, n: number): string {
  return `lesson:${lessonId}:${n}`;
}

/** The lesson and practice a stored id came from, or null. */
export function parsePracticeId(
  stored: string | null | undefined
): { lessonId: string; practice: number } | null {
  if (!stored?.startsWith("lesson:")) return null;
  const [, lessonId, n] = stored.split(":");
  const practice = Number(n);
  if (!lessonId || !Number.isInteger(practice) || practice < 1) return null;
  return { lessonId, practice };
}

/**
 * How many DISTINCT practices of each lesson have a recording.
 *
 * Distinct, so doing practice 1 four times is one of three rather than
 * four of three. Recording it again is worth doing and it is not
 * progress through the lesson.
 */
export function lessonProgress(
  rows: { lesson_id: string | null }[]
): Record<string, number> {
  const seen = new Map<string, Set<number>>();
  for (const r of rows) {
    const hit = parsePracticeId(r.lesson_id);
    if (!hit) continue;
    const set = seen.get(hit.lessonId) ?? new Set<number>();
    set.add(hit.practice);
    seen.set(hit.lessonId, set);
  }
  const out: Record<string, number> = {};
  for (const l of LESSONS) out[l.id] = seen.get(l.id)?.size ?? 0;
  return out;
}

/** The next practice to offer: the first with no recording, else the last. */
export function nextPractice(lesson: Lesson, done: number): number {
  return Math.min(done + 1, lesson.practices.length);
}
