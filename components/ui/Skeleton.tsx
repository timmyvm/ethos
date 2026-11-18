import { HeroStage } from "@/components/ui/HeroStage";

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
 * The Log's stage (#506, components/log/LogStage.tsx) while the Log
 * reads: the stage at its landed height (`.log-stage`), the eyebrow, the
 * number at its own size and the pill, each a bar where the words will
 * be, so nothing moves when the numbers land (PRINCIPLES 8).
 */
export function SkeletonLogStage() {
  /* On the house stage: the bars read the stage's bone (`.practice-stage .skeleton`). */
  const bar = "absolute inset-y-[22%] left-0";
  return (
    <HeroStage className="log-stage">
      <Line className="eyebrow" bar={`${bar} w-20`} />
      <Line className="log-number font-display mt-1" bar={`${bar} w-40`} text="000" />
      <Skeleton className="log-change w-48" rounded="rounded-full" />
    </HeroStage>
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
