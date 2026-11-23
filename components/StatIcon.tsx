import { FlatIcon } from "@/components/icons/flat/FlatIcon";
import { STAT_FLAT_KIND, type StatKind } from "@/lib/stat-icons";

/**
 * A stat's mark: the flame, the cup, the freeze, the XP bolt, and the two
 * modes' marks, Hostile Q&A's struck bubble and the weekly boss's
 * mountain. Drawn flat and inline (FlatIcon, the flat set's variant A),
 * so it has no file to wait for: it holds its box and is drawn on the
 * first frame, offline included.
 *
 * Decoration in the strict sense: `aria-hidden`, because the count or
 * the name beside it carries its words (a chip's sr-only label, a
 * column's label, a row's aria-label, a tile's name). `lit={false}` is
 * the unlit streak: the same drawing in its own grey tones
 * (`.fi[data-lit="false"]`, components/icons/flat/flat-icons.css, per
 * theme and firmer under Increase Contrast), never a filter, so lit and
 * unlit are one shape.
 *
 *   <StatIcon kind="streak" lit={!open} size={20} />
 */
export function StatIcon({
  kind,
  lit = true,
  size = 20,
  className = "",
}: {
  kind: StatKind;
  /** False draws it unlit: a day not yet spoken. */
  lit?: boolean;
  /** CSS px, square. Under 24px the drawing drops its light (the size ladder). */
  size?: number;
  /**
   * @deprecated The 3D set's 840px cut for the streak moment. A vector
   * draws every size from one shape, so this changes nothing; kept so a
   * caller that passes it still compiles.
   */
  large?: boolean;
  className?: string;
}) {
  return (
    <FlatIcon
      kind={STAT_FLAT_KIND[kind]}
      size={size}
      lit={lit}
      className={className ? `stat-icon ${className}` : "stat-icon"}
    />
  );
}
