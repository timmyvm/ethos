import { FlatDrawing } from "./FlatDrawing";
import { LESSON_ICONS, type LessonFlatKind } from "./lesson-drawings";

/**
 * A lesson's object as inline SVG, in its trait's tones. Never unlit: a
 * lesson's object stands for the lesson, not for a count.
 *
 * Server components and the workbench only. A client component that
 * imported this would carry all fifteen drawings into the browser; the
 * app's lesson art is served as files instead.
 *
 *   <FlatLessonIcon kind="gauge" size={120} />
 */
export function FlatLessonIcon({
  kind,
  size = 44,
  className = "",
}: {
  kind: LessonFlatKind;
  /** CSS px, square. */
  size?: number;
  className?: string;
}) {
  return <FlatDrawing kind={kind} def={LESSON_ICONS[kind]} size={size} className={className} />;
}
