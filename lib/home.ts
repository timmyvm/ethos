/**
 * Today, "the object" (#393, direction B). The pure half of the home:
 * which glass object stands on the practice card, the tiles' short
 * units and their order, what today's line and the clean run say in a
 * tile, the greeting's name, and the This week view. The screen
 * (app/page.tsx, components/home/) only draws what these return, so
 * every state is a number a test can hold.
 */

import { lessonById } from "@/content/lessons";
import { NORMS } from "@/content/norms";
import { TRAIT, TRAITS, type TraitId } from "@/content/traits";
import { cleanName } from "./answers";
import type { Challenge } from "./challenge";
import { longestCleanRun } from "./clean-run";
import type { RepRow, RepSpine } from "./client-data";
import { ART_BOUNDS } from "./lesson-art-bounds";
import { weekStart } from "./level";
import { standing } from "./next-practice";
import { percentile } from "./percentile";
import { fmtRaw, type TraitReading } from "./trait-readings";

/* ------------------------------------------------------------------ */
/* The objects. */

/**
 * The tactic a practice leads with is one of its trait's three `howTo`
 * lines (content/path.ts, `tipsFor`), and the card's object is the
 * object of the lesson that teaches that tactic, paired by what the two
 * say, not by their place in a list: the hourglass beside "Hold one to
 * two seconds", the pause marks and full stop beside "After the full
 * stop", the zip beside "Close your mouth". Indexed like `howTo`.
 *
 * Two tactics have no lesson of their own in their trait. Fillers' "Let
 * the gap sit" is a shut mouth holding a silence, so it takes the zip
 * (the crutch magnifier it had is Fillers' crutch-word lesson, which
 * says nothing about a gap). Variety's "Your crutch word is the one you
 * cannot hear" is the repeated word, which is the second pass's subject
 * ("the second time you reach for an idea, reach somewhere else"), so
 * it keeps the boomerang.
 */
export const TACTIC_OBJECT: Record<TraitId, readonly [string, string, string]> = {
  pause: ["inside-or-after", "the-long-one", "the-landing"],
  fillers: ["closed-mouth", "the-cold-open", "closed-mouth"],
  repairs: ["finish-it", "or-rather", "know-the-landing"],
  pace: ["one-gear-down", "change-gear", "room-to-land"],
  range: ["name-it-once", "second-pass", "short-and-concrete"],
};

/**
 * Each trait's own objects, first choice first: the first is the
 * trait's emblem (`TRAIT_OBJECT`), on its tile and on a practice whose
 * first tip is not one of the trait's three (a shape's tip). Pausing is
 * the hourglass, the piece the set was rendered from.
 */
export const TRAIT_OBJECTS: Record<TraitId, readonly [string, string, string]> = {
  pause: ["the-long-one", "the-landing", "inside-or-after"],
  fillers: ["the-cold-open", "closed-mouth", "the-crutch"],
  repairs: ["finish-it", "know-the-landing", "or-rather"],
  pace: ["room-to-land", "one-gear-down", "change-gear"],
  range: ["name-it-once", "short-and-concrete", "second-pass"],
};

export const TRAIT_OBJECT = Object.fromEntries(
  Object.entries(TRAIT_OBJECTS).map(([id, ids]) => [id, ids[0]])
) as Record<TraitId, string>;

/** No trait to picture (day one, a failed read): the house's hourglass. */
export const HOUSE_OBJECT = TRAIT_OBJECT.pause;

/** The object on the practice card. */
export function heroObject(trait: TraitId | null, tip?: string | null): string {
  if (!trait) return HOUSE_OBJECT;
  const i = tip ? TRAIT[trait].howTo.indexOf(tip) : -1;
  return i >= 0 ? TACTIC_OBJECT[trait][i] : TRAIT_OBJECT[trait];
}

