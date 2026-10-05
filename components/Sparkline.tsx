/**
 * Progress chart — SVG, no library. Numbers are the brand (brand.md),
 * so the chrome is an eyebrow and a range: the line shows the trend,
 * the header says where it started and where it is now, and the range
 * wears the direction (#195 — olive when the number moved the right
 * way, rust when it didn't).
 *
 * The strokes are read from the theme rather than written down: a chart
 * is UI, and half the app is dark. Two voices (#201's grammar): the
 * hero series draws in sage, an inverted series (fillers — lower is
 * better) in quiet stone, so falling never looks like fading.
 */
export function Sparkline({
  values,
  labelValues,
  label,
  invert = false,
  height = 48,
  bare = false,
  color,
}: {
  values: number[];
  /**
   * The numbers a screen reader hears, when the line draws something
   * else: the Log's rows draw a trailing mean (log-23) and announce
   * the raw series. Defaults to `values`.
   */
  labelValues?: number[];
  label: string;
  /** True when lower is better (fillers) — flips the "improving" test. */
  invert?: boolean;
  height?: number;
  /**
   * The line alone, no box, no eyebrow, no range chip: the trend track
   * at the end of a "What moved" row (#217), where the row already
   * says where the number started and where it is now.
   */
  bare?: boolean;
  /**
   * The line's ink, as a CSS colour. The log's rows pass their trait's
   * `var(--tone)` (or sage for the Index), so a trend reads in the same
   * colour the trait wears everywhere else, and the line gets a faint
   * wash of that colour under it. Direction stays the change column's
   * job, in sage and rust. Unset, the older two voices hold.
   */
  color?: string;
}) {
  if (bare) {
    return (
      /*
       * `.fill`: the track unrolls left to right as the row's "now"
       * cell counts, so the series and the number it summarises land
       * on the same clock instead of the line simply being there. It
       * is the same event as the count (#225), transform-only, and it
       * collapses to nothing under reduced motion like every other
       * fill.
       */
      <Trace
        values={values}
        labelValues={labelValues}
        label={label}
        invert={invert}
        height={height}
        className="fill w-full"
        stroke={1.5}
        color={color}
      />
    );
  }

  if (values.length < 2) {
    return (
      <div className="card p-4">
        <div className="eyebrow">{label}</div>
        <p className="mt-3 text-caption text-stone-500">
          Two scores and this becomes a line. One more to go.
        </p>
      </div>
    );
  }

  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const better = invert ? delta < 0 : delta > 0;
  const fmt = (v: number) => String(Math.round(v * 10) / 10);

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <div className="eyebrow">{label}</div>
        <div
          className={`font-display text-caption font-extrabold tabular-nums ${
            delta === 0
              ? "text-stone-500"
              : better
                ? "text-sage-700"
                : "text-rust"
          }`}
        >
          {fmt(first)} to {fmt(last)}
        </div>
      </div>
      <Trace
        values={values}
        labelValues={labelValues}
        label={label}
        invert={invert}
        height={height}
        className="mt-3 w-full"
      />
    </div>
  );
}

/**
 * The line itself. Under two values there is no line to draw, so the
 * track is an empty sand slot at the height the line will take: the
 * first recording fills a shape that was already on the screen (#213).
 */
function Trace({
  values,
  labelValues = values,
  label,
  invert,
  height,
  className,
  stroke = 2,
  color,
}: {
  values: number[];
  labelValues?: number[];
  label: string;
  invert: boolean;
  height: number;
  className: string;
  /** 1.5 in a 44px row track, where 2px of ink reads as hatching. */
  stroke?: number;
  /** See Sparkline. When set, the line also gets a wash under it. */
  color?: string;
}) {
  if (values.length < 2) {
    return (
      /* A span: the Log's Fillers row puts this inside a button, where
         only phrasing content is valid (log-21). */
      <span
        className={`${className} flex items-center`}
        style={{ height }}
        aria-hidden
      >
        <span className="h-1 w-full bg-sand" />
      </span>
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
  const ink = color ?? (invert ? "var(--color-stone-400)" : "var(--color-sage-700)");

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className={className}
      style={{ height }}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}: ${labelValues.map((v) => Math.round(v)).join(", ")}`}
    >
      {color && (
        /* The wash: the area under the line in the line's own colour,
           faint enough that the stroke stays the reading. */
        <path
          d={`${d} L${w},${height} L0,${height} Z`}
          fill={color}
          fillOpacity={0.14}
          stroke="none"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={ink}
        strokeWidth={stroke}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
