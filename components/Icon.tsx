/**
 * The icon set. One set, drawn here, and no library (DECISIONS #152).
 *
 * Everything is on the same 24px grid at 2.75px stroke in `currentColor`
 * (the Organic redesign's chunky line weight, DECISIONS #165), with no
 * fills — so an icon inherits its colour from the text beside it and
 * can never introduce a hue the theme doesn't know about. The four
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
      strokeWidth={2.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

/*
 * The five tab marks (#290, Timothy's call: "rounded and friendly").
 * Rounder geometry than the rest of the set, and each has a FILLED
 * state for the tab you are on: the active mark is the solid shape,
 * the others are its outline, which is how every common tab bar says
 * "here" (Instagram, YouTube, Duolingo) and reads without the label.
 * Knock-outs inside a filled mark are drawn in the bar's own paper
 * (`fill-raised`, `stroke-raised`), so they stay true in both themes.
 */
/** Today — the sun over the floor you're about to take. */
export function IconToday({ size, active = false }: { size?: number; active?: boolean }) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="10.5" r="3.6" fill={active ? "currentColor" : "none"} />
      <path d="M12 3.2v1.6M18 5.5l-1.15 1.15M20.8 12h-1.6M4.8 12H3.2M6 5.5l1.15 1.15" />
      <path d="M4 18.5h16" />
    </Glyph>
  );
}

/** Games — a die: the same reps, rolled conditions. */
export function IconGames({ size, active = false }: { size?: number; active?: boolean }) {
  const pips = [
    [8.4, 8.4],
    [12, 12],
    [15.6, 15.6],
  ] as const;
  return (
    <Glyph size={size}>
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="5.5"
        fill={active ? "currentColor" : "none"}
      />
      {pips.map(([x, y]) => (
        <circle
          key={x}
          cx={x}
          cy={y}
          r={active ? 1.7 : 1.35}
          stroke="none"
          fill={active ? undefined : "currentColor"}
          className={active ? "fill-raised" : undefined}
        />
      ))}
    </Glyph>
  );
}

/**
 * Lessons — a picture in a frame, because that is what the page is: a
 * set of fifteen commissioned pictures you choose between (#275). A
 * book was the obvious mark and the wrong one; the product positions
 * against courses and theory, and the lessons are practice with a face
 * on them.
 */
export function IconLessons({ size, active = false }: { size?: number; active?: boolean }) {
  return (
    <Glyph size={size}>
      <rect
        x="3"
        y="4.75"
        width="18"
        height="14.5"
        rx="4.5"
        fill={active ? "currentColor" : "none"}
      />
      <path
        d="M6 15.6 9.3 12.2l2.5 2.5 2.5-2.7 3.7 3.6"
        className={active ? "stroke-raised" : undefined}
        strokeWidth={active ? 2.2 : undefined}
      />
      <circle
        cx="8.7"
        cy="9.1"
        r="1.15"
        stroke="none"
        fill={active ? undefined : "currentColor"}
        className={active ? "fill-raised" : undefined}
      />
    </Glyph>
  );
}

/**
 * Premium. An open door, not a padlock.
 *
 * #200 forbids "a padlock over an empty box" and #73 found that a free
 * user SEEING the thing work is a stronger prompt than a lock over it,
 * so a lock would draw the opposite of what the product believes. The
 * app already calls these surfaces doors, in two files, so this is the
 * vocabulary the codebase uses rather than a new metaphor.
 *
 * Two paths, on purpose: at 2.75 stroke on a 24 grid a third line turns
 * to mud under 18px, and the budget is also what stops it growing a
 * shackle later.
 */
export function IconPremium({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      {/* The leaf, swung toward you. */}
      <path d="M13.6 3.9 5.2 6.5v11l8.4 2.6z" />
      {/* The frame it swung out of. */}
      <path d="M13.6 5.3h5.2v13.4h-5.2" />
    </Glyph>
  );
}

/** Log — rows, one per recording. The active state is the same rows, fatter. */
export function IconLog({ size, active = false }: { size?: number; active?: boolean }) {
  return (
    <Glyph size={size}>
      <path d="M5 6.5h14M5 12h14M5 17.5h14" strokeWidth={active ? 3.9 : undefined} />
    </Glyph>
  );
}

/** You. */
export function IconYou({ size, active = false }: { size?: number; active?: boolean }) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="8" r="3.7" fill={active ? "currentColor" : "none"} />
      {active ? (
        <path
          d="M4.6 20.4c.9-4 3.7-6.2 7.4-6.2s6.5 2.2 7.4 6.2z"
          fill="currentColor"
          strokeWidth="2"
        />
      ) : (
        <path d="M5 19.6c1.2-3.2 3.6-4.9 7-4.9s5.8 1.7 7 4.9" />
      )}
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

/*
 * The four streak marks (#253). One per tier, and the change at a
 * boundary is the whole point of having tiers: a counter that only
 * counts has nothing to cross.
 *
 * They escalate as one object rather than four unrelated glyphs — a
 * spark, then the fire it becomes, then the fire carried, then the fire
 * others can see — so crossing a boundary reads as the same thing
 * growing rather than a new badge arriving. `IconFlame` above is tier
 * two and is deliberately reused: it is already the streak's mark
 * everywhere in the app, and the tier it belongs to should be the one
 * most people are standing in.
 */

