import type { ReactNode } from "react";

/**
 * The score card: the hero of every data screen (#18, #165, #217).
 *
 * Home and the log draw the same card, because a person should learn
 * this shape once. The delta sits top right in the label register
 * (#195: sage up, rust down), the Index is the 58px hero, recordings
 * and stars are the two small stats on the right.
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
    <section className="card-score mt-5 rounded-2xl p-5 text-cream">
      <div className="flex items-baseline justify-between gap-3">
        <div className="label-data !text-sage-mist">Your Ethos</div>
        {delta !== null && delta !== 0 && (
          <div
            className={`font-display text-[13px] font-semibold uppercase tracking-[0.02em] tabular-nums ${
              delta > 0 ? "text-sage-lit" : "text-rust-lit"
            }`}
          >
            {delta > 0 ? "▲ +" : "▼ "}
            {Math.abs(delta)} since day one
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="font-display text-[58px] font-extrabold leading-none tracking-[-0.02em]">
            {empty ? 0 : (index ?? "—")}
          </span>
          <span className="text-[15px] text-sage-mist">
            {empty ? "recordings" : "/ 1000"}
          </span>
        </div>
        <div className="shrink-0 space-y-2 text-right tabular-nums">
          {empty ? (
            <div>
              <div className="font-display text-[19px] font-extrabold leading-none">
                &mdash; / 1000
              </div>
              <div className="label-data !text-sage-mist">index</div>
            </div>
          ) : (
            <div>
              <div className="font-display text-[19px] font-extrabold leading-none">
                {recordings}
              </div>
              {/* "recordings", not "reps": the counter names the thing
                  it counts (#164). */}
              <div className="label-data !text-sage-mist">
                {recordings === 1 ? "recording" : "recordings"}
              </div>
            </div>
          )}
          <div>
            <div className="font-display text-[19px] font-extrabold leading-none">
              {stars}
            </div>
            <div className="label-data !text-sage-mist">
              {stars === 1 ? "star" : "stars"}
            </div>
          </div>
        </div>
      </div>
      {children}
      {foot && (
        <div className="mt-3 border-t border-cream/15 pt-2.5 text-[12px] text-sage-mist">
          {foot}
        </div>
      )}
    </section>
  );
}
