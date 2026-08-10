/**
 * XP → level. XP measures showing up (DECISIONS #16) — the curve just
 * spaces the milestones: each level needs 50 more XP than the last
 * (L2 at 50, L3 at 150, L4 at 300 …). At 10 XP/rep that's a first
 * level-up inside week one, then a steady grind. Tune in beta.
 */

export interface LevelState {
  level: number;
  intoLevel: number;
  forNext: number;
}

export function xpForLevel(level: number): number {
  // Total XP required to REACH this level.
  return (25 * (level - 1) * level) as number; // 0, 50, 150, 300, 500 …
}

export function levelFromXp(xp: number): LevelState {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const base = xpForLevel(level);
  return {
    level,
    intoLevel: xp - base,
    forNext: xpForLevel(level + 1) - base,
  };
}

/** Monday 00:00 local — the weekly league window (DECISIONS #16). */
export function weekStart(now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return d;
}
