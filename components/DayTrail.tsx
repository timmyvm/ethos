"use client";

import type { DayTrail as Trail } from "@/lib/days";

/**
 * The day counter and its line, sitting inside the score card on home.
 *
 * Deliberately not a third card: DECISIONS #9 gives the floor the screen
 * and brand.md allows one tap, so this earns its place by living in
 * furniture that already exists. It's a strip, not a chart — the Log
 * owns real charts.
 *
 * The line is quiet stone with only the newest point amber, the same
 * rule the Log's sparkline uses: the trend is the shape, the last day is
 * the event, and amber stays the colour of something earned.
 *
 * It gets better with time by construction. One day is a number, two is
 * a line, thirty is a shape you can read at a glance — the reward for
 * staying is that the thing on your home screen becomes more worth
 * looking at.
 */
export function DayTrail({ trail }: { trail: Trail }) {
  if (trail.count === 0) return null;

  return (
    <div className="mt-4 border-t border-white/10 pt-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="label-data !text-stone-500">Day</span>
          <span className="font-display text-[19px] font-bold leading-none">
            {trail.count}
          </span>
        </div>
        {/* Amber only when earned, and only for something the card above
            doesn't already say. */}
        {trail.bestYet && (
          <span className="text-[12px] font-semibold text-amber-500">
            best day yet
          </span>
        )}
      </div>

      {trail.pending ? (
        <p className="mt-1.5 text-[12px] text-stone-500">{trail.pending}</p>
      ) : (
        <Line trail={trail} />
      )}
    </div>
  );
}

function Line({ trail }: { trail: Trail }) {
  const values = trail.points.map((p) => p.index as number);
  const w = 300;
  const h = 34;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 8) - 4;
    return [x, y] as const;
  });
  const d = pts
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const [lx, ly] = pts[pts.length - 1];

  const firstDay = trail.points[0].day;
  const lastDay = trail.points[trail.points.length - 1].day;

  return (
    <>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-2 w-full"
        style={{ height: h }}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Ethos Index by training day: ${values.join(", ")}`}
      >
        <path d={`${d} L${w},${h} L0,${h} Z`} fill="rgba(255,255,255,0.05)" />
        <path
          d={d}
          fill="none"
          stroke="#A8A29E"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={lx} cy={ly} r="3.5" fill="#F59E0B" />
      </svg>
      <div className="flex justify-between">
        <span className="label-data !text-stone-500">day {firstDay}</span>
        <span className="label-data !text-stone-500">day {lastDay}</span>
      </div>
    </>
  );
}
