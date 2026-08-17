/**
 * The icon set. One set, drawn here, and no library (DECISIONS #152).
 *
 * Everything is on the same 24px grid at 1.5px stroke in `currentColor`,
 * with no fills — so an icon inherits its colour from the text beside it
 * and can never introduce a hue the theme doesn't know about. The four
 * tab marks are drawn for their own words rather than borrowed from a
 * generic set: Today is a sun over the floor line, because taking the
 * floor is what the tab is for.
 *
 * They are decoration in the strict sense — every one of them sits next
 * to its own label — so they are `aria-hidden` without exception. An
 * icon that ever has to stand alone needs an `aria-label` on its button,
 * not a title in here.
 */

import type { AchievementIcon } from "@/lib/achievements";

function Glyph({
  size = 24,
  children,
}: {
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Today — the sun over the floor you're about to take. */
export function IconToday({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="10.5" r="3.25" />
      <path d="M12 4v1.5M18.4 6.1l-1.1 1.1M20.5 12.5H19M5 12.5H3.5M5.6 6.1l1.1 1.1" />
      <path d="M3.5 17.5h17" />
    </Glyph>
  );
}

/** Path — two stops on a winding road. */
export function IconPath({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx="6.5" cy="5.5" r="1.75" />
      <circle cx="17.5" cy="18.5" r="1.75" />
      <path d="M8.2 6.4c3.1 1 4.3 2.9 3.6 5.6-.7 2.7.6 4.6 4 5.8" />
    </Glyph>
  );
}

/** Log — rows, one per rep. */
export function IconLog({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M4 6.5h1M4 12h1M4 17.5h1" />
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    </Glyph>
  );
}

/** You. */
export function IconYou({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19.5c1.2-3.1 3.5-4.7 6.5-4.7s5.3 1.6 6.5 4.7" />
    </Glyph>
  );
}

/** Locked — on path nodes that a star count hasn't opened yet. */
export function IconLocked({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <rect x="4.75" y="10.5" width="14.5" height="9.25" rx="2.25" />
      <path d="M8.25 10.5V7.75a3.75 3.75 0 0 1 7.5 0v2.75" />
    </Glyph>
  );
}

/** A streak freeze. One earned week of speaking, or 14 coins. */
export function IconFreeze({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M12 3.5v17M4.65 7.75l14.7 8.5M19.35 7.75l-14.7 8.5" />
      <path d="M10.25 5.15 12 6.9l1.75-1.75M10.25 18.85 12 17.1l1.75 1.75" />
    </Glyph>
  );
}

/** The weekly boss. A shield, so the flame can mean streak everywhere. */
export function IconBoss({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M12 3.5 19.5 6v6c0 4-3.1 6.9-7.5 8.5C7.6 18.9 4.5 16 4.5 12V6z" />
      <path d="m9.4 12.1 1.9 1.9 3.4-3.5" />
    </Glyph>
  );
}

/* ---- Achievement marks. Keyed by what they measure, not by badge:
   two streak badges share the flame, two score badges share the line. */

/** Reps. */
export function IconMic({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.75 11.75a6.25 6.25 0 0 0 12.5 0" />
      <path d="M12 18v3" />
    </Glyph>
  );
}

/** Streaks. */
export function IconFlame({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M12 3.5c.6 2.4 2 3.5 3.4 5 1.4 1.5 2.1 3 2.1 4.7a5.5 5.5 0 0 1-11 0c0-1.6.6-2.9 1.8-4" />
      <path d="M12 20.2a2.9 2.9 0 0 1-2.9-2.9c0-1.6 1.4-2.4 2.9-4.6 1.5 2.2 2.9 3 2.9 4.6a2.9 2.9 0 0 1-2.9 2.9z" />
    </Glyph>
  );
}

/** Fillers: the voice itself, metered. */
export function IconWave({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M3.5 11v2M8 7.5v9M12 4.5v15M16 8v8M20.5 11v2" />
    </Glyph>
  );
}

/** Pauses. The signature element, and it looks like one. */
export function IconPause({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M9 5v14M15 5v14" />
    </Glyph>
  );
}

/** Pace. */
export function IconGauge({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M4 17.5a8 8 0 1 1 16 0" />
      <path d="m12 17.5 3.6-5.2" />
    </Glyph>
  );
}

/** The Ethos Index. */
export function IconTrend({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="m3.5 16.5 5.25-5.25 3.5 3.5L20.5 6.5" />
      <path d="M20.5 11.25V6.5H15.75" />
    </Glyph>
  );
}

/** The mark for an achievement, chosen by what it measures. */
export function AchievementMark({
  name,
  size,
}: {
  name: AchievementIcon;
  size?: number;
}) {
  switch (name) {
    case "mic":
      return <IconMic size={size} />;
    case "flame":
      return <IconFlame size={size} />;
    case "wave":
      return <IconWave size={size} />;
    case "pause":
      return <IconPause size={size} />;
    case "gauge":
      return <IconGauge size={size} />;
    case "trend":
      return <IconTrend size={size} />;
  }
}
