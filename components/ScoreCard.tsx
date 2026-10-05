import type { ReactNode } from "react";
import { CountUp } from "@/components/CountUp";
import { DURATION } from "@/lib/motion";

/**
 * The score card: the hero of every data screen (#18, #165, #217).
 *
 * Home, the log and About draw the same card, because a person should
 * learn this shape once. The Index is the 56px hero with its change
 * right under it (log-15; #195: sage up, rust down), and recordings and
 * stars are the two stats on the right, starting level with the hero.
 *
 * Before any recording the hero is the COUNT (#213): zero recordings is
 * a true number, where 0 / 1000 would claim you scored nothing, and the
 * Index keeps its honest dash at the size a dash can carry.
 */
export function ScoreCard({
  index,
  delta,
  recordings,
  stars,
  foot,
  children,
}: {
  index: number | null;
  /** Against the first scored recording. Null until there are two. */
  delta: number | null;
  recordings: number;
  stars: number;
  /** One line under the hairline, in the card's quiet voice. */
  foot?: ReactNode;
  /** Anything the screen adds after the stats (Home's day trail). */
  children?: ReactNode;
}) {
  const empty = recordings === 0;
  return (
    <section className="card-score rounded-sheet p-5 text-cream">
      <div className="eyebrow text-sage-mist">Your Ethos</div>
      <div className="mt-1 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            {/* The hero counts on arrival like every number under it
                (#245). Not when there is nothing to count: zero
                recordings is a fact, not a climb, and a dash is not a
                number at all. */}
            {empty || index === null ? (
              <span className="font-display text-num-hero tabular-nums">
                {empty ? 0 : "—"}
              </span>
            ) : (
              <CountUp
                value={index}
                durationMs={DURATION.max}
                className="font-display text-num-hero tabular-nums"
              />
            )}
            <span className="text-body text-sage-mist">
              {empty ? "recordings" : "/ 1000"}
            </span>
          </div>
          {/* The change, read with the number it changes (log-15): a
              line under the hero, sage-lit up and rust-lit down (#195),
              in words, not a tracked label in the far corner. */}
          {delta !== null && delta !== 0 && (
            <div
              className={`font-display mt-1.5 text-link tabular-nums ${
                delta > 0 ? "text-sage-lit" : "text-rust-lit"
              }`}
            >
              {delta > 0 ? "▲ +" : "▼ "}
              {Math.abs(delta)} since day one
            </div>
          )}
        </div>
        <div className="shrink-0 space-y-2 text-right tabular-nums">
          {empty ? (
            <div>
              <div className="font-display text-num-m">&mdash; / 1000</div>
              <div className="label-data !text-sage-mist">index</div>
            </div>
          ) : (
            <div>
              <div className="font-display text-num-m">{recordings}</div>
              {/* "recordings", not "reps": the counter names the thing
                  it counts (#164). */}
              <div className="label-data !text-sage-mist">
                {recordings === 1 ? "recording" : "recordings"}
              </div>
            </div>
          )}
          <div>
            <div className="font-display text-num-m">{stars}</div>
            <div className="label-data !text-sage-mist">
              {stars === 1 ? "star" : "stars"}
            </div>
          </div>
        </div>
      </div>
      {children}
      {foot && (
        <div className="mt-3 border-t border-cream/15 pt-2.5 text-caption text-sage-mist">
          {foot}
        </div>
      )}
    </section>
  );
}
