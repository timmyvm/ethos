"use client";

import { Segmented } from "@/components/ui/Segmented";
import type { LevelN } from "@/lib/games";
import { levelChoices, xpLabel } from "@/lib/round-live";

/**
 * A game's level on the idle recording screen (the games plan, item 2;
 * M2), in the row the staged mods' chips stood in. One level open: a
 * plain "Level 1" chip. More open: the opened levels on `Segmented`,
 * the locked ones not drawn at all, so nothing here is a door to a rung
 * you have not climbed (money never buys one). Beside it, the XP this
 * level pays when its staging runs, the multiplier the server pays
 * (lib/games.ts `gameXpMultiplier`); nothing at ×1.
 *
 * `open` null is a ladder not read yet (or a failed read): the level on
 * screen stands as a chip, never a guess at what is open. The row holds
 * 44px either way, so nothing moves when the read lands.
 */
export function LevelControl({
  level,
  open,
  xp,
  onChange,
  className = "",
}: {
  level: LevelN;
  open: LevelN | null;
  xp: number;
  onChange: (n: LevelN) => void;
  className?: string;
}) {
  const choices = open === null ? [level] : levelChoices(Math.max(open, level) as LevelN);
  const pays = xpLabel(xp);
  return (
    <div className={`flex min-h-11 flex-wrap items-center gap-2 ${className}`}>
      {choices.length > 1 ? (
        <Segmented<LevelN>
          label="Level"
          value={level}
          onChange={onChange}
          options={choices.map((n) => ({
            value: n,
            label: <span className="whitespace-nowrap px-3">Level {n}</span>,
          }))}
        />
      ) : (
        <span className="rounded-full bg-surface px-2.5 py-1 text-caption font-bold text-ink">
          Level {level}
        </span>
      )}
      {pays && <span className="text-caption font-semibold text-stone-500">{pays}</span>}
    </div>
  );
}
