import type { Pause } from "@/lib/metrics";
import type { PauseVerdict } from "@/lib/pause-quality";

/** Stored rows carry a verdict once they've been judged. */
type MaybeJudged = Pause & { verdict?: PauseVerdict };

interface Seg {
  type: "speech" | "pause";
  len: number;
  kind?: Pause["kind"];
  verdict?: PauseVerdict;
}

/** The marks, one class each, shared by the bar and its legend, so the
    legend is the mark rather than a picture of it (recording-24, #304).
    A searching pause is hollow, so it differs from the speech ticks by
    fill as well as by width. */
const LANDED_MARK = "bg-sage-500";
const SEARCHING_MARK = "border border-cream/50 bg-transparent";

/** Whether a held pause landed a point: the verdict when there is one,
    the old kind check for rows recorded before verdicts existed. */
const landed = (p: { kind?: Pause["kind"]; verdict?: PauseVerdict }) =>
  p.verdict ? p.verdict === "landing" || p.verdict === "opening" : p.kind === "pre";

/**
 * The signature element (DECISIONS.md #8): silence rendered sage as
 * achievement.
 *
 * Sage is EARNED, so it follows the verdict rather than the raw kind. A
 * pre-sentence pause with an "um" leaning on it, or one that ran into
 * dead air, is still a pre-sentence pause — but it isn't an
 * achievement, and painting it as one was the same flattery the pause
 * score itself was guilty of. Rows recorded before the verdicts existed
 * fall back to the old kind check.
 *
 * The eyebrow names the thing and nothing else (log-10, recording-11):
 * the legend carries what the colours mean, once.
 */
export function PauseBar({
  pauses,
  durationS,
}: {
  pauses: MaybeJudged[];
  durationS: number;
}) {
  const segs: Seg[] = [];
  // Speech runs render as ticks sized so the whole rep fits one row,
  // with height varied deterministically for texture.
  const tick = Math.max(1.6, durationS / 34);
  const speech = (len: number) => {
    const ticks = Math.max(1, Math.round(len / tick));
    for (let i = 0; i < ticks; i++) {
      segs.push({ type: "speech", len: 2 + Math.sin(segs.length * 2.7) });
    }
  };
  let cursor = 0;
  for (const p of pauses) {
    if (p.t > cursor) speech(p.t - cursor);
    segs.push({ type: "pause", len: p.len, kind: p.kind, verdict: p.verdict });
    cursor = p.t + p.len;
  }
  if (durationS > cursor) speech(durationS - cursor);

  // The bar's text alternative: held pauses exclude beats.
  const held = pauses.filter((p) => p.kind !== "beat");
  const landedCount = held.filter(landed).length;
  const searchingCount = held.length - landedCount;

  return (
    <div className="card-stage elev-1 rounded-card px-4 pb-3.5 pt-4">
      <div className="eyebrow text-cream/70">Pauses</div>
      <div
        role="img"
        aria-label={`${held.length} held pause${held.length === 1 ? "" : "s"}, ${landedCount} landed a point`}
        className="forced-color-adjust-none mt-3 flex h-14 items-center gap-[3px] overflow-hidden"
      >
        {segs.slice(0, 48).map((s, i) => {
          if (s.type === "speech") {
            return (
              <span
                key={i}
                aria-hidden
                className="min-w-[2px] shrink bg-cream/40"
                style={{ flex: "0 1 5px", height: 16 + Math.min(34, s.len * 11) }}
              />
            );
          }
          if (s.kind === "beat") {
            return (
              <span
                key={i}
                aria-hidden
                className="h-1.5 min-w-[3px] shrink bg-cream/40"
                style={{ flex: "0 1 6px" }}
              />
            );
          }
          return (
            <span
              key={i}
              aria-hidden
              className={`h-3 min-w-[8px] shrink ${
                landed(s) ? LANDED_MARK : SEARCHING_MARK
              }`}
              style={{ flex: `0 1 ${Math.min(34, 12 + s.len * 10)}px` }}
            />
          );
        })}
      </div>
      {held.length > 0 && (
        <div aria-hidden className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-cream/70">
          {landedCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-1.5 w-2.5 ${LANDED_MARK}`} />
              landed a point
            </span>
          )}
          {searchingCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-1.5 w-2.5 ${SEARCHING_MARK}`} />
              searching
            </span>
          )}
        </div>
      )}
    </div>
  );
}
