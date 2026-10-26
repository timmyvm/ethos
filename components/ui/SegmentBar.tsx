/**
 * Progress as square segments (M10): `done` of `total` filled (sage, or
 * stone in a list, or the stage's ink on the hero stage),
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
   * `earned` fills in sage. `neutral` fills in stone on the sand trough
   * (a list's progress under the hero: the cohesion pass keeps colour off
   * everything under the stage). `stage` draws in the stage's own ink on
   * its bone, for a bar standing on the hero stage.
   */
  tone?: "earned" | "neutral" | "stage";
}) {
  if (unknown) return <div aria-hidden className={`h-1 w-full ${className}`} />;
  const [fill, trough] =
    tone === "stage"
      ? ["stage-fill", "stage-trough"]
      : tone === "neutral"
        ? ["bg-stone-500", "bg-sand"]
        : ["bg-sage-500", "bg-sand"];
  return (
    <div aria-hidden className={`flex w-full gap-1 ${className}`}>
      {Array.from({ length: Math.max(0, total) }, (_, i) => (
        <span key={i} className={`h-1 min-w-3 flex-1 ${i < done ? fill : trough}`} />
      ))}
    </div>
  );
}
