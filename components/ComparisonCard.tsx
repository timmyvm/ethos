import type { CSSProperties, ReactNode } from "react";
import type { RepRow } from "@/lib/client-data";
import { linePath } from "@/lib/log";
import {
  sinceDayOneCard,
  sinceLine,
  sinceName,
  sinceSeries,
  SPAN_FLOOR,
  type SinceLine,
  type SinceRow,
} from "@/lib/since-day-one";

/**
 * Since day one's stage (#526): the number they said they would watch,
 * stood as one claim, day 1's value beside today's at display size, and
 * the rest as a quiet ledger under it. It was a dense card of four equal
 * rows centred on the ground, with about 140pt of bare ground over and
 * under it at 390x844 (DESIGN 7); now the stage takes the screen's free
 * height and the claim holds the middle of it.
 *
 * Still screenshot-shaped (vision.md principle 4): dark, one claim, no
 * chrome. The rows and their colours are lib/since-day-one.ts's, read off
 * the first and the latest measured recordings: sage and a solid bar only
 * where the drawn number got better, rust and a broken bar where it got
 * worse, plain where it held or is unknown, and the way it went is in
 * each row's name.
 *
 * Over the claim, where the stage has the room, the claim's measure is
 * drawn across every measured recording (the panel's graft 1, designer
 * B's line): a dot a recording, the house's centred mean through them,
 * a ring where you started and a dot where you are. The claim prints
 * both ends, so the line carries no labels; one bad last take reads as
 * the spike it is, not as 26 days of decline.
 */
export function ComparisonCard({
  reps,
  lead,
}: {
  reps: RepRow[];
  /**
   * The measured dimension the introduction's answers point at (#232:
   * the portfolio's focus metric). Its row is the claim, so the stage
   * opens on the number they said they'd watch.
   */
  lead?: string;
}) {
  const card = sinceDayOneCard(reps, lead);
  if (!card) return null;
  const [claim, ...ledger] = card.rows;
  /* The line only where the claim stands both its ends: then its first and
     last values are the claim's own two numbers. */
  const line = claim.from !== null && claim.to !== null ? sinceLine(sinceSeries(reps, claim.key), SPAN_FLOOR[claim.key]) : null;
  /* How the stage's room is shared (#526's review, app/globals.css): the
     line takes `cover` of the hero's, the claim's figures what the line
     leaves, as wide as the pair can stand (its places a side), and the
     ledger's rows a share of what the line does not cover, whole for a
     pair too wide to grow, half for a short one. */
  const pa = places(claim.a);
  const pb = places(claim.b);
  const room = {
    "--since-cover": line ? line.cover : 0,
    "--since-pa": pa,
    "--since-pb": pb,
    "--since-share": pa + pb > 4 ? 1 : 0.5,
  } as CSSProperties;

  return (
    <SinceStage
      line={line !== null}
      style={room}
      hero={
        <>
          {/* The line is the stage's art, over the head it illustrates
              (Wellspoken's course page: art, then the centred head). */}
          {line && <SinceChart line={line} tone={claim.better} />}
          {/* The hero's room left over, between the line and the head. */}
          <span aria-hidden className="since-gap" />
          <div className="since-head">
            {/* The claim's label is its eyebrow; the claim's own name says it. */}
            <p aria-hidden className="eyebrow since-eyebrow">
              {claim.label}
            </p>
            <Claim row={claim} days={card.days} />
          </div>
        </>
      }
      ledger={
        <SinceLedger
          rows={ledger.map((r) => ({ key: r.key, label: r.label, a: r.a, b: r.b, tone: `${tone(r)}${better(r)}`, name: sinceName(r, card.days) }))}
        />
      }
      foot={
        <p className="since-foot text-caption">
          {card.recordings} recordings. Every number measured, none awarded.
        </p>
      }
    />
  );
}

/** Sage where the number got better, rust where it got worse, the stage's ink where it held or is unknown. */
function tone(r: { better: boolean | null }): string {
  return r.better === true ? "text-sage-lit" : r.better === false ? "text-rust-lit" : "text-cream";
}

/**
 * The mark a verdict wears besides its colour (DESIGN 10: two marks that
 * mean different things differ in shape): better, a short solid sage bar
 * under the figure, the shape the panel took from designer C; worse, the
 * same bar broken into dashes, in rust (#526's review: worse was bare, so
 * worse and held differed by colour alone). Held, unknown and a pace as
 * far from 145 at both ends have no verdict and wear no mark.
 */
function better(r: { better: boolean | null }): string {
  return r.better === true ? " since-better" : r.better === false ? " since-worse" : "";
}

/**
 * The claim's measure across every measured recording, drawn in the room
 * the claim leaves (graft 1). It stands in the share of the hero's room
 * its change spans (`line.cover`, #526's review), and gives the room back
 * where it cannot stand 56pt (`.since-stage:not([data-room]) >
 * .since-hero`); its plot also hides under 44pt (`.since-chart`'s
 * container query), where a line that short would read as noise. Hidden
 * from a screen reader: the claim's name already says both ends.
 */
