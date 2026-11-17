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
 *
 * Controls and the tab bar stay line icons (components/Icon.tsx), as
 * Duolingo's do: a thing you press is drawn, a thing you earned is an
 * object.
 */
export const STAT_KINDS = ["streak", "best", "freeze", "xp", "trophy"] as const;
export type StatKind = (typeof STAT_KINDS)[number];

/** Where each kind's file is served from (public/). */
export const STAT_ICON_SRC: Record<StatKind, string> = {
  streak: "/icons/3d/streak.webp",
  best: "/icons/3d/best.webp",
  freeze: "/icons/3d/freeze.webp",
  xp: "/icons/3d/xp.webp",
  trophy: "/icons/3d/trophy.webp",
};

/**
 * The files are cut at 192px square: 3x the largest place one is drawn
 * at 64pt. A file over this many bytes was cut wrong
 * (lib/stat-icons.test.ts).
 */
export const STAT_ICON_PX = 192;
export const STAT_ICON_MAX_BYTES = 14_000;

/**
 * The one icon drawn large, the streak moment's flame (#480), which
 * takes the screen's free height up to 340pt since #496: its own cut at
 * the render's own resolution (scripts/cut-stat-icons.mjs `LARGE`), so a
 * 3x phone never stretches the 192px file five times over.
 */
export const STAT_ICON_LARGE_SRC: Partial<Record<StatKind, string>> = {
  streak: "/icons/3d/streak-large.webp",
};
export const STAT_ICON_LARGE_PX = 840;
export const STAT_ICON_LARGE_MAX_BYTES = 48_000;
