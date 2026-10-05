/**
 * Progress as square segments (M10): `done` of `total` filled in sage,
 * the rest in the trough. Square like every bar in the app, 4px tall,
 * 4px apart, each at least 12px so a long count still reads as pieces.
 *
 * Unknown progress (loading, or a read that failed) is never drawn as
 * zero (PRINCIPLES 8): `unknown` reserves the bar's exact height with
 * nothing in it, so nothing moves when the count lands.
 *
 * Decorative: the count beside it is the accessible text.
 *
 *   <SegmentBar total={3} done={progress?.done ?? 0} unknown={progress === null} />
 */
export function SegmentBar({
  total,
  done,
  unknown = false,
  className = "",
}: {
  total: number;
  done: number;
  unknown?: boolean;
  className?: string;
}) {
  if (unknown) return <div aria-hidden className={`h-1 w-full ${className}`} />;
  return (
    <div aria-hidden className={`flex w-full gap-1 ${className}`}>
      {Array.from({ length: Math.max(0, total) }, (_, i) => (
        <span key={i} className={`h-1 min-w-3 flex-1 ${i < done ? "bg-sage-500" : "bg-sand"}`} />
      ))}
    </div>
  );
}
