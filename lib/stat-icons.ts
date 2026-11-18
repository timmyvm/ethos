/**
 * The stat icons (#487): the 3D art that stands for a count or a state,
 * one file each, cut by `scripts/cut-stat-icons.mjs` from the renders in
 * `assets/icons-3d/`.
 *
 *  - `streak`: the flame. Lit once today's recording lands; unlit (the
 *    same file through a grey filter, `.stat-icon[data-lit="false"]`)
 *    on a day not yet spoken and at zero.
 *  - `best`: the flame with a crown, the most days in a row.
 *  - `freeze`: the snowflake, a streak freeze held or for sale.
 *  - `xp`: the purple bolt, XP.
 *  - `trophy`: the gold cup, a game's best at its level.
 *  - `hostile`: a coral speech bubble struck by a yellow bolt, Hostile
 *    Q&A, the claim you argue under fire (#503).
 *  - `boss`: a sky mountain with a red pennant on its snow cap, the
 *    weekly boss, the week's big climb (#503).
 *
 * The last two mark a mode, not a count: they live here because they are
 * the same kind of file (a Higgsfield render in the same family, one cut,
 * one precache, one plain img), and a second component would be this
 * one again. They are never drawn unlit.
 *
 * Controls and the tab bar stay line icons (components/Icon.tsx), as
 * Duolingo's do: a thing you press is drawn, a thing you earned is an
 * object.
 */
export const STAT_KINDS = ["streak", "best", "freeze", "xp", "trophy", "hostile", "boss"] as const;
export type StatKind = (typeof STAT_KINDS)[number];

/** Where each kind's file is served from (public/). */
export const STAT_ICON_SRC: Record<StatKind, string> = {
  streak: "/icons/3d/streak.webp",
  best: "/icons/3d/best.webp",
  freeze: "/icons/3d/freeze.webp",
  xp: "/icons/3d/xp.webp",
  trophy: "/icons/3d/trophy.webp",
  hostile: "/icons/3d/hostile.webp",
  boss: "/icons/3d/boss.webp",
};

/**
 * The files are cut at 192px square: 3x the largest place one is drawn
 * (64pt, the streak moment's flame). A file over this many bytes was cut
 * wrong (lib/stat-icons.test.ts).
 */
export const STAT_ICON_PX = 192;
export const STAT_ICON_MAX_BYTES = 14_000;
