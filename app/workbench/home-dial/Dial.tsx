/**
 * The dial: Direction A's one signature object (the workbench, #255).
 *
 * The Ethos Index as an instrument you read at a glance, the way the AC
 * dial and the kcal arc in docs/refs/home/ read: a 240 degree sweep of
 * ticks, lit in terracotta up to the value, the number huge at the
 * centre and the change since day one in the gap at the foot.
 *
 * The arrival is CSS only, so it starts with the first paint (no
 * hydration wait) and a strip can seek it frame by frame. The number
 * rolls up from zero on a registered integer property over the
 * celebration's 600ms on `--ease-out`, and each tick fades up from its
 * trough as the roll passes it, so the sweep and the number are one
 * motion (CountUp starts at 82% of the value; a dial sweeps from its
 * stop). Reduced motion lands both at once (home-dial.css).
 */

const N = 48;
const SWEEP = 240;
const VB_W = 300;
const VB_H = 252;
const CX = 150;
const CY = 146;
const R_IN = 118;
const R_OUT = 140;

/** The ramp's two ends, peach to terracotta, in each theme. */
const RAMP = {
  light: ["#f1cbac", "#c67139"],
  dark: ["#8a5634", "#e2864b"],
} as const;

/** A hex between two, `k` of the way from the first. */
function mix([from, to]: readonly [string, string], k: number) {
  const p = (h: string) => [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16));
  const [a, b] = [p(from), p(to)];
  return `#${a.map((v, j) => Math.round(v + (b[j] - v) * k).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * When the roll passes a fraction of the value, in ms: the inverse of
 * `--ease-out` (cubic-bezier(0.25, 1, 0.5, 1)) over the celebration's
 * 600ms, so each tick lights as the number reaches it.
 */
function passesAt(f: number) {
  const bez = (s: number, p1: number, p2: number) =>
    3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s;
  let lo = 0;
  let hi = 1;
  for (let n = 0; n < 24; n++) {
    const mid = (lo + hi) / 2;
    if (bez(mid, 1, 1) < f) lo = mid;
    else hi = mid;
  }
  return Math.round(bez(lo, 0.25, 0.5) * 600);
}

/** A point on the dial: `deg` from twelve o'clock, clockwise. */
function at(deg: number, r: number) {
  const a = (deg * Math.PI) / 180;
  return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) };
}

export function Dial({
  value,
  max,
  delta,
}: {
  value: number;
  max: number;
  /** The change since the first scored recording. */
  delta: number;
}) {
  const lit = Math.max(0, Math.min(N, Math.round((value / max) * N)));
  const step = SWEEP / (N - 1);
  const start = at(-SWEEP / 2, R_OUT + 16);
  const end = at(SWEEP / 2, R_OUT + 16);

  return (
    <div className="hd-dial relative mx-auto w-full max-w-[300px]" style={{ aspectRatio: `${VB_W} / ${VB_H}` }}>
      {/* The warm light behind the number. */}
      <div aria-hidden className="hd-dial-glow" style={{ top: `${(CY / VB_H) * 100}%` }} />
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden
        focusable="false"
      >
        {Array.from({ length: N }, (_, i) => {
          const deg = -SWEEP / 2 + i * step;
          const on = i < lit;
          const head = i === lit - 1;
          const a = at(deg, head ? R_IN - 7 : R_IN);
          const b = at(deg, head ? R_OUT + 5 : R_OUT);
          /* Peach at the start of the sweep, full terracotta at the
             value: the kcal arc's ramp, one ramp per theme. */
          const k = i / Math.max(1, lit - 1);
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="hd-tick" />
              {on && (
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={head ? "hd-tick-on hd-tick-head" : "hd-tick-on"}
                  style={
                    {
                      /* Half lit (its 200ms fade a third in) as the roll passes it. */
                      "--at": `${Math.max(0, passesAt((i + 1) / lit) - 70)}ms`,
                      "--tick-light": mix(RAMP.light, k),
                      "--tick-dark": mix(RAMP.dark, k),
                    } as React.CSSProperties
                  }
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* The scale's two ends, under the sweep's ends. */}
      <span
        aria-hidden
        className="hd-dial-end font-display absolute -translate-x-1/2 text-caption font-semibold tabular-nums text-stone-400"
        style={{ left: `${(start.x / VB_W) * 100}%`, top: `${(start.y / VB_H) * 100}%` }}
      >
        0
      </span>
      <span
        aria-hidden
        className="hd-dial-end font-display absolute -translate-x-1/2 text-caption font-semibold tabular-nums text-stone-400"
        style={{ left: `${(end.x / VB_W) * 100}%`, top: `${(end.y / VB_H) * 100}%` }}
      >
        {max}
      </span>

      {/* The reading, centred on the dial's centre. */}
      <div
        className="absolute inset-x-0 flex -translate-y-1/2 flex-col items-center text-center"
        style={{ top: `${(CY / VB_H) * 100}%` }}
      >
        <span className="eyebrow">Ethos Index</span>
        <span className="sr-only">
          {value} of {max}, {delta >= 0 ? "up" : "down"} {Math.abs(delta)} since day one
        </span>
        <span
          aria-hidden
          className="hd-count font-display mt-1 text-num-xl tabular-nums"
          style={{ "--hd-n": value, "--hd-from": 0 } as React.CSSProperties}
        />
        <span aria-hidden className="font-display mt-2 text-link font-semibold text-stone-500">
          <span className="text-sage-700">
            {delta >= 0 ? "+" : "−"}
            {Math.abs(delta)}
          </span>{" "}
          since day one
        </span>
      </div>
    </div>
  );
}
