import type { ReactNode } from "react";
import type { RepRow } from "@/lib/client-data";
import { sinceDayOneCard, sinceName, type SinceRow } from "@/lib/since-day-one";

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
 * the first and the latest measured recordings: sage only where the
 * drawn number got better, rust where it got worse, plain where it held
 * or is unknown, and the way it went is in each row's name.
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

  return (
    <SinceStage
      hero={
        <>
          {/* The claim's label is its eyebrow; the claim's own name says it. */}
          <p aria-hidden className="eyebrow since-eyebrow">
            {claim.label}
          </p>
          <Claim row={claim} days={card.days} />
        </>
      }
      ledger={
        <SinceLedger
          rows={ledger.map((r) => ({ key: r.key, label: r.label, a: r.a, b: r.b, tone: tone(r), name: sinceName(r, card.days) }))}
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
function tone(r: SinceRow): string {
  return r.better === true ? "text-sage-lit" : r.better === false ? "text-rust-lit" : "text-cream";
}

/** The arrow between two numbers: drawn, so it sits on the figures' middle at any size. */
export function SinceArrow({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" className={`since-arrow ${className}`}>
      <path d="M3 12h17M14 5.5 20.5 12 14 18.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The claim: day 1's number, the arrow, today's number, each over its
 * day. A screen reader hears it once, as the row's name.
 */
function Claim({ row, days }: { row: SinceRow; days: number }) {
  /* Four places a side do not stand at 56 and 72 in a 320 column: a long
     pair takes the step down, as a narrow phone does. */
  const places = (s: string) => s.replace(".", "").length + (s.includes(".") ? 0.5 : 0);
  const long = places(row.a) + places(row.b) > 6.5;
  return (
    <div data-since-claim="" data-long={long ? "" : undefined}>
      <p className="sr-only">{sinceName(row, days)}</p>
      <div aria-hidden className="since-claim">
        <span className="since-from font-display font-extrabold tabular-nums">{row.a}</span>
        <SinceArrow className="since-claim-arrow" />
        <span className={`since-to font-display font-extrabold tabular-nums ${tone(row)}`}>{row.b}</span>
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
  /** The colour class for `b`. */
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
    <ul className="since-ledger" data-pairs={pairs ? "" : undefined} data-room={room ? "" : undefined}>
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
          <span aria-hidden className={`since-ledger-b font-display text-num-m tabular-nums ${r.tone ?? "text-cream"}`}>
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
}) {
  return (
    <section data-since-stage="" data-room={room ? "" : undefined} className="since-stage card-stage elev-1 rounded-sheet text-cream">
      <div className="since-hero arrive">{hero}</div>
      {ledger}
      {foot}
    </section>
  );
}
