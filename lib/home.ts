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
import { bandClose, practiceRow, type Challenge } from "./challenge";
import { longestCleanRun } from "./clean-run";
import type { RepRow, RepSpine } from "./client-data";
import { ART_BOUNDS } from "./lesson-art-bounds";
import { weekStart } from "./level";
import { choosePractice, standing, type Chosen } from "./next-practice";
import { percentile } from "./percentile";
import { repHref } from "./rep-config";
import { measured, readTraitsFromRow, type TraitReading } from "./trait-readings";

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

const VERB: Record<"lower" | "higher", string> = {
  lower: "Under",
  higher: "Over",
};

/**
 * Today's line as the tile prints it (E24): the tile's own precision,
 * whole from 10 up and one decimal under it, keeping the decimal, so a
 * line of 1.0 a minute reads "1.0" and never "1", which next to "Today's
 * line" read as the line's number in a list. Never `fmtRaw`.
 */
export function fmtLine(n: number): string {
  if (!Number.isFinite(n)) return "0.0";
  return n >= 10 ? String(Math.round(n)) : n.toFixed(1);
}

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
  /* Pace's line is a distance from its zone, so it has no verb: never
     "Inside it" or "Inside your line of 100" (lib/challenge.ts). */
  const verb = c.direction === "band" ? null : VERB[c.direction];
  if (c.today === null) {
    return {
      shown: c.line,
      state: "open",
      fill: 0,
      mark: LINE_MARK,
      caption: verb
        ? `${verb} it on ${c.cleared.n} of your last ${c.cleared.of}.`
        : `Cleared on ${c.cleared.n} of your last ${c.cleared.of}.`,
    };
  }
  const lineS = Math.max(standing(c.trait, c.line), 0.05);
  const fill = Math.max(0, Math.min(1, (standing(c.trait, c.today) / lineS) * LINE_MARK));
  if (c.closed) {
    const on = fmtLine(c.today) === fmtLine(c.line);
    let caption = "On your line.";
    if (!on && verb) caption = `${verb} your line of ${fmtLine(c.line)}.`;
    if (!on && !verb) {
      const said = bandClose(c);
      caption = `${said[0].toUpperCase()}${said.slice(1)}.`;
    }
    return {
      shown: c.today,
      state: "closed",
      /* A close always reaches the mark, whatever the rounding. */
      fill: Math.max(fill, LINE_MARK),
      mark: LINE_MARK,
      caption,
    };
  }
  return {
    shown: c.today,
    state: "short",
    fill: Math.min(fill, LINE_MARK - 0.04),
    mark: LINE_MARK,
    caption: `Your line is ${fmtLine(c.line)}.`,
  };
}

/**
 * Today's line in the wide tile (D23, E24): the card's trait prints its
 * number at the left, and the tile's right half holds today's line as a
 * head with its flag or check, the line itself as a number with the
 * tile's unit ("1.0 /min"), and a caption; the line also draws itself as
 * a tick on the trait's own bar at its percentile, on the same scale as
 * the bar's fill. The caption no longer names the line ("Line 1."), since
 * the number stands over it.
 */
export interface WideLine {
  state: LineTile["state"];
  /** The line as the tile prints it (`fmtLine`). */
  line: string;
  caption: string;
  /** Where the line sits on the trait's bar, 0 to 100. */
  tick: number;
}

