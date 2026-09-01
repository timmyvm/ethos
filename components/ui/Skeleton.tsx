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
 *
 * Nothing here skeletons content the app already has. The floor card on
 * home comes out of `todaysDrill()` with no round trip, so it paints
 * immediately — putting a placeholder over locally-known content just
 * makes the app feel slower than it is.
 */

export function Skeleton({
  className = "",
  rounded = "rounded-[10px]",
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
      <Skeleton className="mt-2 h-6 w-10" />
      <Skeleton className="mt-2 h-2.5 w-10" />
    </div>
  );
}

/** A card the size of the stat tiles on the results screen. */
export function SkeletonStat() {
  return (
    <div className="flex-1 rounded-xl border border-edge p-3.5">
      <Skeleton className="h-2.5 w-12" />
      <Skeleton className="mt-2 h-6 w-10" />
      <Skeleton className="mt-2 h-2.5 w-14" />
    </div>
  );
}

/** One row of the training log — a hairline row, like the real one. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3.5 border-t border-hairline px-0.5 py-3">
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

/** The ink score card on home, and anything shaped like it. */
export function SkeletonScoreCard() {
  return (
    <section className="card-score mt-5 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-2.5 w-20 !bg-cream/10" />
          <Skeleton className="mt-2.5 h-12 w-32 !bg-cream/10" />
        </div>
        <div className="shrink-0 space-y-3">
          <Skeleton className="h-5 w-10 !bg-cream/10" />
          <Skeleton className="h-5 w-10 !bg-cream/10" />
        </div>
      </div>
      <div className="mt-4 border-t border-cream/10 pt-4">
        <Skeleton className="h-4 w-full !bg-cream/10" />
      </div>
    </section>
  );
}
