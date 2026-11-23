/**
 * The whole flat set in one place: the six stat drawings and the fifteen
 * lessons' objects, for the readers that need all 21 (the export script,
 * the workbench at app/workbench/icons, tests). The method and the
 * primitives are in primitives.ts.
 *
 * Not for a client component: this pulls in lesson-drawings.ts. A client
 * component draws a stat icon through FlatIcon, which reads
 * stat-drawings.ts only.
 */
import { LESSON_ICONS } from "./lesson-drawings";
import { drawingMarkup } from "./primitives";
import { STAT_ICONS } from "./stat-drawings";

export * from "./primitives";
export { STAT_ICONS, STAT_FLAT_KINDS, type StatFlatKind } from "./stat-drawings";
export {
  LESSON_ICONS,
  LESSON_FLAT_KINDS,
  LESSON_FAMILIES,
  LESSON_OBJECT_KIND,
  type LessonFlatKind,
} from "./lesson-drawings";

export const FLAT_ICONS = { ...STAT_ICONS, ...LESSON_ICONS } as const;
export type FlatKind = keyof typeof FLAT_ICONS;
export const FLAT_KINDS = Object.keys(FLAT_ICONS) as FlatKind[];

/**
 * The whole icon as one SVG string, its colours read from CSS variables
 * (`--fi-<kind>-<role>`), clip ids prefixed with `uid`. Every layer the
 * size keeps is drawn (under 24px the light leaves).
 */
export function iconMarkup(kind: FlatKind, size: number, uid: string): string {
  return drawingMarkup(kind, FLAT_ICONS[kind], size, uid);
}
