import type { ReactNode } from "react";
import { levelLine } from "@/lib/traits";

/**
 * A trait's level, as it reads wherever it shows (#482; Timothy, 16 Nov:
 * "trait levels as bars is bad. it should levels like level 6 and a
 * small bar in sage rounded small to communicate how far u are in level
 * 6"): the words "Level 6" and beside them a short, thin, rounded bar,
 * sage on a quiet track, filled as far as the trait's closest try since
 * that level came (lib/traits.ts `levelPercent`). Level 0 with nothing
 * toward 1 is "Not yet" and draws no bar, so an empty track only ever
 * means a level just reached.
 *
 * One element carries it for a screen reader: a progressbar named for
 * the trait, its value the sentence ("Level 6, 40% of the way to level
 * 7"). Its children are presentational, so "Level 6" is not said twice.
 *
 * `count` draws the number (You's rows count it up); the words around
 * it stay put.
 */
export function LevelMeter({
  name,
  level,
  percent,
  count,
  size = "row",
  className = "",
}: {
  /** The trait's name as the row prints it: the progressbar's name. */
  name: string;
  level: number;
  /** How far into the level, 0 to 99 (TraitLevel.percent). */
  percent: number;
  count?: ReactNode;
  /** "row" in You's list, "sheet" under a trait's sheet's title: the same grammar a step larger. */
  size?: "row" | "sheet";
  className?: string;
}) {
  const line = levelLine({ level, percent });
  const cls = (...names: string[]) => names.filter(Boolean).join(" ");
  if (line.percent === null) {
    return (
      <span data-level="none" data-size={size} className={cls("level-value text-stone-400", className)}>
        {line.value}
      </span>
    );
  }
  return (
    <span
      role="progressbar"
      aria-label={name}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={line.percent}
      aria-valuetext={line.said}
      data-level={level}
      data-size={size}
      className={cls("level-meter", className)}
    >
      <span className={cls("level-value", level === 0 ? "text-stone-400" : "")}>Level {count ?? level}</span>
      <span aria-hidden className="level-track">
        {line.percent > 0 && <span className="level-fill fill" style={{ width: `${line.percent}%` }} />}
      </span>
    </span>
  );
}
