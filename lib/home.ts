/**
 * Today, "the object" (#393, direction B). The pure half of the home:
 * which glass object stands on the practice card, what today's line and
 * the clean run say at the foot (#500), the greeting's name, and the
 * card's face on a day spoken or not. The screen (app/page.tsx,
 * components/home/) only draws what these return, so every state is a
 * number a test can hold.
 */

import { lessonById } from "@/content/lessons";
import { NORMS } from "@/content/norms";
import type { Pool } from "@/content/portfolio";
import { TRAIT, type TraitId } from "@/content/traits";
import { cleanName } from "./answers";
import { practiceRow, type Challenge } from "./challenge";
import { longestCleanRun } from "./clean-run";
import type { RepRow } from "./client-data";
import { ART_BOUNDS } from "./lesson-art-bounds";
import { choosePractice, type Chosen } from "./next-practice";
import { repHref } from "./rep-config";
import { measured, readTraitsFromRow } from "./trait-readings";

/* ------------------------------------------------------------------ */
/* The objects. */

/**
 * The tactic a practice leads with is one of its trait's three `howTo`
 * lines (content/path.ts, `tipsFor`), and the card's object is the
 * object of the lesson that teaches that tactic, paired by what the two
 * say, not by their place in a list: the hourglass beside "Pause, count
 * to two", the pause marks and full stop beside "Finish, then pause",
 * the zip beside 'Mouth shut, no "um"'. Indexed like `howTo`.
 *
 * Two tactics have no lesson of their own in their trait. Fillers'
 * "Quiet instead of um" is a shut mouth holding a silence, so it takes
 * the zip (the magnifier it had is Fillers' overused-word lesson, which
 * says nothing about a gap). Variety's "Skip "really" and "very"" is
 * the repeated word, which is the second pass's subject ("Coming back
 * to an idea? Say it in new words."), so it keeps the boomerang.
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

/*
 * The trait tiles stood each trait's emblem (`TRAIT_OBJECT`, D22) until
 * #478 took every glass object off them: only the card stands one now,
 * and a tile's mark is its flat glyph (components/TraitGlyph.tsx).
 */

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
 * transparency). `.home-hero` sizes an object so that
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
/* The foot: the two numbers only Today holds (#500). */

/*
 * Since #500 (Timothy, 18 Nov: "I don't fuck with all the cards on the
 * homepage") Today stands one box, the practice card. The five trait
 * tiles and the This week side left: each trait's latest reading is on
 * Lessons (`TraitNumber` under each trait's head), on You's trait sheet
 * (its reading and where it places you, in words) and in every
 * recording's Every number; the Index and the week's recordings are the
 * Log's. Two numbers have no other home, so they stay, as two figures
 * on the page's ground under the games: today's line (#281) and the
 * longest stretch with no filler (#254, #267). Each is one number and
 * one line in plain words (#483's two seconds): what it counts beside
 * it, what to do with it under it.
 */

/**
 * What a line counts, split where the figure stands: the noun for the
 * line under it, the rate beside the number. Joined, they are the
 * trait's own unit (content/traits.ts, held by lib/home.test.ts), so the
 * foot says what Lessons and the results say.
 */
export const LINE_WORDS: Record<TraitId, { noun: string; rate: string }> = {
  pause: { noun: "pauses between sentences", rate: "a minute" },
  fillers: { noun: "um or uh", rate: "in 100 words" },
  repairs: { noun: "restarts", rate: "in 100 words" },
  pace: { noun: "words", rate: "a minute" },
  range: { noun: "different words", rate: "in every 100" },
};

/**
 * Today's line as the foot prints it (E24): whole from 10 up and one
 * decimal under it, keeping the decimal, so a line of 1.0 a minute reads
 * "1.0" and never "1". Never `fmtRaw`.
 */
export function fmtLine(n: number): string {
  if (!Number.isFinite(n)) return "0.0";
  return n >= 10 ? String(Math.round(n)) : n.toFixed(1);
}

/** One of the foot's two figures: a number, what it counts, and one plain line. */
export interface FootFigure {
  /** Open or short: the line still to clear (the flag). Closed: cleared today (the check). None: nothing to show yet (a dash). */
  state: "open" | "closed" | "none";
  /** The number at its precision, Pace's zone as "130 to 160", or null for a dash. */
  figure: string | null;
  /** Beside the number, on its baseline: "a minute", "s". */
  rate: string;
  /** Under it, what to do with it or what it is, in words. */
  label: string;
  /** The figure as one sentence, for a screen reader. */
  said: string;
}

/** The line's name, the head of its label. */
export const LINE_NAME = "Today's line";

/**
 * Today's line (#281) as a figure (#500): the number to beat over what
 * to do about it. "1.0 a minute" over "Today's line: more pauses
 * between sentences". It was a sentence in the wide tile ("Over 1.0
 * clears it.") beside the trait's own number, and a tile's worth of
 * context is gone with the tile, so the label names the measure. A
 * closed line shows the number that cleared it. Pace's line is a
 * distance from its zone, so it prints the zone and names the line
 * (never "Over 104", lib/challenge.ts). None under three readings.
 */
