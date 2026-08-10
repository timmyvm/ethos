/**
 * Stress mods (mechanics.md shop items): difficulty the user OPTS INTO
 * for a star multiplier. The app never imposes them. They change the
 * conditions of the rep, never the scoring truth — a harder run
 * multiplies stars earned, it does not inflate the metrics.
 */

export interface StressMod {
  id: string;
  name: string;
  blurb: string;
  /** Star multiplier when a rep is completed with this mod on. */
  multiplier: number;
  premium: boolean;
}

export const STRESS_MODS: StressMod[] = [
  {
    id: "no-notes",
    name: "No notes",
    blurb: "The prompt disappears the moment you hit record.",
    multiplier: 1.25,
    premium: false,
  },
  {
    id: "tight",
    name: "Tight timer",
    blurb: "45 seconds instead of 90. Compress or get cut off.",
    multiplier: 1.5,
    premium: true,
  },
  {
    id: "crowd",
    name: "Crowd noise",
    blurb: "Café ambience in your ears while you speak.",
    multiplier: 1.5,
    premium: true,
  },
  {
    id: "interrupt",
    name: "Mid-rep interruption",
    blurb: "Demos cuts in once. Recover and keep the thread.",
    multiplier: 2,
    premium: true,
  },
];

export function modById(id: string | null): StressMod | null {
  return STRESS_MODS.find((m) => m.id === id) ?? null;
}
