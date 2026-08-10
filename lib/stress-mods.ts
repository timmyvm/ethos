/**
 * Stress mods (mechanics.md shop items): difficulty the user OPTS INTO.
 * The app never imposes them.
 *
 * They multiply XP, never stars. DECISIONS #16 makes XP the effort
 * currency that boss and mod multipliers feed, and #10 keeps stars tied
 * to objective metric thresholds — so a harder rep earns more credit for
 * showing up and exactly the same credit for quality. A mod changes the
 * conditions of the rep; it never touches the measurement.
 */

export type ModEffect =
  | "hide-prompt"
  | "tight-timer"
  | "crowd-noise"
  | "interrupt";

export interface StressMod {
  id: string;
  name: string;
  blurb: string;
  /** XP multiplier when a rep is completed with this mod on. */
  xpMultiplier: number;
  premium: boolean;
  effect: ModEffect;
}

export const STRESS_MODS: StressMod[] = [
  {
    id: "no-notes",
    name: "No notes",
    blurb: "The prompt disappears the moment you hit record.",
    xpMultiplier: 1.25,
    premium: false,
    effect: "hide-prompt",
  },
  {
    id: "tight",
    name: "Tight timer",
    blurb: "45 seconds instead of 90. Compress or get cut off.",
    xpMultiplier: 1.5,
    premium: true,
    effect: "tight-timer",
  },
  {
    id: "crowd",
    name: "Crowd noise",
    blurb: "Café ambience in your ears while you speak.",
    xpMultiplier: 1.5,
    premium: true,
    effect: "crowd-noise",
  },
  {
    id: "interrupt",
    name: "Mid-rep interruption",
    blurb: "Demos cuts in once. Recover and keep the thread.",
    xpMultiplier: 2,
    premium: true,
    effect: "interrupt",
  },
];

/** Two at a time. Three stacked mods is a stunt, not training. */
export const MAX_STACKED_MODS = 2;

/** Hard ceiling on stacked XP so grinding mods can't outrun reps. */
export const MAX_XP_MULTIPLIER = 3;

export function modById(id: string | null | undefined): StressMod | null {
  if (!id) return null;
  return STRESS_MODS.find((m) => m.id === id) ?? null;
}

/**
 * Resolve a comma-separated mod list from a URL. Unknown ids are
 * dropped, duplicates collapse, premium mods fall away without an
 * entitlement, and the list is capped — a hand-typed URL can't grant
 * itself a multiplier.
 */
export function parseMods(
  raw: string | null | undefined,
  opts: { premium?: boolean } = {}
): StressMod[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: StressMod[] = [];
  for (const part of raw.split(",")) {
    const mod = modById(part.trim());
    if (!mod || seen.has(mod.id)) continue;
    if (mod.premium && !opts.premium) continue;
    seen.add(mod.id);
    out.push(mod);
    if (out.length === MAX_STACKED_MODS) break;
  }
  return out;
}

/** Product of the active multipliers, capped and rounded to 2dp. */
export function xpMultiplier(mods: StressMod[], base = 1): number {
  const raw = mods.reduce((acc, m) => acc * m.xpMultiplier, base);
  return Math.round(Math.min(MAX_XP_MULTIPLIER, raw) * 100) / 100;
}

export function modIds(mods: StressMod[]): string[] {
  return mods.map((m) => m.id);
}
