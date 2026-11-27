import type { RepRow } from "./client-data";
import { LINE_SPAN, sinceDayOne } from "./log";
import { ALL_FILLERS_PER_MIN, PAUSES_PER_RECORDING, WORDS_A_MINUTE, pausesBetween } from "./metric-labels";
import { measured } from "./trait-readings";

/**
 * Since day one, as numbers (#526): the rows the progress moment's stage
 * draws (components/ComparisonCard.tsx), its lead first. The lead is the
 * claim the stage stands at display size; the rest are its ledger.
 *
 * Every number is read off two stored recordings, the first and the
 * latest that measured something (lib/log.ts `sinceDayOne`). A number a
 * recording does not hold is unknown, drawn as a dash and never as zero
 * (DESIGN 8): a recording with no length has no rate, one with no pause
 * list has no pause count, one with no pace has none.
 */

export type SinceKey = "ethos" | "fillers" | "wpm" | "pause";

export type SinceRow = {
  key: SinceKey;
  label: string;
  /** Day 1's number and the latest's, as measured; null where unknown. */
  from: number | null;
  to: number | null;
  /** As drawn: a rate to one place, everything else whole, a dash for unknown. */
  a: string;
  b: string;
  /** Which way the drawn number went. Null when either end is unknown. */
  went: "up" | "down" | "held" | null;
  /**
   * Better for the speaker: sage when true, rust when false, plain when
   * null (held, or unknown). Read off the drawn numbers, so a row never
   * wears a colour its two numbers do not show.
   */
  better: boolean | null;
};

export type SinceCard = {
  /** Day N: the calendar days on this phone from the first recording's to the latest's, both counted. */
  days: number;
  /** Every recording on the list, as the foot counts them. */
  recordings: number;
  /** The lead first, then the ledger. */
  rows: SinceRow[];
};

/** Pace is better the nearer it stands to 145 words a minute (unchanged since the card's first build). */
export const PACE_AIM = 145;

export const DASH = "—";

/** The introduction's focus metric (lib/portfolio.ts `focus.metric`) to the row it leads with (#232). */
const LEAD: Record<string, SinceKey> = { fillers: "fillers", wpm: "wpm", pause: "pause" };

const LABEL: Record<SinceKey, string> = {
  ethos: "Ethos",
  fillers: ALL_FILLERS_PER_MIN,
  wpm: WORDS_A_MINUTE,
  pause: PAUSES_PER_RECORDING,
};

/** Every label the stage can print, in the card's order: the measures' one names (#495). */
export const SINCE_LABELS: readonly string[] = [LABEL.ethos, LABEL.fillers, LABEL.wpm, LABEL.pause];

/**
 * Day N of a recording made at `toIso`, counted from one made at
 * `fromIso`: calendar days on this phone, both counted (the panel's
 * must-fix, borrowed from designer B's `dayOf`). Last night and this
 * morning are day 1 and day 2 whatever the hours between them, and a
 * 23- or 25-hour day at a clock change is still one day.
 */
