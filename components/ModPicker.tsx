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
    <div className="rounded-[18px] border border-black/5 bg-white lift p-5">
      <div className="flex items-baseline justify-between">
        <div className="label-data">Stress mods · optional</div>
        {multiplier > 1 && (
          <div className="label-data !text-amber-500">×{multiplier} XP</div>
        )}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-stone-500">
        Harder conditions, same measurement. A mod multiplies the XP you
        earn for showing up — it never moves a star or the Index.
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
              className={`flex w-full items-start gap-3 rounded-[14px] border p-3.5 text-left transition-colors ${
                on
                  ? "border-stone-900 bg-stone-900 text-cream"
                  : disabled
                    ? "border-black/5 bg-white opacity-40"
                    : "border-black/10 bg-white"
              }`}
            >
              <span className="flex-1">
                <span className="block text-[14px] font-semibold">
                  {mod.name}
                  {locked && (
                    <span className="ml-1.5 text-[11.5px] font-normal opacity-70">
                      premium
                    </span>
                  )}
                </span>
                <span
                  className={`mt-0.5 block text-[12.5px] leading-relaxed ${
                    on ? "text-cream/70" : "text-stone-500"
                  }`}
                >
                  {mod.blurb}
                </span>
              </span>
              <span
                className={`label-data shrink-0 ${on ? "!text-amber-400" : ""}`}
              >
                ×{mod.xpMultiplier}
              </span>
            </button>
          );
        })}
      </div>

      {full && (
        <p className="mt-2.5 text-[12px] text-stone-400">
          Two at a time. Anything more is a stunt, not training.
        </p>
      )}
    </div>
  );
}
