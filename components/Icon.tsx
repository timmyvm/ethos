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

/** The weekly boss — a flame, drawn rather than typed. */
export function IconBoss({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M12 3.5c.6 2.4 2 3.5 3.4 5 1.4 1.5 2.1 3 2.1 4.7a5.5 5.5 0 0 1-11 0c0-1.6.6-2.9 1.8-4" />
      <path d="M12 20.2a2.9 2.9 0 0 1-2.9-2.9c0-1.6 1.4-2.4 2.9-4.6 1.5 2.2 2.9 3 2.9 4.6a2.9 2.9 0 0 1-2.9 2.9z" />
    </Glyph>
  );
}