export function wideLine(c: Challenge): WideLine {
  const t = lineTile(c);
  return {
    state: t.state,
    line: fmtLine(c.line),
    caption: t.caption,
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
  /* A take too short to score is not a clean run: one word in 8s read
     "8s, of 8s". Its runs are neither the tile nor the best before it. */
  const kept = reps.filter(measured);
  if (kept.length === 0) return null;
  const runs = kept.map((r) => ({
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

/**
 * Whether Today's read was made on an earlier local day than `now`. A
 * phone locked on Today at 23:50 and woken at 08:00 resumes the page
 * without a reload, and it kept yesterday's date, its lit streak and
 * "One more" while the card moved to the new day under them.
 */
export function dayTurned(loadedAt: Date | null, now: Date): boolean {
  return loadedAt !== null && dayKey(loadedAt) !== dayKey(now);
}

/** A movement, signed: "+10", "−4" (a minus, not a hyphen), "0". */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${-n}`;
  return "0";
}

/* ------------------------------------------------------------------ */
/* Open straight into speaking (#431). */

/**
 * No practice could be chosen (a failed read, a history with nothing
 * measured): a topic anyone can take, and the one Start opens, so the
 * card promises what the tap keeps.
 */
export const FALLBACK_TOPIC_ID = "t2";

/** The columns a practice is chosen from: what `readTraitsFromRow` and `measured` read. */
export type PracticeRow = Pick<
  RepRow,
  "created_at" | "duration_s" | "transcript" | "wpm" | "filler_count" | "fillers" | "pauses" | "dimensions"
>;

/**
 * Today's practice: the one selector (#268) on the newest measured
 * recording before today, so the card, today's line, the wide tile and
 * now the reminder name one topic.
 */
export function todaysPractice(history: PracticeRow[], now: Date = new Date()): Chosen | null {
  const row = practiceRow(history, now);
  return row ? choosePractice(readTraitsFromRow(row), now) : null;
}

/**
 * Where a practice opens: the topic and tactic the card printed (E52)
 * in the colour it wore (D50), with no practice the fallback topic in
 * the house's blue. `ready` on a day not yet spoken: the recording
 * screen opens on the topic, one tactic and Record.
 */
export function practiceHref(
  chosen: Chosen | null,
  opts: { mods?: string[]; ready?: boolean } = {}
): string {
  return repHref({
    topic: chosen?.item.topicId ?? FALLBACK_TOPIC_ID,
    item: chosen?.item.id,
    mods: opts.mods,
    trait: chosen?.trait ?? "pause",
    ready: opts.ready,
  });
}

/** The device's local day of an instant, "YYYY-MM-DD". */
export function localDay(at: Date): string {
  return dayKey(at);
}

/** The local day of the newest recording, or null with none. */
export function lastSpokeOn(rows: { created_at: string }[]): string | null {
  let newest = -Infinity;
  for (const r of rows) newest = Math.max(newest, Date.parse(r.created_at));
  return Number.isFinite(newest) ? dayKey(new Date(newest)) : null;
}

/** Whole local days from day key `a` to day key `b`, by date parts. */
function daysFrom(a: string, b: string): number {
  const utc = (k: string) => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

/**
 * The day, from the local day of the newest recording: spoken today,
 * open, or open after a break. A break is a last recording two or more
 * days before today, so one missed day (the day the flame falls to 0)
 * counts, and so does four days away: that is when a welcome is needed
 * most (fresh start, Dai, Milkman and Riis 2014). The gap is never put
 * into words; this says only whether to welcome.
 */
export function dayOf(lastDay: string | null, now: Date = new Date()): "none" | "spoken" | "open" | "back" {
  if (!lastDay) return "none";
  const gap = daysFrom(lastDay, dayKey(now));
  if (gap <= 0) return "spoken";
  return gap >= 2 ? "back" : "open";
}

/**
 * The address a reminder opens (#431): Today's own practice, the one
 * Today's Start opens, ready to record. It used to be bare /rep, the
 * demoted road's rotation, so every reminder opened a different topic
 * from Today's and filed the take against the road's. With no
 * recording yet it is Today, which knows day one's lesson.
 */
export function todayHref(history: PracticeRow[], now: Date = new Date()): string {
  if (history.length === 0) return "/";
  const spoken = dayOf(lastSpokeOn(history), now) === "spoken";
  return practiceHref(todaysPractice(history, now), { ready: !spoken });
}

/**
 * An instant as it reads on a wall clock `tzOffset` minutes behind UTC
 * (`Date.getTimezoneOffset`'s sign, as push_subscriptions stores it):
 * a Date whose LOCAL fields are that wall clock's, wherever this runs.
 * The selector reads local days (the person's own calendar, #77), so the
 * server hands it the subscriber's.
 */
export function onWall(at: Date, tzOffset: number): Date {
  const s = new Date(at.getTime() - tzOffset * 60_000);
  return new Date(
    s.getUTCFullYear(),
    s.getUTCMonth(),
    s.getUTCDate(),
    s.getUTCHours(),
    s.getUTCMinutes(),
    s.getUTCSeconds(),
    s.getUTCMilliseconds()
  );
}

/** `todayHref` on a subscriber's calendar, for the server's reminder. */
export function todayHrefOn(history: PracticeRow[], now: Date, tzOffset: number): string {
  const wall = history.map((r) => ({
    ...r,
    created_at: onWall(new Date(r.created_at), tzOffset).toISOString(),
  }));
  return todayHref(wall, onWall(now, tzOffset));
}

/**
 * What the card shows (#431). Someone who opens Today and has not
 * spoken stays about seven seconds and leaves without tapping Start
 * (the test, 8 Nov: a median of 6.7s), so on an open day the card is
 * one decision: the topic, what it costs, one full-width Start, and a
 * way to another topic as a link under it. The trait chip, the tactic
 * and the difficulty glyph are a second take's tools, and stay on "One
 * more"; the tactic moves to the recording screen as its one line. The
 * difficulty glyph stays for someone who turned one up this week, whose
 * first take uses it.
 */
export interface CardFace {
  lead: "Your first recording" | "Today's practice" | "One more";
  /** The trait chip and the tactic beside the object. */
  tactic: boolean;
  /** "About 60 seconds" beside the object. */
  cost: boolean;
  /** Spin as the glyph beside Start, or as "Another topic" under a full-width Start. */
  spin: "glyph" | "link";
  /** The difficulty glyph beside Start. */
  mods: boolean;
  /** Start opens the recording screen ready to record. */
  ready: boolean;
}

export function cardFace(day: { dayOne: boolean; spokeToday: boolean; usedMods: boolean }): CardFace {
  if (day.dayOne) {
    return { lead: "Your first recording", tactic: false, cost: false, spin: "glyph", mods: true, ready: false };
  }
  if (day.spokeToday) {
    return { lead: "One more", tactic: true, cost: false, spin: "glyph", mods: true, ready: false };
  }
  return { lead: "Today's practice", tactic: false, cost: true, spin: "link", mods: day.usedMods, ready: true };
}

/** A take with difficulty turned up in the last seven days. */
export function usedModsLately(reps: Pick<RepRow, "created_at" | "mods">[], now: Date = new Date()): boolean {
  const since = now.getTime() - 7 * 86_400_000;
  return reps.some((r) => (r.mods?.length ?? 0) > 0 && Date.parse(r.created_at) >= since);
}

/**
 * What the day's take costs, from the person's own takes: the median
 * length of their last seven measured practice recordings, to the
 * nearest ten seconds, 30 to 90 (the daily cap). Under three, 60: the
 * daily take's middle. A number from their own recordings, not a promise.
 */
export function aboutSeconds(reps: Pick<RepRow, "duration_s" | "transcript" | "lesson_id" | "mode">[]): number {
  const takes = reps
    .filter((r) => r.mode === "daily" && !(r.lesson_id ?? "").startsWith("game:") && measured(r))
    .slice(-7)
    .map((r) => r.duration_s)
    .sort((a, b) => a - b);
  if (takes.length < 3) return 60;
  const mid = takes.length / 2;
  const median = takes.length % 2 ? takes[Math.floor(mid)] : (takes[mid - 1] + takes[mid]) / 2;
  return Math.min(90, Math.max(30, Math.round(median / 10) * 10));
}

export function costLine(seconds: number): string {
  return `About ${seconds} seconds`;
}

/**
 * The greeting (#393, #431): "Hi, Timothy", or "Welcome back, Timothy"
 * on a return after a break, never a count of the days away. `short` is
 * what the title shows when the whole line cannot hold one line at 26px:
 * the name alone, and on a return "Welcome back", which keeps the
 * welcome rather than the name. With no name the tab's own "Today", or
 * "Welcome back".
 */
export function greeting(name: string | null, back: boolean): { full: string; short: string | null } {
  if (back) return name ? { full: `Welcome back, ${name}`, short: "Welcome back" } : { full: "Welcome back", short: null };
  return name ? { full: `Hi, ${name}`, short: name } : { full: "Today", short: null };
}
