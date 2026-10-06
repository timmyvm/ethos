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
  weight = 2.75,
  children,
}: {
  size?: number;
  /** Stroke width on the 24 grid. The tab marks run lighter (#322). */
  weight?: number;
  children: React.ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
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
/*
 * The five tab marks were redrawn on 27 Sep in SF Symbols' grammar (the
 * apple-design pass, #322): a 2px line where the rest of the set is
 * 2.75, because a tab bar is read at a glance and Apple's own tab
 * glyphs are the medium weight, not the heavy; every shape closed and
 * rounded so the FILLED state is the same silhouette solid, with
 * knock-outs in the bar's paper (`fill-raised`, `stroke-raised`); and a
 * metaphor people already know for each word:
 *
 *   Today     sun.horizon: the sun rising over the floor line
 *   Lessons   square.grid.2x2: a collection you choose from (the old
 *             picture frame read as the Photos app)
 *   Practice  dice: the same recording, rolled conditions
 *   Log       list.bullet.rectangle: a page of rows, one per recording
 *             (the old three bars read as a menu button, and a menu is
 *             the one thing a tab must never look like)
 *   You       person.crop.circle's person, shoulders and head
 */
const TAB_WEIGHT = 2;

/** Today — the sun rising over the floor you're about to take. */
export function IconToday({ size, active = false }: { size?: number; active?: boolean }) {
  return (
    <Glyph size={size} weight={TAB_WEIGHT}>
      {/* The sun's upper half, closed on the horizon so it can fill. */}
      <path
        d="M6.9 16.6a5.1 5.1 0 0 1 10.2 0z"
        fill={active ? "currentColor" : "none"}
      />
      <path d="M12 4.6v2.2M5.3 9.1l1.55 1.55M18.7 9.1l-1.55 1.55" />
      <path d="M3 16.6h18M8 20.1h8" />
    </Glyph>
  );
}

/** Practice — a die: the same recording, rolled conditions. */
export function IconGames({ size, active = false }: { size?: number; active?: boolean }) {
  const pips = [
    [8.6, 8.6],
    [12, 12],
    [15.4, 15.4],
  ] as const;
  return (
    <Glyph size={size} weight={TAB_WEIGHT}>
      <rect
        x="3.75"
        y="3.75"
        width="16.5"
        height="16.5"
        rx="4.6"
        fill={active ? "currentColor" : "none"}
      />
      {pips.map(([x, y]) => (
        <circle
          key={x}
          cx={x}
          cy={y}
          r={1.5}
          stroke="none"
          fill={active ? undefined : "currentColor"}
          className={active ? "fill-raised" : undefined}
        />
      ))}
    </Glyph>
  );
}

/**
 * Lessons — four tiles, SF Symbols' square.grid.2x2: a collection you
 * choose from (#275). A stack of cards was tried first and read as a
 * jar at 23px; the picture frame before it read as the Photos app.
 */
export function IconLessons({ size, active = false }: { size?: number; active?: boolean }) {
  const at = [3.9, 13.1] as const;
  return (
    <Glyph size={size} weight={TAB_WEIGHT}>
      {at.flatMap((y) =>
        at.map((x) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="7"
            height="7"
            rx="2.1"
            fill={active ? "currentColor" : "none"}
          />
        ))
      )}
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

/** Log — a page of rows with their bullets, one row per recording. */
export function IconLog({ size, active = false }: { size?: number; active?: boolean }) {
  const rows = [8.5, 12, 15.5];
  return (
    <Glyph size={size} weight={TAB_WEIGHT}>
      <rect
        x="3.75"
        y="3.75"
        width="16.5"
        height="16.5"
        rx="4.6"
        fill={active ? "currentColor" : "none"}
      />
      {rows.map((y) => (
        <g key={y} className={active ? "stroke-raised" : undefined}>
          <path d={`M11 ${y}h5`} />
          <circle
            cx="8"
            cy={y}
            r="1.05"
            stroke="none"
            fill={active ? undefined : "currentColor"}
            className={active ? "fill-raised" : undefined}
          />
        </g>
      ))}
    </Glyph>
  );
}

/** You — head and shoulders, the person in person.crop.circle. */
export function IconYou({ size, active = false }: { size?: number; active?: boolean }) {
  return (
    <Glyph size={size} weight={TAB_WEIGHT}>
      <circle cx="12" cy="8.2" r="3.9" fill={active ? "currentColor" : "none"} />
      <path
        d="M4.9 19.9c.7-3.6 3.5-5.8 7.1-5.8s6.4 2.2 7.1 5.8a.9.9 0 0 1-.9 1.05H5.8a.9.9 0 0 1-.9-1.05z"
        fill={active ? "currentColor" : "none"}
      />
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
/** The way back: iOS's left chevron, in the navigation bar. */
export function IconBack({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
    </Glyph>
  );
}

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

/* ---- The Practice tab's row marks (#292): a glyph per door, one weight. */
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

/** Spin a new topic: two arrows crossing, the shuffle everyone knows. */
export function IconShuffle({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M3.5 7h3.2c2.2 0 3.4 1 4.6 3l1.4 4c1.2 2 2.4 3 4.6 3h3.2" />
      <path d="M3.5 17h3.2c1.4 0 2.4-.4 3.2-1.2" />
      <path d="M14.1 8.2C14.9 7.4 15.9 7 17.3 7h3.2" />
      <path d="m18 4.5 2.5 2.5L18 9.5" />
      <path d="m18 14.5 2.5 2.5-2.5 2.5" />
    </Glyph>
  );
}

/** Turn up the difficulty: two sliders. */
export function IconSliders({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M4 8h9" />
      <path d="M19 8h1" />
      <circle cx="16" cy="8" r="2.4" />
      <path d="M4 16h1" />
      <path d="M11 16h9" />
      <circle cx="8" cy="16" r="2.4" />
    </Glyph>
  );
}

/*
 * ---- The design pass's marks (A2). Same grid, same round caps and
 * joins. The four controls Apple draws at the medium weight (gear,
 * pencil, play, pause) take the tab marks' 2px line; the rest keep 2.75.
 */

/** A check: the chosen row in a list (a stress mod, a setting). */
/**
 * The line still to clear: SF Symbols' flag, a pole and a notched
 * pennant. Today's line wears it inside its ring until today's
 * recording closes the line, when IconCheck takes its place.
 */
export function IconFlag({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M6 21V3.5" />
      <path d="M6 4.5h11.5l-2.4 4.25 2.4 4.25H6" />
    </Glyph>
  );
}

export function IconCheck({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Glyph>
  );
}

/** Settings: SF Symbols' gearshape, eight teeth round a hub, 2px line. */
export function IconGear({ size }: { size?: number }) {
  return (
    <Glyph size={size} weight={TAB_WEIGHT}>
      <path d="M10.11 4.95L10.51 2.62L13.49 2.62L13.89 4.95L15.65 5.68L17.58 4.31L19.69 6.42L18.32 8.35L19.05 10.11L21.38 10.51L21.38 13.49L19.05 13.89L18.32 15.65L19.69 17.58L17.58 19.69L15.65 18.32L13.89 19.05L13.49 21.38L10.51 21.38L10.11 19.05L8.35 18.32L6.42 19.69L4.31 17.58L5.68 15.65L4.95 13.89L2.62 13.49L2.62 10.51L4.95 10.11L5.68 8.35L4.31 6.42L6.42 4.31L8.35 5.68z" />
      <circle cx="12" cy="12" r="3" />
    </Glyph>
  );
}

/** Edit: a pencil on the diagonal, its tip at the lower left. */
export function IconPencil({ size }: { size?: number }) {
  return (
    <Glyph size={size} weight={TAB_WEIGHT}>
      <path d="M15.2 4.8a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3L9 19l-4.5 1 1-4.5z" />
      <path d="m13.5 6.5 4 4" />
    </Glyph>
  );
}

/** Play, for the scrubber: a solid, round-cornered triangle. 16px. */
export function IconPlay({ size = 16 }: { size?: number }) {
  return (
    <Glyph size={size} weight={TAB_WEIGHT}>
      <path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.04-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6z" fill="currentColor" />
    </Glyph>
  );
}

/** Pause, for the scrubber: two solid bars. 16px (IconPause is the
    trait's mark, drawn as two lines). */
export function IconPauseSm({ size = 16 }: { size?: number }) {
  return (
    <Glyph size={size} weight={TAB_WEIGHT}>
      <rect x="6.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="3.5" height="14" rx="1" fill="currentColor" />
    </Glyph>
  );
}

/** Speed: a bolt. */
export function IconBolt({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M13.5 3 5.5 13.5h6l-1 7.5 8-10.5h-6z" />
    </Glyph>
  );
}

/** A voice with no shape: IconWave's five bars all at one height, so it
    reads as level where the wave reads as moving. */
export function IconWaveFlat({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M3.5 9.5v5M8 9.5v5M12 9.5v5M16 9.5v5M20.5 9.5v5" />
    </Glyph>
  );
}

/** More: three dots. */
export function IconEllipsis({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      {[5, 12, 19].map((x) => (
        <circle key={x} cx={x} cy="12" r="2.5" fill="currentColor" stroke="none" />
      ))}
    </Glyph>
  );
}

/**
 * A star (duolingo-path s10, log-22): the prize's own shape, points
 * rounded by the set's round join. Earned is solid in the caller's
 * colour; unearned is the same shape as a 1.5px outline at any size
 * (the stroke does not scale), so an empty slot reads as a slot.
 */
export function IconStar({ size, filled = true }: { size?: number; filled?: boolean }) {
  const d = "M12 3.2L14.5 9.16L20.94 9.7L16.04 13.91L17.53 20.2L12 16.85L6.47 20.2L7.96 13.91L3.06 9.7L9.5 9.16z";
  return filled ? (
    <Glyph size={size} weight={2}>
      <path d={d} fill="currentColor" />
    </Glyph>
  ) : (
    <Glyph size={size} weight={1.5}>
      <path d={d} vectorEffect="non-scaling-stroke" />
    </Glyph>
  );
}

/**
 * The coin (B8): the gold disc the Shop's balance and prices wear, as an
 * SVG so HeaderCount sizes it at 18px like every other glyph. Gold is its
 * own fill, never `currentColor`: a coin is a picture, not ink. The
 * gradient's id is fixed; every copy defines the same one, so whichever
 * the document resolves first draws them all alike.
 */
export function IconCoin({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <defs>
        <radialGradient id="ethos-coin-fill" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffe7a3" />
          <stop offset="45%" stopColor="#f2c14e" />
          <stop offset="100%" stopColor="#d49a1a" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="12" fill="url(#ethos-coin-fill)" />
      <circle cx="12" cy="12" r="10.8" fill="none" stroke="#a06c04" strokeOpacity="0.55" strokeWidth="2.4" />
    </svg>
  );
}