/**
 * A trait tile's object: the trait's emblem, always the same one (D22):
 * Pausing the hourglass, Fillers the door, Restarts the flag, Pace the
 * road, Variety the tag. It used to swap to the trait's next object
 * whenever the card above stood the first, so the same tile showed the
 * bowl one morning and the hourglass the next. The wide tile, the
 * card's own trait, draws none: the card above already stands the
 * lesson's object.
 */
export function tileObject(trait: TraitId): string {
  return TRAIT_OBJECT[trait];
}

/**
 * The file. The 560 cut (`public/lessons/large/`, scripts/cut-lesson-art.mjs)
 * for anything drawn over 180px, which the 360 thumbnail cannot hold at 2x.
 */
export function objectSrc(id: string, large = false): string {
  const lesson = lessonById(id);
  const name = lesson ? lesson.id : HOUSE_OBJECT;
  return large ? `/lessons/large/${name}.webp` : `/lessons/${name}.webp`;
}

/**
 * Where the object is inside its square, for the CSS that places it:
 * its visible box's left and top and its width and height, as fractions
 * of the square (lib/lesson-art-bounds.ts, measured from the cut's
 * transparency). `.home-hero` and `.home-tile` size an object so that
 * box fills their object zone, and stand it by the box, so a wide low
 * object (the pause marks, the bowl, the boomerang) rises out of the
 * card's corner as far as the hourglass does and never reaches the
 * words beside it.
 */
export function artBox(id: string): Record<"--art-l" | "--art-t" | "--art-w" | "--art-h", number> {
  const b = ART_BOUNDS[id] ?? ART_BOUNDS[HOUSE_OBJECT];
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return {
    "--art-l": b.l,
    "--art-t": b.t,
    "--art-w": round(b.r - b.l),
    "--art-h": round(b.b - b.t),
  };
}

/* ------------------------------------------------------------------ */
/* The tiles. */

/**
 * A trait's unit where a tile has a half column for it. The full unit
 * ("held pauses a minute") stays in the tile's label for screen readers
 * and on the trait's own page.
 */
export const SHORT_UNIT: Record<TraitId, string> = {
  pause: "/min",
  fillers: "/100 words",
  repairs: "/100 words",
  pace: "wpm",
  range: "/100 words",
};

/**
 * How wide a printed number and a short unit are, in ems of their own
 * size (Outfit 800 tabular digits; the unit at 700), measured in the
 * browser with a little to spare. A tile sets its number on one line
 * with its unit (`.home-num-line`), and the number takes the largest
 * size up to the tile's own that leaves the unit room, so "9.8 /100
 * words" holds one line in a 102px column at 320 and no unit wraps.
 */
export function numEm(printed: string): number {
  let em = 0;
  for (const ch of printed) em += /\d/.test(ch) ? 0.58 : ch === "." ? 0.28 : 0.6;
  return Math.round(em * 100) / 100 || 0.58;
}
export const UNIT_EM: Record<string, number> = {
  "/100 words": 5.2,
  wpm: 2.3,
  "/min": 2.1,
  s: 0.5,
};

/**
 * The five in the bento's order. The wide tile is the trait the card
 * works on (`focus`, the practice's own trait, so the card, today's line
 * and the wide tile name one trait, #268); the other four follow by the
 * percentile printed on them, lowest first, so the order reads weakest
 * first by the numbers on screen. Without a focus (a failed choice) the
 * lowest percentile takes the wide tile. A trait with no reading sorts
 * last; with no reading at all the order is the lessons'.
 */
export function traitOrder(
  readings: TraitReading[],
  focus: TraitId | null = null
): { id: TraitId; reading: TraitReading | null }[] {
  const byId = new Map(readings.map((r) => [r.id, r]));
  const place = (id: TraitId) => TRAITS.findIndex((t) => t.id === id);
  const pct = (id: TraitId) => byId.get(id)?.percentile ?? Infinity;
  const ranked = TRAITS.map((t) => t.id).sort(
    (a, b) => (readings.length === 0 ? 0 : pct(a) - pct(b)) || place(a) - place(b)
  );
  const lead = focus ?? ranked[0];
  return [lead, ...ranked.filter((id) => id !== lead)].map((id) => ({
    id,
    reading: byId.get(id) ?? null,
  }));
}