export function calendarDay(fromIso: string, toIso: string): number {
  const day = (iso: string) => {
    const d = new Date(iso);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.round((day(toIso) - day(fromIso)) / 86_400_000) + 1;
}

/** Every filler a minute, or null for a recording with no length. */
export function fillersPerMinute(r: Pick<RepRow, "filler_count" | "duration_s">): number | null {
  if (!(r.duration_s > 0) || !Number.isFinite(r.filler_count)) return null;
  return r.filler_count / (r.duration_s / 60);
}

function pace(r: Pick<RepRow, "wpm">): number | null {
  return Number.isFinite(r.wpm) && r.wpm > 0 ? r.wpm : null;
}

function pausesOf(r: Pick<RepRow, "pauses">): number | null {
  return Array.isArray(r.pauses) ? pausesBetween(r.pauses) : null;
}

function drawn(n: number | null, places: number): string {
  return n === null ? DASH : n.toFixed(places);
}

function row(key: SinceKey, from: number | null, to: number | null, places: number): SinceRow {
  const a = drawn(from, places);
  const b = drawn(to, places);
  if (from === null || to === null) return { key, label: LABEL[key], from, to, a, b, went: null, better: null };
  // Compared as drawn: 9.34 and 9.26 both read 9.3, and that is held.
  const x = Number(a);
  const y = Number(b);
  const went = y > x ? "up" : y < x ? "down" : "held";
  let better: boolean | null;
  if (went === "held") better = null;
  else if (key === "fillers") better = y < x;
  else if (key === "wpm") {
    const near = Math.abs(y - PACE_AIM) - Math.abs(x - PACE_AIM);
    better = near === 0 ? null : near < 0;
  } else better = y > x;
  return { key, label: LABEL[key], from, to, a, b, went, better };
}

/**
 * The card, or null under two measured recordings. `lead` is the
 * introduction's focus metric: its row goes first. With no lead, or one
 * the card does not draw, the Ethos row leads where both recordings have
 * an Ethos number, and the filler rate where they do not.
 */
export function sinceDayOneCard(reps: RepRow[], lead?: string | null): SinceCard | null {
  const ends = sinceDayOne(reps);
  if (!ends) return null;
  const { first, last } = ends;
  const days = calendarDay(first.created_at, last.created_at);

  const rows: SinceRow[] = [
    row("fillers", fillersPerMinute(first), fillersPerMinute(last), 1),
    row("wpm", pace(first), pace(last), 0),
    row("pause", pausesOf(first), pausesOf(last), 0),
  ];
  /* The Ethos row stands only where both ends have the number: a first
     recording the coach never read has nothing to start the line from. */
  if (first.ethos_index !== null && last.ethos_index !== null) {
    rows.unshift(row("ethos", first.ethos_index, last.ethos_index, 0));
  }
  const key = lead ? LEAD[lead] : undefined;
  const at = key ? rows.findIndex((r) => r.key === key) : -1;
  if (at > 0) rows.unshift(rows.splice(at, 1)[0]);
  return { days, recordings: reps.length, rows };
}

/**
 * Whether Since day one can stand (#526's review): two measured ends on
 * two calendar days. Takes too short to measure count as days spoken
 * (`proMomentDue`'s three), so three days can hold both measured ends on
 * one day, and the claim would print "Day 1" under both numbers. The
 * moment waits for the second day instead, as it waits for two ends.
 */
export function sinceStands(card: SinceCard | null): card is SinceCard {
  return card !== null && card.days >= 2;
}

/**
 * What a screen reader hears for a row: the label, both numbers with
 * their days, the way it went, and better or worse in words, since the
 * arrow is drawn for the eye and the colour is never the whole message
 * (DESIGN 10). Words a minute is better nearer 145, which no direction
 * says, so the word is what tells it.
 */
export function sinceName(r: SinceRow, days: number): string {
  const said = (s: string) => (s === DASH ? "no number" : s);
  const verdict = r.better === true ? ", better" : r.better === false ? ", worse" : "";
  if (r.went === "up") return `${r.label}: ${r.a} on day 1, up to ${r.b} on day ${days}${verdict}`;
  if (r.went === "down") return `${r.label}: ${r.a} on day 1, down to ${r.b} on day ${days}${verdict}`;
  if (r.went === "held") return `${r.label}: ${r.a} on day 1, the same on day ${days}`;
  return `${r.label}: ${said(r.a)} on day 1, ${said(r.b)} on day ${days}`;
}

/**
 * The save wall's title (#134), a title with no full stop (#454): the
 * first recording's "Day 1 is on the board", and a run's "3 days on the
 * board". A run of one day is said as day 1, never "1 days".
 */
export function boardLine(moment: "rep1" | "streak", days: number): string {
  const n = Math.max(1, Math.floor(days));
  return moment === "rep1" || n === 1 ? "Day 1 is on the board" : `${n} days on the board`;
}

/** "An" before a number said with a vowel: an 8-day, an 11-day, an 18-day, an 80-day. */
function article(n: number): string {
  return /^(8|11|18|8\d)$/.test(String(n)) ? "An" : "A";
}

/**
 * The save wall's first sentence (#134, #526): what lives only in this
 * browser. A first recording names its score only where it has one: a
 * take too short to score, or one whose coach failed to read it, has no
 * Ethos to keep, so its line never promises one (#526's review).
 */
export function saveWallLine(moment: "rep1" | "streak", days: number, scored: boolean): string {
  if (moment === "rep1") {
    return scored
      ? "This recording, its score and the streak it starts live only in this browser."
      : "This recording and the streak it starts live only in this browser.";
  }
  const n = Math.max(1, Math.floor(days));
  return `${article(n)} ${n}-day streak and every number behind it live only in this browser.`;
}

export type TakeRow = {
  key: Exclude<SinceKey, "ethos">;
  label: string;
  /** As drawn: a rate to one place, everything else whole, a dash for unknown. */
  value: string;
  /** What a screen reader hears: the label and the number. */
  name: string;
};

/**
 * One recording's numbers (#526), for the save wall's ledger: the
 * numbers behind the take it asks to save, in the card's order, the
 * introduction's focus first. Unknown is a dash, said as no number. A
 * take too short to score (`scorable: false`, under 20 words) has no
 * numbers to stand: the engine's 0 fillers and a few words' pace are not
 * measures (lib/log.ts `measured` keeps such a take off every line), so
 * each is a dash, never a false zero at hero size (DESIGN 8).
 */
export function takeRows(
  m: { durationS: number; wpm: number; fillerCount: number; pauses?: readonly { kind: string }[] | null },
  lead?: string | null,
  { scorable = true }: { scorable?: boolean } = {}
): TakeRow[] {
  const rate = scorable ? fillersPerMinute({ filler_count: m.fillerCount, duration_s: m.durationS }) : null;
  const values: Record<TakeRow["key"], string> = {
    fillers: drawn(rate, 1),
    wpm: drawn(scorable ? pace({ wpm: m.wpm }) : null, 0),
    pause: drawn(scorable && Array.isArray(m.pauses) ? pausesBetween(m.pauses) : null, 0),
  };
  const keys: TakeRow["key"][] = ["fillers", "wpm", "pause"];
  const first = lead ? LEAD[lead] : undefined;
  if (first && first !== "ethos") keys.sort((a, b) => (a === first ? -1 : b === first ? 1 : 0));
  return keys.map((key) => ({
    key,
    label: LABEL[key],
    value: values[key],
    name: `${LABEL[key]}: ${values[key] === DASH ? "no number" : values[key]}`,
  }));
}

/* ------------------------------------------------------------------ */
/* The line in the claim's stage (graft 1, from designer B)            */
/* ------------------------------------------------------------------ */

/** What one recording reads on a measure, or null where it has none. */
function valueOf(key: SinceKey, r: RepRow): number | null {
  if (key === "ethos") return r.ethos_index;
  if (key === "fillers") return fillersPerMinute(r);
  if (key === "wpm") return pace(r);
  return pausesOf(r);
}

/**
 * The claim's measure across every measured recording, oldest first: a
 * value each, the points its line is drawn through. A recording that
 * cannot read the measure (no length, no pace, no pause list, no Ethos)
 * is left out, never drawn as zero; a take too short to measure is not
 * on it at all, as it is not on the claim.
 */
export function sinceSeries(reps: RepRow[], key: SinceKey): number[] {
  const out: number[] = [];
  for (const r of reps) {
    if (!measured(r)) continue;
    const v = valueOf(key, r);
    if (v !== null && Number.isFinite(v)) out.push(v);
  }
  return out;
}

/**
 * The narrowest stretch each line is drawn on, so a small change looks
 * small and a flat run looks flat (the Log's LINE_SPAN, #506): 100 Ethos
 * points, 4 fillers a minute, 40 words a minute, 4 pauses.
 */
export const SPAN_FLOOR: Record<SinceKey, number> = { ethos: LINE_SPAN, fillers: 4, wpm: 40, pause: 4 };

export type SinceLine = {
  /** The line's vertices: the house's centred mean, its two ends and their neighbours each recording's own. */
  line: [number, number][];
  /** Every recording's own value, a dot each. */
  dots: [number, number][];
};

/**
 * The line in the unit square (x 0 to 1, one step a recording in order;
 * y 0 at the top), scaled on the values' own range, on at least `floor`
 * units centred on it. Null under two values. The middle is smoothed as
 * the Log's line is (a mean of up to two either side); the window
 * narrows to nothing at each end and at the vertex beside it, so the
 * line starts and ends on the claim's two numbers and a last take unlike
 * the rest is drawn where it is, never smoothed into the one before it
 * (the panel's graft 6).
 */
export function sinceLine(values: readonly number[], floor: number): SinceLine | null {
  const n = values.length;
  if (n < 2) return null;
  const smooth = values.map((_, i) => {
    const w = Math.max(0, Math.min(2, i - 1, n - 2 - i));
    const slice = values.slice(i - w, i + w + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(floor, hi - lo);
  const base = (lo + hi) / 2 - span / 2;
  const y = (v: number) => 1 - (v - base) / span;
  const x = (i: number) => i / (n - 1);
  return {
    line: smooth.map((v, i): [number, number] => [x(i), y(v)]),
    dots: values.map((v, i): [number, number] => [x(i), y(v)]),
  };
}
