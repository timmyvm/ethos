/**
 * Progress chart — SVG, no library. Numbers are the brand (brand.md),
 * so the line is quiet stone and only the newest point is amber: the
 * chart shows the trend, the last rep is the event.
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
      <div className="rounded-[18px] border border-black/5 bg-white p-5">
        <div className="label-data">{label}</div>
        <p className="mt-2 text-[13px] text-stone-500">
          Two reps and this becomes a line. One more to go.
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
    <div className="rounded-[18px] border border-black/5 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <div className="label-data">{label}</div>
        <div
          className={`text-[13px] font-semibold ${
            delta === 0 ? "text-stone-500" : better ? "text-amber-500" : "text-stone-500"
          }`}
        >
          {delta > 0 ? "+" : ""}
          {Math.round(delta * 10) / 10} since rep 1
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
        <path d={area} fill="#F5F0E8" />
        <path d={d} fill="none" stroke="#78716C" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={lx} cy={ly} r="4" fill="#F59E0B" />
      </svg>
      <div className="mt-1 flex justify-between">
        <span className="label-data">rep 1 · {Math.round(first)}</span>
        <span className="label-data">now · {Math.round(last)}</span>
      </div>
    </div>
  );
}
