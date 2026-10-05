/**
 * Loading placeholders.
 *
 * These exist to fix a correctness problem, not to look busy. `/you` and
 * `/path` initialised their state to empty arrays and zeroes, so for the
 * few hundred milliseconds before the fetch landed they rendered "Level
 * 1 · 0 XP · 0 coins · 0-day streak" — numbers that are not true, to a
 * user who may have a hundred reps behind them. `lib/client-data.ts`
 * already says the rule: honest empty states, never fake numbers. A
 * skeleton is how you keep that promise while the real numbers are in
 * flight.
 *
 * Two rules follow from that:
 *
 * 1. **A skeleton is not an empty state.** It only ever renders while
 *    data is genuinely in flight (state is `null`, not `[]`). Once the
 *    fetch lands with nothing, the real "nothing logged yet" state
 *    takes over — a permanent shimmer would be a lie in the other
 *    direction.
 * 2. **It has to match what replaces it.** Same heights, same
 *    radii, same gaps, so content arriving doesn't shove the page. A
 *    placeholder that causes the shift it was meant to prevent is worse
 *    than the pop.
 */

export function Skeleton({
  className = "",
  rounded = "rounded-control",
}: {
  className?: string;
  rounded?: string;
}) {
  return <span aria-hidden className={`skeleton block ${rounded} ${className}`} />;
}

/**
 * Wraps a loading region. `aria-busy` plus one piece of live text is
 * what a screen reader needs — the shimmer blocks themselves are
 * decorative and stay hidden, so without this the page is silent.
 */
export function SkeletonRegion({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/**
 * The stat row on /you, which is three labelled numbers on the ground
 * rather than three cards (DECISIONS #151) — so its placeholder is three
 * bars on the ground too. A skeleton that draws furniture the content
 * doesn't have is the layout shift it exists to prevent.
 */
export function SkeletonStatBare() {
  return (
    <div className="flex-1">
      <Skeleton className="h-2.5 w-12" />
      <Skeleton className="mt-1.5 h-7 w-10" />
      <Skeleton className="mt-1.5 h-3 w-10" />
    </div>
  );
}

/** A card the size of the stat tiles on the results screen. */
export function SkeletonStat() {
  return (
    <div className="card flex-1 p-4">
      <Skeleton className="h-2.5 w-12" />
      <Skeleton className="mt-2 h-6 w-10" />
      <Skeleton className="mt-2 h-2.5 w-14" />
    </div>
  );
}

/** One row of the log — a hairline row, like the real one. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3.5 border-t border-hairline py-3">
      <div className="w-11 shrink-0">
        <Skeleton className="h-2.5 w-8" />
        <Skeleton className="mt-1.5 h-5 w-7" />
      </div>
      <div className="flex-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-2.5 w-40" />
      </div>
    </div>
  );
}

/**
 * The clean run on Today (#267).
 *
 * Shaped to the card it stands in for, not to the one that used to be
 * there: a 104px ring with a paragraph beside it, then the footer rule,
 * then the day trail. The score card's skeleton is 12px of number and
 * two chips, which is a different height, and a skeleton that reserves
 * the wrong space is the layout shift this file exists to prevent.
 */
export function SkeletonCleanRun() {
  return (
    <section className="card-score rounded-sheet p-5">
      <Skeleton className="h-2.5 w-36 !bg-cream/10" />
      <div className="mt-4 flex items-center gap-5">
        <div className="size-[104px] shrink-0 rounded-full border-[9px] border-cream/10" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-4 w-full !bg-cream/10" />
          <Skeleton className="h-4 w-4/5 !bg-cream/10" />
        </div>
      </div>
      <div className="mt-4 border-t border-cream/15 pt-2.5">
        <Skeleton className="h-3 w-40 !bg-cream/10" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-8 w-full !bg-cream/10" />
      </div>
    </section>
  );
}

/**
 * The score card, on /history. Built from the card's own type roles with
 * the words hidden (`Line`), so every line is exactly the height of the
 * line it stands in for and nothing moves when the numbers land
 * (PRINCIPLES 8): the eyebrow, the 56px hero, the two stats on the
 * right (which set the row's height, with or without the change line),
 * then the foot.
 */
export function SkeletonScoreCard() {
  const bar = "absolute inset-y-[22%] left-0 !bg-cream/10";
  return (
    <section className="card-score rounded-sheet p-5">
      <Line className="eyebrow" bar={`${bar} w-20`} />
      <div className="mt-1 flex items-start justify-between gap-4">
        <Line className="font-display text-num-hero" bar={`${bar} w-32`} text="000" />
        <div className="shrink-0 space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col items-end">
              <Line className="font-display text-num-m" bar={`${bar} !left-auto right-0 w-10`} text="00" />
              <Line className="label-data" bar={`${bar} !left-auto right-0 w-16`} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 border-t border-cream/15 pt-2.5">
        <Line className="text-caption" bar={`${bar} w-36`} />
      </div>
    </section>
  );
}

/** One line of type, its words invisible and a bar where they would be. */
function Line({ className, bar, text = "Ag" }: { className: string; bar: string; text?: string }) {
  return (
    <div className={`relative ${className}`}>
      <span className="invisible">{text}</span>
      <Skeleton className={bar} />
    </div>
  );
}
