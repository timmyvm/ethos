import type { StatFlatKind } from "@/components/icons/flat/stat-drawings";

/**
 * The stat icons: the marks that stand for a count or a state, drawn
 * flat and inline since the flat set (components/icons/flat/, variant A:
 * its own bright palette, the same in both themes). No file, no
 * network: the drawing ships in the page.
 *
 *  - `streak`: the flame. Lit once today's recording lands; unlit (its
 *    own grey tones, `.fi[data-lit="false"]` in flat-icons.css) on a day
 *    not yet spoken and at zero.
 *  - `best`: the most days in a row. The cup.
 *  - `freeze`: the snowflake, a streak freeze held or for sale.
 *  - `xp`: the purple bolt, XP.
 *  - `trophy`: a game's best at its level. The same cup as `best`: the
 *    flat set draws one cup for every best.
 *  - `hostile`: a coral speech bubble struck by a yellow bolt, Hostile
 *    Q&A, the claim you argue under fire (#503).
 *  - `boss`: a blue mountain with a red pennant on its snow cap, the
 *    weekly boss, the week's big climb (#503).
 *
 * The last two mark a mode, not a count, and are never drawn unlit.
 *
 * Controls and the tab bar stay line icons (components/Icon.tsx): a
 * thing you press is drawn as a line, a thing you earned is an object.
 */
export const STAT_KINDS = ["streak", "best", "freeze", "xp", "trophy", "hostile", "boss"] as const;
export type StatKind = (typeof STAT_KINDS)[number];

/** The flat drawing each kind is (components/icons/flat/stat-drawings.ts). */
export const STAT_FLAT_KIND: Record<StatKind, StatFlatKind> = {
  streak: "streak",
  best: "best",
  freeze: "freeze",
  xp: "xp",
  trophy: "best",
  hostile: "hostile",
  boss: "boss",
};
