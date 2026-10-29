import { introDue, introHref, UNITS } from "@/lib/path";
import { repHref } from "@/lib/rep-config";

/**
 * The Log's empty table, "Waiting to be logged" (#213, notes1): the
 * first three lessons on the road, numbered, each with a Go that opens
 * its recording. It starts a lesson the way Today's Start does: with
 * intros on, a unit nobody has scored in yet shows its teaching screen
 * first (#210), whose Start then opens the lesson this row named; with
 * them off, straight to the recording, by the route the debrief's "Next
 * lesson" and the achievements use.
 */
export interface WaitingRow {
  id: string;
  /** Its place in the queue, drawn in the date tile. */
  n: number;
  title: string;
  href: string;
  /** The Go's name for a screen reader: the visible word first. */
  label: string;
}

export function waitingRows(count = 3, { intros = true }: { intros?: boolean } = {}): WaitingRow[] {
  const unit = UNITS[0];
  // The table only shows with nothing logged, so no lesson has a star.
  const teach = intros && introDue(unit, {});
  return unit.lessons.slice(0, count).map((lesson, i) => ({
    id: lesson.id,
    n: i + 1,
    title: lesson.title,
    href: teach ? introHref(unit.id, [], lesson.id) : repHref({ lesson: lesson.id }),
    label: `Go: ${lesson.title}`,
  }));
}
