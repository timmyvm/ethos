import { FlatDrawing } from "./FlatDrawing";
import { STAT_ICONS, type StatFlatKind } from "./stat-drawings";

/**
 * A stat's flat icon: the streak's flame, XP's bolt, the best's cup, the
 * freeze's snowflake, and Today's two games' marks (Hostile Q&A's struck
 * bubble, the weekly boss's mountain). One look, variant A's: its own
 * bright palette, the same in both themes (flat-icons.css).
 *
 * Stat kinds only, on purpose: this is the one a client component may
 * import, and it reads stat-drawings.ts and nothing else, so the lessons'
 * objects (lesson-drawings.ts, FlatLessonIcon) stay out of the browser.
 *
 * The size ladder: under 24px an icon is its base and shade only (the
 * light leaves, as Duolingo's own small art drops detail before it
 * blurs); the freeze's thin light waits for 32px.
 *
 *   <FlatIcon kind="streak" size={22} lit={false} />
 */
export function FlatIcon({
  kind,
  size = 24,
  lit = true,
  className = "",
}: {
  kind: StatFlatKind;
  /** CSS px, square. */
  size?: number;
  /** False draws it unlit: a day not yet spoken (its own grey tones, not a filter). */
  lit?: boolean;
  className?: string;
}) {
  return <FlatDrawing kind={kind} def={STAT_ICONS[kind]} size={size} lit={lit} className={className} />;
}
