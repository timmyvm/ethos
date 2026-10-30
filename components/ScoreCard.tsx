import type { ReactNode } from "react";
import { CountUp } from "@/components/CountUp";
import { DemosArt } from "@/components/DemosArt";
import { HeroStage } from "@/components/ui/HeroStage";
import { DURATION } from "@/lib/motion";

/**
 * The score card: the hero of every data screen (#18, #165, #217).
 *
 * The log and About draw the same card, because a person should learn
 * this shape once. The Index is the 56px hero with its change right
 * under it (log-15), and the counts are the stage's foot line.
 *
 * THE MATERIAL (the cohesion pass, 26 Oct). It was the deep sage card
 * (#165), its own colour world: a first-time tester read the tabs as
 * "none of the pages match really", and the Log's olive slab was one of
 * five worlds. It is the house stage now (`HeroStage`), the sky every
 * tab's hero stands on, and sage leaves it: sage still marks what is
 * earned (the stars on the rows, Today's chips), and the change is said
 * in the stage's ink with its arrow, up or down.
 *
 * THE ART is the Index's own history, drawn as a hill on the stage's
 * floor at the right (`series`, a trailing mean of three, so a noisy run
 * reads as a direction): a picture made of the number it sits beside,
 * never decoration. Its fill runs to the stage's edge and the stage's
 * corner clips it, so it has no cut where the series ends. Until there
 * are two scored recordings there is no hill, and on a screen that has
 * no other Demos (`demos`, the Log) he stands in its place, the empty
 * state's figure, the way he stands on every other tab's stage.
 *
 * Before any recording the hero is the COUNT (#213): zero recordings is
 * a true number, where 0 / 1000 would claim you scored nothing, and the
 * Index keeps its honest dash on the line under it.
 */
export function ScoreCard({
  index,
  delta,
  recordings,
  stars,
  foot,
  series,
  span,
  demos = false,
  children,
}: {
  index: number | null;
  /** Against the first scored recording. Null until there are two. */
  delta: number | null;
  recordings: number;
  stars: number;
  /** One quiet line under the counts (About's "a sample"). */
  foot?: ReactNode;
  /** The Index over time, oldest first, for the hill. */
  series?: number[];
  /** The first and last scored recordings' dates ("4 Oct", "29 Oct"),
      under the hill's two ends (D32), so the line has a time axis. */
  span?: [string, string];
  /** Demos may stand on the stage while there is no hill (the Log; About
      has its own Demos in its hero, and one is the most a screen has). */
  demos?: boolean;
  /** Anything the screen adds after the number. */
  children?: ReactNode;
}) {
  const empty = recordings === 0;
  const hill = !empty && series && series.length > 1 ? series : null;
  return (
    <HeroStage
      eyebrow="Your Ethos"
      artSize={hill ? 136 : undefined}
      artFluid={!!hill}
      artBleed={!!hill}
      art={
        hill ? (
          <>
            <IndexHill values={hill} />
            {span && (
              /* 13/600 in the stage's ink, 12 off the stage's foot, each
                 under its end of the line: the start at the box's left, the end 8 of 136 in,
                 where the line stops (the drawing fills the box's width
                 at every size, so a percentage holds it there). */
              <span aria-hidden className="stage-ink font-display text-caption font-semibold tabular-nums">
                <span className="absolute bottom-3 left-0 leading-none">{span[0]}</span>
                <span className="absolute bottom-3 right-[5.9%] leading-none">{span[1]}</span>
              </span>
            )}
          </>
        ) : demos ? (
          <DemosArt pose="hello" size={132} grounded halo={{ tone: "sky", kind: "stage" }} />
        ) : undefined
      }
      line={
        <div className="mt-auto pt-3">
          <p className="stage-ink font-display text-link font-bold tabular-nums">
            {empty ? (
              "— / 1000 index"
            ) : (
              <>
                {recordings} {recordings === 1 ? "recording" : "recordings"}, {stars}{" "}
                {stars === 1 ? "star" : "stars"}
              </>
            )}
          </p>
          {foot && <p className="stage-ink mt-0.5 text-caption">{foot}</p>}
        </div>
      }
    >
      <div className="mt-1 flex items-baseline gap-1.5">
        {/* The hero counts on arrival like every number under it
            (#245). Not when there is nothing to count: zero recordings
            is a fact, not a climb, and a dash is not a number at all. */}
        {empty || index === null ? (
          <span className="font-display text-num-hero font-extrabold tabular-nums">
            {empty ? 0 : "—"}
          </span>
        ) : (
          <CountUp
            value={index}
            durationMs={DURATION.max}
            className="font-display text-num-hero font-extrabold tabular-nums"
          />
        )}
        <span className="stage-ink whitespace-nowrap text-body">
          {empty ? "recordings" : "/ 1000"}
        </span>
      </div>
      {/* The change, read with the number it changes (log-15): a line
          under the hero, in words, in the stage's ink with its arrow. */}
      {delta !== null && delta !== 0 && (
        <div className="stage-ink font-display mt-0.5 text-link font-bold tabular-nums">
          {delta > 0 ? "▲ +" : "▼ "}
          {Math.abs(delta)} since day one
        </div>
      )}
      {children}
    </HeroStage>
  );
}

/**
 * The Index's history as a hill standing on the stage's floor: a filled
 * area under a 2px line in the stage's ink, today's point marked. A
 * trailing mean of three, the way the log's trend column reads it, and
 * scaled to its own range with air above and below, so the shape is the
 * direction. Decorative (the number beside it is the reading).
 */
function IndexHill({ values }: { values: number[] }) {
  const W = 136;
  const H = 84;
  const smooth = values.map((_, i) => {
    const w = values.slice(Math.max(0, i - 2), i + 1);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  const lo = Math.min(...smooth);
  const hi = Math.max(...smooth);
  const span = Math.max(1, hi - lo);
  const top = 10;
  /* 34 under the line's lowest point: the dates stand there (D32), 12
     off the stage's foot with about 8 of air under the line, so "4 Oct"
     hangs under the line's start instead of touching it. */
  const floor = H - 34;
  const pts = smooth.map((v, i) => [
    (i / (smooth.length - 1)) * (W - 8),
    floor - ((v - lo) / span) * (floor - top),
  ]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${W}`}
      preserveAspectRatio="xMaxYMax meet"
      aria-hidden
      focusable="false"
      className="stage-ink block"
    >
      <defs>
        {/* The hill rises out of the stage: its fill fades in from the
            left, so it has no cut edge where the series starts. */}
        <linearGradient id="index-hill-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity={0} />
          <stop offset="0.35" stopColor="currentColor" stopOpacity={0.16} />
          <stop offset="1" stopColor="currentColor" stopOpacity={0.16} />
        </linearGradient>
      </defs>
      <g transform={`translate(0 ${W - H})`}>
        {/* Past today's point the ground runs on flat to the box's edge,
            which is the stage's: the stage's corner clips it. */}
        <path
          d={`${line} L${W} ${ly.toFixed(1)} L${W} ${H} L0 ${H} Z`}
          fill="url(#index-hill-fade)"
        />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={lx} cy={ly} r={3.5} fill="currentColor" />
      </g>
    </svg>
  );
}