export function lineFigure(c: Challenge | null): FootFigure {
  if (!c) {
    const label = `${LINE_NAME}: three recordings set it`;
    return { state: "none", figure: null, rate: "", label, said: `${label}.` };
  }
  const w = LINE_WORDS[c.trait];
  if (c.today !== null && c.closed) {
    const figure = fmtLine(c.today);
    return {
      state: "closed",
      figure,
      rate: w.rate,
      label: `${LINE_NAME}, cleared`,
      said: `${LINE_NAME}, cleared with ${figure} ${w.noun} ${w.rate}.`,
    };
  }
  if (c.direction === "band") {
    const band = NORMS[c.trait].band;
    const zone = band ? `${band.lo} to ${band.hi}` : fmtLine(c.line);
    const inside = band ? c.line >= band.lo && c.line <= band.hi : false;
    const label = inside ? `${LINE_NAME}: stay inside it` : `${LINE_NAME}: nearer it than ${fmtLine(c.line)}`;
    return {
      state: "open",
      figure: zone,
      rate: `${w.noun} ${w.rate}`,
      label,
      said: inside
        ? `${LINE_NAME}: stay inside ${zone} ${w.noun} ${w.rate}.`
        : `${LINE_NAME}: nearer ${zone} ${w.noun} ${w.rate} than ${fmtLine(c.line)}.`,
    };
  }
  const more = c.direction === "higher";
  const figure = fmtLine(c.line);
  return {
    state: "open",
    figure,
    rate: w.rate,
    label: `${LINE_NAME}: ${more ? "more" : "fewer"} ${w.noun}`,
    said: `${LINE_NAME}: ${more ? "over" : "under"} ${figure} ${w.noun} ${w.rate}.`,
  };
}

/**
 * The clean run's name on Today (#495, #500): what it is, in words.
 * "Clean run" is also a badge on You that counts something else, and
 * "No-filler run" still asked what a run was.
 */
export const RUN_NAME = "Longest with no filler";

/**
 * The clean run (#254, #267) as a figure: the newest scored recording's
 * longest stretch with no filler, in whole seconds, over what it is. A
 * new best says so; the best itself left with the tile (#500). A take
 * too short to score is not a clean run: one word in 8s read "8s, of
 * 8s". None until a recording scores.
 */
export function runFigure(reps: Pick<RepRow, "fillers" | "duration_s" | "transcript">[]): FootFigure {
  const kept = reps.filter(measured);
  if (kept.length === 0) {
    const label = `${RUN_NAME}: your first recording sets it`;
    return { state: "none", figure: null, rate: "", label, said: `${label}.` };
  }
  const runs = kept.map((r) => longestCleanRun(r.fillers ?? [], r.duration_s).seconds);
  const now = runs[runs.length - 1];
  const earlier = runs.slice(0, -1);
  const newBest = earlier.length > 0 && now >= Math.max(...earlier);
  const s = Math.round(now);
  const label = newBest ? `${RUN_NAME}, a new best` : `${RUN_NAME}, in your last recording`;
  return { state: "open", figure: String(s), rate: "s", label, said: `${label}: ${s} seconds.` };
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

/**
 * Whether Today's read was made on an earlier local day than `now`. A
 * phone locked on Today at 23:50 and woken at 08:00 resumes the page
 * without a reload, and it kept yesterday's date, its lit streak and
 * "One more" while the card moved to the new day under them.
 */
export function dayTurned(loadedAt: Date | null, now: Date): boolean {
  return loadedAt !== null && dayKey(loadedAt) !== dayKey(now);
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
 * now the reminder name one topic. The pool is the person's (#489):
 * this phone's answers on Today and in the command menu, the account's
 * in the reminder, the same answers once synced.
 */
export function todaysPractice(history: PracticeRow[], now: Date, pool: Pool): Chosen | null {
  const row = practiceRow(history, now);
  return row ? choosePractice(readTraitsFromRow(row), now, pool) : null;
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
export function todayHref(history: PracticeRow[], now: Date, pool: Pool): string {
  if (history.length === 0) return "/";
  const spoken = dayOf(lastSpokeOn(history), now) === "spoken";
  return practiceHref(todaysPractice(history, now, pool), { ready: !spoken });
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

/** `todayHref` on a subscriber's calendar and in their pool, for the server's reminder. */
export function todayHrefOn(history: PracticeRow[], now: Date, tzOffset: number, pool: Pool): string {
  const wall = history.map((r) => ({
    ...r,
    created_at: onWall(new Date(r.created_at), tzOffset).toISOString(),
  }));
  return todayHref(wall, onWall(now, tzOffset), pool);
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
  /** "Welcome back" in "Today's practice"'s place after a break (#430 review). */
  lead: "Your first recording" | "Today's practice" | "Welcome back" | "One more";
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

export function cardFace(day: { dayOne: boolean; spokeToday: boolean; usedMods: boolean; back?: boolean }): CardFace {
  if (day.dayOne) {
    return { lead: "Your first recording", tactic: false, cost: false, spin: "glyph", mods: true, ready: false };
  }
  if (day.spokeToday) {
    return { lead: "One more", tactic: true, cost: false, spin: "glyph", mods: true, ready: false };
  }
  return {
    lead: day.back ? "Welcome back" : "Today's practice",
    tactic: false,
    cost: true,
    spin: "link",
    mods: day.usedMods,
    ready: true,
  };
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
 * The greeting (#393): "Hi, Timothy", every day. `short` is what the
 * title shows when the whole line cannot hold one line at 26px: the name
 * alone. With no name the tab's own "Today". A return after a break is
 * welcomed on the card's lead instead (`cardFace`, #430 review): in the
 * title "Welcome back, Timothy" set smaller than "Hi, Timothy" and never
 * kept the name, and a tester's eyebrow must stay the test's day.
 */
export function greeting(name: string | null): { full: string; short: string | null } {
  return name ? { full: `Hi, ${name}`, short: name } : { full: "Today", short: null };
}
