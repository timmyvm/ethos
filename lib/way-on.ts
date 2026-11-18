import { repHref } from "./rep-config";

/**
 * The results' way on (#427, #493): the one tap's words and where it goes,
 * the same on the glance's shelf and at the foot of "Every number".
 *
 * A game goes round again. A lesson's practice goes to its next practice
 * (or the one still without a take), and its ending names the next lesson
 * as Lessons' Up next has it, or says it is done for today. A take a
 * trait's walk sent goes back to it.
 *
 * Everything else (Today's practice, the boss, a topic of your own) is
 * done for today, the lesson ending's own words, and leaves for Today so
 * the streak's moment plays (#480). It used to name the old road's next
 * drill ("Next lesson: The steady state", lib/drills.ts), a lesson the
 * Lessons tab does not list (the morning tour, 17 Nov): a door onward only
 * ever names a lesson Lessons shows.
 */
export const DONE_FOR_TODAY = "Done for today";

export type WayOn =
  | { kind: "round"; label: string }
  | { kind: "go"; label: string; href: string; leaves: boolean };

export function wayOn(p: {
  /** The game this take was a round of. */
  game: { name: string } | null;
  /** The lesson this take was a practice of (content/lessons.ts). */
  lesson: { id: string; title: string; practices: unknown[] } | null;
  /** The lesson's next practice after this one, or null on its last. */
  nextInLesson: number | null;
  /** On a lesson's last practice, a practice of it still without a take. */
  missingPractice: number | null;
  /** On a lesson's ending, Lessons' Up next with this take in. */
  upNext: { id: string; title: string } | null;
  /** Where a lesson's practice hands back to (its `back`, else the lesson page). */
  lessonBack: string | null;
  /** The address a trait's walk sent this take with, if any. */
  backTo: string | null;
}): WayOn {
  if (p.game) return { kind: "round", label: `Another round: ${p.game.name}` };
  const { lesson } = p;
  if (lesson) {
    const n = p.nextInLesson ?? p.missingPractice;
    if (n !== null) {
      return {
        kind: "go",
        label: `Practice ${n} of ${lesson.practices.length}`,
        href: repHref({ lesson: lesson.id, q: String(n), back: p.lessonBack ?? undefined }),
        leaves: false,
      };
    }
    return p.upNext
      ? { kind: "go", label: `Next lesson: ${p.upNext.title}`, href: `/lessons/${p.upNext.id}`, leaves: true }
      : { kind: "go", label: DONE_FOR_TODAY, href: "/", leaves: true };
  }
  if (p.backTo) return { kind: "go", label: "Back to the lesson", href: p.backTo, leaves: true };
  return { kind: "go", label: DONE_FOR_TODAY, href: "/", leaves: true };
}
