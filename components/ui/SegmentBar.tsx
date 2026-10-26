/**
 * Progress as square segments (M10): `done` of `total` filled (sage, or
 * the stage's ink on the hero stage),
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
  tone = "earned",
}: {
  total: number;
  done: number;
  unknown?: boolean;
  className?: string;
  /**
   * One rule for progress (the fix round): what you earned fills in sage
   * on the sand trough (`earned`); on the hero stage it draws in the
   * stage's own ink on its bone (`stage`). Grey is only ever the trough:
   * the cohesion pass's stone fill in Lessons' list was the fourth colour
   * the app drew progress in.
   */
  tone?: "earned" | "stage";
}) {
  if (unknown) return <div aria-hidden className={`h-1 w-full ${className}`} />;
  const [fill, trough] =
    tone === "stage" ? ["stage-fill", "stage-trough"] : ["bg-sage-500", "bg-sand"];
  return (
    <div aria-hidden className={`flex w-full gap-1 ${className}`}>
      {Array.from({ length: Math.max(0, total) }, (_, i) => (
        <span key={i} className={`h-1 min-w-3 flex-1 ${i < done ? fill : trough}`} />
      ))}
    </div>
  );
}
