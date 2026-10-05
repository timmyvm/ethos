"use client";

import { useId } from "react";
import { IconCheck } from "@/components/Icon";
import { PremiumMark } from "@/components/PremiumMark";
import {
  MAX_STACKED_MODS,
  STRESS_MODS,
  xpMultiplier,
  type StressMod,
} from "@/lib/stress-mods";

/**
 * Difficulty the user opts into. Never suggested, never defaulted on —
 * the app doesn't decide you need it harder today.
 *
 * Mods buy effort credit, never stars (DECISIONS #10, #16, #37), and the
 * numbers say so without a caption: each row's ×N and the running ×N XP
 * total (modes-15).
 *
 * An iOS grouped list (modes-9): one surface, rows parted by hairlines,
 * no tiles inside a card. A chosen row is a trailing ink check, never
 * sage: nothing here has been earned yet (modes-10). A toggle says
 * aria-pressed; a locked row opens the paywall sheet and says so
 * (modes-11). Two at a time; past that the other rows wait, and say why.
 */
export function ModPicker({
  selected,
  onChange,
  premium,
  onPremiumTap,
  head = true,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  premium: boolean;
  onPremiumTap: (mod: StressMod) => void;
  /** The "Stress mods" eyebrow and the running ×N XP. Off where the
   *  row that opened the list already says both (/boss). */
  head?: boolean;
}) {
  const chosen = STRESS_MODS.filter((m) => selected.includes(m.id));
  const multiplier = xpMultiplier(chosen);
  const capId = useId();

  function toggle(mod: StressMod) {
    if (mod.premium && !premium) {
      onPremiumTap(mod);
      return;
    }
    if (selected.includes(mod.id)) {
      onChange(selected.filter((id) => id !== mod.id));
      return;
    }
    if (selected.length >= MAX_STACKED_MODS) return;
    onChange([...selected, mod.id]);
  }

  const full = selected.length >= MAX_STACKED_MODS;

  return (
    <div>
      {head && (
        <div className="flex min-h-5 items-baseline justify-between px-4 pb-2">
          <div className="eyebrow">Stress mods</div>
          {multiplier > 1 && (
            <div className="font-display text-link tabular-nums text-ink">×{multiplier} XP</div>
          )}
        </div>
      )}

      <div className="inset-group">
        {STRESS_MODS.map((mod) => {
          const on = selected.includes(mod.id);
          const locked = mod.premium && !premium;
          const disabled = !on && full && !locked;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => toggle(mod)}
              disabled={disabled}
              aria-pressed={locked ? undefined : on}
              aria-haspopup={locked ? "dialog" : undefined}
              aria-describedby={disabled ? capId : undefined}
              className="press-row group-row flex w-full items-center gap-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span
                  className={`font-display block text-row ${
                    disabled ? "text-stone-400" : "text-ink"
                  }`}
                >
                  {mod.name}
                  {locked && <PremiumMark />}
                </span>
                <span className="mt-0.5 block text-caption text-pretty text-stone-500">
                  {mod.blurb}
                </span>
              </span>
              <span className="font-display shrink-0 text-link tabular-nums text-stone-500">
                ×{mod.xpMultiplier}
              </span>
              {/* The check's slot is always there, so choosing a row
                  never moves its multiplier. */}
              <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center text-ink">
                {on && <IconCheck size={20} />}
              </span>
            </button>
          );
        })}
      </div>

      {full && (
        <p id={capId} className="group-foot">
          Up to 2 at a time.
        </p>
      )}
    </div>
  );
}
