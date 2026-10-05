import { IconStar } from "@/components/Icon";

/**
 * Stars: earned ones solid in sage, the rest an empty slot in the same
 * shape (duolingo-path s10, log-22). The prize's own outline shows what
 * is still to earn; the old text glyph's stone-200 slot measured 1.3:1
 * and read "one star" where it meant "one of three". The unearned
 * outline is 1.5px stone-400 at every size.
 *
 * One image to a screen reader ("2 of 3 stars"), the marks hidden.
 *
 * `land` is for the debrief only (DECISIONS #225): each earned star
 * scales in from small, one after another, after `landAfterMs` (the
 * count-up above them, so the number lands and then the verdict does).
 * The log, the road and every other place stars are reference render
 * them still: a value already on the screen never re-arrives.
 *
 * `arch` drops the middle star 4px, a shallow arch for the results
 * step. `tone` picks the earned colour: sage-500 by default, sage-700
 * where the stars sit on a sage wash.
 */
export function Stars({
  n,
  size = 15,
  land = false,
  landAfterMs = 0,
  total = 3,
  arch = false,
  tone = "sage-500",
}: {
  n: number;
  size?: number;
  land?: boolean;
  landAfterMs?: number;
  total?: number;
  arch?: boolean;
  tone?: "sage-500" | "sage-700";
}) {
  const earnedClass = tone === "sage-700" ? "text-sage-700" : "text-sage-500";
  const middle = (total + 1) / 2;
  return (
    <span
      role="img"
      aria-label={`${n} of ${total} stars`}
      className="inline-flex shrink-0 items-start align-middle"
      style={{ gap: Math.max(2, Math.round(size / 5)) }}
    >
      {Array.from({ length: total }, (_, k) => {
        const i = k + 1;
        const earned = i <= n;
        const landing = land && earned;
        return (
          <span
            key={i}
            aria-hidden
            className={`inline-flex ${earned ? earnedClass : "text-stone-400"} ${
              landing ? "star-land" : ""
            }`}
            style={{
              ...(arch && i === middle ? { marginTop: 4 } : null),
              ...(landing
                ? ({ "--i": i - 1, "--land-after": `${landAfterMs}ms` } as React.CSSProperties)
                : null),
            }}
          >
            <IconStar size={size} filled={earned} />
          </span>
        );
      })}
    </span>
  );
}
