import { STAT_ICON_SRC, type StatKind } from "@/lib/stat-icons";

/**
 * A stat's 3D icon (#487): the flame, the crowned flame, the freeze, the
 * XP bolt, a game's cup. A plain `<img>` at its own size, so it holds its
 * box before it loads (no shift) and is never `next/image`, whose URL
 * varies per device and could not be precached (#274).
 *
 * Decoration in the strict sense: `alt=""`, because the count beside it
 * carries its words (a chip's sr-only label, a column's label, a row's
 * aria-label). `lit={false}` is the unlit streak, the same file greyed
 * by `.stat-icon[data-lit="false"]` in app/globals.css (per theme, and
 * stronger under Increase Contrast), so lit and unlit are one shape.
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
  /** CSS px, square. */
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a precached file at a fixed path (#274)
    <img
      src={STAT_ICON_SRC[kind]}
      width={size}
      height={size}
      alt=""
      decoding="async"
      draggable={false}
      data-lit={lit ? undefined : "false"}
      className={className ? `stat-icon ${className}` : "stat-icon"}
    />
  );
}
