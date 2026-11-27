import type { RepRow } from "./client-data";
import { sinceDayOne } from "./log";
import { ALL_FILLERS_PER_MIN, PAUSES_PER_RECORDING, WORDS_A_MINUTE, pausesBetween } from "./metric-labels";

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
  /** "Day 1 to day N": the days from the first recording to the latest, both counted. */
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
  const days =
    Math.round((new Date(last.created_at).getTime() - new Date(first.created_at).getTime()) / 86_400_000) + 1;

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
 * What a screen reader hears for a row: the label, both numbers with
 * their days, and the way it went in words, since the arrow is drawn for
 * the eye and the colour is never the whole message (DESIGN 10).
 */
export function sinceName(r: SinceRow, days: number): string {
  const said = (s: string) => (s === DASH ? "no number" : s);
  if (r.went === "up") return `${r.label}: ${r.a} on day 1, up to ${r.b} on day ${days}`;
  if (r.went === "down") return `${r.label}: ${r.a} on day 1, down to ${r.b} on day ${days}`;
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
 * introduction's focus first. Unknown is a dash, said as no number.
 */
export function takeRows(
  m: { durationS: number; wpm: number; fillerCount: number; pauses?: readonly { kind: string }[] | null },
  lead?: string | null
): TakeRow[] {
  const rate = fillersPerMinute({ filler_count: m.fillerCount, duration_s: m.durationS });
  const values: Record<TakeRow["key"], string> = {
    fillers: drawn(rate, 1),
    wpm: drawn(pace({ wpm: m.wpm }), 0),
    pause: drawn(Array.isArray(m.pauses) ? pausesBetween(m.pauses) : null, 0),
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
