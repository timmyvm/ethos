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
