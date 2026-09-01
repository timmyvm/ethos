/**
 * Progress chart — SVG, no library. Numbers are the brand (brand.md),
 * so the chrome is an eyebrow and a range: the line shows the trend,
 * the header says where it started and where it is now, and the range
 * wears the direction (#195 — olive when the number moved the right
 * way, rust when it didn't).
 *
 * The strokes are read from the theme rather than written down: a chart
 * is UI, and half the app is dark. Two voices per the handoff (#201):
 * the hero series draws in olive, an inverted series (fillers — lower
 * is better) in the quiet on-dark grey, so falling never looks like
 * fading.
 */
export function Sparkline({
  values,
  label,
  invert = false,
  height = 48,
}: {
  values: number[];
  label: string;
  /** True when lower is better (fillers) — flips the "improving" test. */
  invert?: boolean;
  height?: number;
}) {
  if (values.length < 2) {
    return (
      <div className="rounded-xl border border-edge px-4 py-3.5">
        <div className="label-data">{label}</div>
        <p className="mt-2 text-[13px] text-stone-500">
          Two scores and this becomes a line. One more to go.
        </p>
      </div>
    );
  }

  const w = 320;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = height - ((v - min) / span) * (height - 10) - 5;
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const better = invert ? delta < 0 : delta > 0;
  const fmt = (v: number) => String(Math.round(v * 10) / 10);

  return (
    <div className="rounded-xl border border-edge px-4 py-3.5">
      <div className="flex items-baseline justify-between">
        <div className="label-data">{label}</div>
        <div
          className={`font-display text-[13px] font-bold tabular-nums ${
            delta === 0
              ? "text-stone-500"
              : better
                ? "text-sage-700"
                : "text-rust"
          }`}
        >
          {fmt(first)} → {fmt(last)}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        className="mt-2 w-full"
        style={{ height }}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: ${values.map((v) => Math.round(v)).join(", ")}`}
      >
        <path
          d={d}
          fill="none"
          stroke={invert ? "var(--color-sage-mist)" : "var(--color-sage-700)"}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
