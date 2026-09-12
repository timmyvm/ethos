"use client";

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
 * The multiplier shown is XP, and the card says so: mods buy effort
 * credit, never stars (DECISIONS #10, #16). Two at a time; a third
 * stacked mod is a stunt, not training.
 */
export function ModPicker({
  selected,
  onChange,
  premium,
  onPremiumTap,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  premium: boolean;
  onPremiumTap: (mod: StressMod) => void;
}) {
  const chosen = STRESS_MODS.filter((m) => selected.includes(m.id));
  const multiplier = xpMultiplier(chosen);

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
    <div className="elev-1 rounded-card border border-card-edge bg-raised p-4">
      <div className="flex items-baseline justify-between">
        <div className="label-data">Stress mods · optional</div>
        {multiplier > 1 && (
          <div className="label-data !text-sage-700">×{multiplier} XP</div>
        )}
      </div>
      <p className="mt-1.5 text-caption leading-relaxed text-stone-500">
        Harder conditions, same measurement. A mod multiplies XP, never a
        star or the Index.
      </p>

      <div className="mt-3 space-y-2">
        {STRESS_MODS.map((mod) => {
          const on = selected.includes(mod.id);
          const locked = mod.premium && !premium;
          const disabled = !on && full && !locked;
          return (
            <button
              key={mod.id}
              onClick={() => toggle(mod)}
              disabled={disabled}
              className={`press flex w-full items-start gap-3 rounded-control border p-3 text-left transition-colors ${
                on
                  ? "border-sage-300 bg-sage-100"
                  : disabled
                    ? "border-edge bg-surface !text-stone-300"
                    : "border-edge bg-surface"
              }`}
            >
              <span className="flex-1">
                <span className="font-display block text-[14px] font-bold">
                  {mod.name}
                  {locked && (
                    <span className="ml-1.5 text-caption font-normal text-stone-400">
                      premium
                    </span>
                  )}
                </span>
                <span
                  className={`mt-0.5 block text-caption leading-relaxed ${
                    on ? "text-sage-800" : "text-stone-500"
                  }`}
                >
                  {mod.blurb}
                </span>
              </span>
              <span
                className={`label-micro shrink-0 ${on ? "!text-sage-700" : ""}`}
              >
                ×{mod.xpMultiplier}
              </span>
            </button>
          );
        })}
      </div>

      {full && (
        <p className="mt-2.5 text-caption text-stone-400">
          Two at a time. Anything more is a stunt.
        </p>
      )}
    </div>
  );
}
