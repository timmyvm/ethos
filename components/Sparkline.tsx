/**
 * Progress chart — SVG, no library. Numbers are the brand (brand.md),
 * so the line is quiet stone and only the newest point is sage: the
 * chart shows the trend, the last rep is the event.
 *
 * The three colours are read from the theme rather than written down.
 * They were hexes tuned for cream — a sand fill and a stone-500 line —
 * which in dark mode drew a pale slab and a near-invisible trace over a
 * dark card: a chart is UI, and half the app is dark.
 */
export function Sparkline({
  values,
  label,
  invert = false,
  height = 64,
}: {
  values: number[];
  label: string;
  /** True when lower is better (fillers) — flips the "improving" test. */
  invert?: boolean;
  height?: number;
}) {
  if (values.length < 2) {
    return (
      <div className="rounded-[24px] border border-hairline bg-surface lift p-5">
        <div className="label-data">{label}</div>
        <p className="mt-2 text-[13px] text-stone-500">
          Two scores and this becomes a line. One more to go.
        </p>
      </div>
    );
  }

  const w = 300;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = height - ((v - min) / span) * (height - 10) - 5;
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${w},${height} L0,${height} Z`;

  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const better = invert ? delta < 0 : delta > 0;
  const [lx, ly] = pts[pts.length - 1];

  return (
    <div className="rounded-[24px] border border-hairline bg-surface lift p-5">
      <div className="flex items-baseline justify-between">
        <div className="label-data">{label}</div>
        {/* Green = improving, red = regressing, whichever way the
            metric runs (#195): fillers falling is sage, rising is
            terracotta. Neutral only when genuinely flat. */}
        <div
          className={`text-[13px] font-semibold ${
            delta === 0
              ? "text-stone-500"
              : better
                ? "text-sage-700"
                : "text-terracotta-600"
          }`}
        >
          {delta > 0 ? "+" : ""}
          {Math.round(delta * 10) / 10} since day one
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        className="mt-3 w-full"
        style={{ height }}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: ${values.map((v) => Math.round(v)).join(", ")}`}
      >
        <path d={area} fill="var(--color-sand)" />
        <path d={d} fill="none" stroke="var(--color-stone-500)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle
          cx={lx}
          cy={ly}
          r="4"
          fill={
            delta === 0 || better
              ? "var(--color-sage-500)"
              : "var(--color-terracotta-500)"
          }
        />
      </svg>
      <div className="mt-1 flex justify-between">
        <span className="label-data">first · {Math.round(first)}</span>
        <span className="label-data">now · {Math.round(last)}</span>
      </div>
    </div>
  );
}
