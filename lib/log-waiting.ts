import { UNITS } from "@/lib/path";
import { repHref } from "@/lib/rep-config";

/**
 * The Log's empty table, "Waiting to be logged" (#213, notes1): the
 * first three lessons on the road, numbered, each with a Go that opens
 * its recording. The route is the one the debrief's "Next lesson" and
 * the achievements already use for a lesson on the road, so a Go here
 * and those doors land on the same screen.
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

export function waitingRows(count = 3): WaitingRow[] {
  return UNITS[0].lessons.slice(0, count).map((lesson, i) => ({
    id: lesson.id,
    n: i + 1,
    title: lesson.title,
    href: repHref({ lesson: lesson.id }),
    label: `Go: ${lesson.title}`,
  }));
}