const VERB: Record<Challenge["direction"], string> = {
  lower: "Under",
  higher: "Over",
  band: "Inside",
};

export interface LineTile {
  /** The number the tile prints: today's best once spoken, the line before. */
  shown: number;
  state: "open" | "closed" | "short";
  /** The bar: today's fill and the line's mark, 0 to 1 of its width. */
  fill: number;
  mark: number;
  caption: string;
}

/** Where the line sits on the bar; past it is room to clear it by. */
export const LINE_MARK = 0.8;

/**
 * Today's line as a tile. Open, the number is the line and the bar is
 * empty to its mark; spoken, the number is today's best and the fill
 * runs to it on the trait's own standing, so "fewer is better" fills
 * the same way as "more is better".
 */
export function lineTile(c: Challenge): LineTile {
  const verb = VERB[c.direction];
  if (c.today === null) {
    return {
      shown: c.line,
      state: "open",
      fill: 0,
      mark: LINE_MARK,
      caption: `${verb} it on ${c.cleared.n} of your last ${c.cleared.of}.`,
    };
  }
  const lineS = Math.max(standing(c.trait, c.line), 0.05);
  const fill = Math.max(0, Math.min(1, (standing(c.trait, c.today) / lineS) * LINE_MARK));
  if (c.closed) {
    const on = fmtRaw(c.today) === fmtRaw(c.line);
    return {
      shown: c.today,
      state: "closed",
      /* A close always reaches the mark, whatever the rounding. */
      fill: Math.max(fill, LINE_MARK),
      mark: LINE_MARK,
      caption: on ? "On your line." : `${verb} your line of ${fmtRaw(c.line)}.`,
    };
  }
  return {
    shown: c.today,
    state: "short",
    fill: Math.min(fill, LINE_MARK - 0.04),
    mark: LINE_MARK,
    caption: `Your line is ${fmtRaw(c.line)}.`,
  };
}

/**
 * Today's line in the wide tile (D23): the card's trait already prints
 * its number there, so the line keeps to the tile's right half as a
 * head, a flag or a check, and a caption, and draws itself as a tick
 * on the trait's own bar at the line's percentile, on the same scale as
 * the bar's fill. 1.8 shows once. Where the line's printed number is
 * not the number the tile prints, the caption names it, so the line is
 * never only a tick.
 */
export interface WideLine {
  state: LineTile["state"];
  caption: string;
  /** Where the line sits on the trait's bar, 0 to 100. */
  tick: number;
}

export function wideLine(c: Challenge, shown: number | null): WideLine {
  const t = lineTile(c);
  const named = c.today === null && (shown === null || fmtRaw(shown) !== fmtRaw(c.line));
  return {
    state: t.state,
    caption: named ? `Line ${fmtRaw(c.line)}. ${t.caption}` : t.caption,
    tick: Math.max(0, Math.min(100, percentile(c.line, NORMS[c.trait]))),
  };
}

export interface CleanRunTile {
  /** The last recording's longest stretch with no filler, whole seconds. */
  s: number;
  /** That recording's length: the bar's whole width. */
  of: number;
  /** The best before it, or null on the first recording. */
  best: number | null;
  newBest: boolean;
  caption: string;
}

/**
 * The clean run (#254, #267) as a tile: the newest recording, against
 * its own length, with the best before it as the bar's mark.
 */
export function cleanRunTile(reps: RepRow[]): CleanRunTile | null {
  if (reps.length === 0) return null;
  const runs = reps.map((r) => ({
    s: longestCleanRun(r.fillers ?? [], r.duration_s).seconds,
    of: r.duration_s,
  }));
  const now = runs[runs.length - 1];
  const earlier = runs.slice(0, -1);
  const best = earlier.length > 0 ? Math.max(...earlier.map((r) => r.s)) : null;
  const s = Math.round(now.s);
  const of = Math.max(1, Math.round(now.of));
  const newBest = best !== null && now.s >= best;
  const caption =
    best === null
      ? `Of ${of}s.`
      : newBest
        ? `Of ${of}s. A new best.`
        : `Of ${of}s. Best ${Math.round(best)}s.`;
  return { s, of, best: best === null ? null : Math.round(best), newBest, caption };
}