function SinceChart({ line, tone: verdict }: { line: SinceLine; tone: boolean | null }) {
  const W = 1000;
  const H = 1000;
  const d = linePath(line.line.map(([x, y]) => [x * W, y * H]));
  /* Every recording between the ends as a round cap on a zero-length
     stroke, so each stays a circle however the plot is stretched. */
  const dots = line.dots
    .slice(1, -1)
    .map(([x, y]) => `M${(x * W).toFixed(1)} ${(y * H).toFixed(1)}h0`)
    .join("");
  const [, y0] = line.dots[0];
  const [, y1] = line.dots[line.dots.length - 1];
  const end = verdict === true ? "since-end-better" : verdict === false ? "since-end-worse" : "";
  return (
    <div aria-hidden data-since-chart="" className="since-chart">
      <div className="since-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" focusable="false" className="block size-full overflow-visible">
          {dots && <path d={dots} className="since-dots" />}
          <path d={d} pathLength={1} className="since-path" />
        </svg>
        <span className="since-ring" style={{ left: "0%", top: `${y0 * 100}%` }} />
        <span className={`since-dot ${end}`} style={{ left: "100%", top: `${y1 * 100}%` }} />
      </div>
    </div>
  );
}

/** The arrow between two numbers: drawn, so it sits on the figures' middle at any size. */
export function SinceArrow({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" className={`since-arrow ${className}`}>
      <path d="M3 12h17M14 5.5 20.5 12 14 18.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A figure's width in digits: a point is half of one. */
function places(s: string): number {
  return s.replace(".", "").length + (s.includes(".") ? 0.5 : 0);
}

/**
 * The claim: day 1's number, the arrow, today's number, each over its
 * day. A screen reader hears it once, as the row's name.
 */
function Claim({ row, days }: { row: SinceRow; days: number }) {
  /* Four places a side do not stand at 56 and 72 in a 320 column: a long
     pair takes the step down, as a narrow phone does. */
  const long = places(row.a) + places(row.b) > 6.5;
  return (
    <div data-since-claim="" data-long={long ? "" : undefined}>
      <p className="sr-only">{sinceName(row, days)}</p>
      <div aria-hidden className="since-claim">
        <span className="since-from font-display font-extrabold tabular-nums">{row.a}</span>
        <SinceArrow className="since-claim-arrow" />
        <span className={`since-to font-display font-extrabold tabular-nums ${tone(row)}${better(row)}`}>{row.b}</span>
        <span className="since-day">Day 1</span>
        <span className="since-day since-day-to">Day {days}</span>
      </div>
    </div>
  );
}

export type LedgerRow = {
  key: string;
  label: string;
  /** Day 1's number; absent on a ledger of one recording. */
  a?: string;
  b: string;
  /** The colour class for `b`, and its mark when better. */
  tone?: string;
  /** Every number in the row, in words, for a screen reader. */
  name: string;
};

/**
 * The quiet ledger under a stage's hero: a row a measure, its rules the
 * ledger's own (DESIGN 7). Day 1's number stands right-aligned against
 * the arrow and today's left-aligned after it, so every arrow is in one
 * column and each pair reads as one.
 */
export function SinceLedger({ rows, room = false }: { rows: LedgerRow[]; room?: boolean }) {
  if (rows.length === 0) return null;
  const pairs = rows.some((r) => r.a !== undefined);
  return (
    <ul
      className="since-ledger"
      data-pairs={pairs ? "" : undefined}
      data-room={room ? "" : undefined}
      /* On the save wall each row takes a share of the stage's free height,
         as the hero takes one (`.since-stage[data-room]`). */
      style={room ? { flexGrow: rows.length } : undefined}
    >
      {rows.map((r) => (
        <li key={r.key}>
          <span className="sr-only">{r.name}</span>
          <span aria-hidden className="since-ledger-label text-caption">
            {r.label}
          </span>
          {pairs && (
            <>
              <span aria-hidden className="since-ledger-a font-display text-num-s tabular-nums">
                {r.a}
              </span>
              <SinceArrow className="since-ledger-arrow" />
            </>
          )}
          <span
            aria-hidden
            className={`since-ledger-b font-display text-num-m tabular-nums ${r.b === "—" ? "since-none" : r.tone ?? "text-cream"}`}
          >
            {r.b}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The stage both of the results' asks stand on (#526): Since day one and
 * the save wall, one family. The hero holds the middle of the free
 * height, its ledger and foot stand at the bottom. It takes the screen's
 * free height itself (`.since-stage`), so the room goes to the stage and
 * never to ground.
 */
export function SinceStage({
  hero,
  ledger,
  foot,
  room = false,
  line = false,
  style,
}: {
  hero: ReactNode;
  ledger?: ReactNode;
  foot?: ReactNode;
  /**
   * The stage sizes to the room it is given rather than to its contents
   * (the save wall), so a ledger marked `room` stands only where the
   * stage has the height for it (`.since-stage[data-room]`).
   */
  room?: boolean;
  /** Since day one draws its line over the claim (`.since-stage[data-line]`). */
  line?: boolean;
  /** The hero's shares, as custom properties (ComparisonCard). */
  style?: CSSProperties;
}) {
  return (
    <section
      data-since-stage=""
      data-room={room ? "" : undefined}
      data-line={line ? "" : undefined}
      style={style}
      className="since-stage card-stage elev-1 rounded-sheet text-cream"
    >
      <div className="since-hero arrive">{hero}</div>
      {ledger}
      {foot}
    </section>
  );
}