/** Tier 1, days 1 to 9. A spark: before it is a habit at all. */
export function IconSpark({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M12 3.5v4M12 16.5v4M4.4 12h4M15.6 12h4M6.6 6.6l2.8 2.8M14.6 14.6l2.8 2.8M17.4 6.6l-2.8 2.8M9.4 14.6l-2.8 2.8" />
    </Glyph>
  );
}

/** Tier 3, days 31 to 75. A torch: the fire, carried. */
export function IconTorch({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M12 2.8c.5 1.9 1.7 2.8 2.7 4 1 1.2 1.5 2.3 1.5 3.6a4.2 4.2 0 0 1-8.4 0c0-1.2.5-2.2 1.4-3.1" />
      <path d="M8.6 13.4h6.8l-1 2.2H9.6z" />
      <path d="M10.4 15.6 11 21.2M13.6 15.6 13 21.2" />
    </Glyph>
  );
}

/** Tier 4, day 76 and on. A beacon: the fire others can see. */
export function IconBeacon({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M12 2.6c.5 1.7 1.6 2.5 2.4 3.6.8 1.1 1.2 2 1.2 3.1a3.6 3.6 0 0 1-7.2 0c0-1 .4-1.9 1.2-2.7" />
      <path d="M7.2 13.2h9.6l1.4 3.2H5.8z" />
      <path d="M4.2 19.4h15.6" />
      <path d="M3.4 8.6 1.6 7.4M20.6 8.6l1.8-1.2M4.4 4.2 3.2 2.8M19.6 4.2l1.2-1.4" />
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

/**
 * The disclosure chevron. Points down when closed and is rotated by the
 * caller when open, so the mark itself stays one shape: a control that
 * swaps glyphs mid-tap reads as two controls.
 */
export function IconChevron({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="m6 9.5 6 6 6-6" />
    </Glyph>
  );
}

/*
 * ---- The introduction's answer glyphs (#288). One per option, so an
 * answer is an object to pick rather than a row to read (the reference's
 * mechanic 6). Same grid, same stroke, drawn for their own words. The
 * ones that already existed are reused where the word is the same:
 * Wave for fillers, Gauge for rushing, Freeze for freezing, Spark,
 * Beacon, Boss and You for the four goals.
 */
/** A line that trails into dots: "I trail off". */
export function IconTrail({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M3.5 12h7.5" />
      <circle cx="14.6" cy="12" r="0.9" />
      <circle cx="17.8" cy="12" r="0.9" />
      <circle cx="21" cy="12" r="0.9" />
    </Glyph>
  );
}
/** One flat line: "I sound flat". */
export function IconFlat({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M3.5 12h17" />
    </Glyph>
  );
}
/** A paragraph that keeps going: "I ramble". */
export function IconParagraph({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M4 7h16M4 12h16M4 17h9" />
    </Glyph>
  );
}
/** A cap: class. A board on a stand read as a monitor at this size. */
export function IconCap({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M3 9.5 12 5.5l9 4-9 4z" />
      <path d="M7 11.7v3.8c0 1.6 2.2 2.7 5 2.7s5-1.1 5-2.7v-3.8" />
    </Glyph>
  );
}
/** A case: work. */
export function IconCase({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M9 7.5V5h6v2.5M3.5 12.5h17" />
    </Glyph>
  );
}
/** Two people: dates and friends. */
export function IconPeople({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19.5c1-2.9 3-4.3 5.5-4.3s4.5 1.4 5.5 4.3" />
      <path d="M15.4 5.7a3 3 0 0 1 0 5.6M16.6 15.4c2.1.4 3.4 1.8 3.9 4.1" />
    </Glyph>
  );
}
/** A globe: online. */
export function IconGlobe({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.8 2.6 2.8 14.4 0 17" />
    </Glyph>
  );
}
/**
 * Signal bars lit to a level: how much you have practised. Square,
 * like every bar in the app, and filled rather than stroked because
 * three outlined rects at this stroke are three blobs. The unlit ones
 * keep the shape at the faint step so the scale is visible in every
 * row, not only the top one.
 */
export function IconBars({ size = 24, lit }: { size?: number; lit: 1 | 2 | 3 }) {
  const bars: [number, number][] = [
    [3.5, 14],
    [10, 9],
    [16.5, 4],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      {bars.map(([x, y], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width="4"
          height={20 - y}
          fill="currentColor"
          opacity={i < lit ? 1 : 0.3}
        />
      ))}
    </svg>
  );
}

/* ---- The Tools rows' marks (#292): a glyph per door, one weight. */
/** A speech bubble: Q&A, where Demos cuts in. */
export function IconBubble({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6.5a3 3 0 0 1-3 3h-6.5L6 20v-3.5A3 3 0 0 1 4 13.5z" />
    </Glyph>
  );
}
/** A tray with an arrow up out of it: upload. */
export function IconUpload({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M12 14.5V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15" />
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