/* ------------------------------------------------------------------ */
/* The greeting. */

/** The name to greet: the first word of the profile's display name. */
export function greetingName(raw: string | null | undefined): string | null {
  const clean = cleanName(raw);
  if (!clean) return null;
  return clean.split(/\s+/)[0] ?? null;
}

/** The avatar coin's letter, or null for the neutral glyph. */
export function initialOf(name: string | null): string | null {
  if (!name) return null;
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : null;
}

/* ------------------------------------------------------------------ */
/* This week. */

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface WeekDay {
  /** M, T, W, T, F, S, S. */
  label: string;
  /** A recording landed that local day. */
  on: boolean;
  today: boolean;
}

export interface WeekView {
  /** Monday first. */
  days: WeekDay[];
  /** Days spoken this week. */
  spoken: number;
  /** Recordings this week, and since day one. */
  thisWeek: number;
  total: number;
  /** Days spoken since day one: the counter that never resets. */
  daysAll: number;
  /**
   * Recordings a week, oldest first, this week last: the weeks since the
   * first recording's, six at most. A week before day one is not a zero.
   */
  weeks: number[];
  /** The Ethos Index, as the Log reads it: the newest scored recording. */
  index: {
    now: number;
    /** Against the last scored recording before this week; null without one, or with nothing scored this week. */
    week: number | null;
    /** Against the first scored recording; null until there are two. */
    since: number | null;
    /** The newest thirty, oldest first, for the hill. */
    series: number[];
  } | null;
}

const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const MS_WEEK = 7 * 86400000;

/** This week, from every recording's date and Index (the spine). */
export function weekView(spine: Pick<RepSpine, "created_at" | "ethos_index">[], now: Date): WeekView {
  const start = weekStart(now);
  const rows = spine
    .map((r) => ({ at: new Date(r.created_at), index: r.ethos_index }))
    .filter((r) => r.at <= now)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const spokenKeys = new Set(rows.filter((r) => r.at >= start).map((r) => dayKey(r.at)));
  const todayKey = dayKey(now);
  const days = WEEK_LABELS.map((label, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKey(d);
    return { label, on: spokenKeys.has(key), today: key === todayKey };
  });

  const thisWeek = rows.filter((r) => r.at >= start).length;
  const weeks: number[] = [];
  if (rows.length > 0) {
    const first = weekStart(rows[0].at);
    const span = Math.round((start.getTime() - first.getTime()) / MS_WEEK) + 1;
    const n = Math.min(6, Math.max(1, span));
    for (let i = n - 1; i >= 0; i--) {
      const from = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7 * i);
      const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
      weeks.push(rows.filter((r) => r.at >= from && r.at < to).length);
    }
  }

  const scored = rows.filter((r): r is { at: Date; index: number } => r.index !== null);
  let index: WeekView["index"] = null;
  if (scored.length > 0) {
    const last = scored[scored.length - 1].index;
    const before = scored.filter((r) => r.at < start);
    const inWeek = scored.length - before.length;
    index = {
      now: last,
      week: before.length > 0 && inWeek > 0 ? last - before[before.length - 1].index : null,
      since: scored.length > 1 ? last - scored[0].index : null,
      series: scored.slice(-30).map((r) => r.index),
    };
  }

  return {
    days,
    spoken: spokenKeys.size,
    thisWeek,
    total: rows.length,
    daysAll: new Set(rows.map((r) => dayKey(r.at))).size,
    weeks,
    index,
  };
}

/** A movement, signed: "+10", "−4" (a minus, not a hyphen), "0". */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${-n}`;
  return "0";
}
