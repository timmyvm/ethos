/**
 * Three stars, earned ones in sage.
 *
 * `land` is for the debrief only (DECISIONS #225): each earned star
 * scales in from small, one after another, after `landAfterMs` (the
 * count-up above them, so the number lands and then the verdict does).
 * The log, the road and every other place stars are reference render
 * them still: a value already on the screen never re-arrives.
 */
export function Stars({
  n,
  size = 15,
  land = false,
  landAfterMs = 0,
}: {
  n: number;
  size?: number;
  land?: boolean;
  landAfterMs?: number;
}) {
  return (
    <span style={{ fontSize: size }} className="tracking-[3px]" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => {
        const earned = i <= n;
        return (
          <span
            key={i}
            className={`${earned ? "text-sage-700" : "text-stone-200"} ${
              land && earned ? "star-land" : ""
            }`}
            style={
              land && earned
                ? ({ "--i": i - 1, "--land-after": `${landAfterMs}ms` } as React.CSSProperties)
                : undefined
            }
          >
            ★
          </span>
        );
      })}
    </span>
  );
}
