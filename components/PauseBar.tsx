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

/**
 * The signature element (DECISIONS.md #8): silence rendered sage as
 * achievement.
 *
 * Amber is EARNED, so it now follows the verdict rather than the raw
 * kind. A pre-sentence pause with an "um" leaning on it, or one that ran
 * into dead air, is still a pre-sentence pause — but it isn't an
 * achievement, and painting it gold was the same flattery the pause
 * score itself was guilty of. Rows recorded before the verdicts existed
 * fall back to the old kind check.
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

  return (
    <div className="rounded-[24px] bg-stage px-4 pb-3.5 pt-4">
      <div className="label-data !text-cream/60">
        Pause bar · sage = silence you earned
      </div>
      <div className="mt-3 flex h-14 items-center gap-[3px] overflow-hidden">
        {segs.slice(0, 48).map((s, i) => {
          if (s.type === "speech") {
            return (
              <span
                key={i}
                className="shrink-0 rounded-[3px] bg-cream/40"
                style={{ width: 5, height: 16 + Math.min(34, s.len * 11) }}
              />
            );
          }
          if (s.kind === "beat") {
            return (
              <span
                key={i}
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-cream/40"
              />
            );
          }
          const earned = s.verdict
            ? s.verdict === "landing" || s.verdict === "opening"
            : s.kind === "pre";
          return (
            <span
              key={i}
              className={`h-3 shrink-0 rounded-full ${
                earned ? "bg-sage-500" : "bg-cream/30"
              }`}
              style={{ width: Math.min(34, 12 + s.len * 10) }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex gap-4">
        <span className="label-data !text-sage-mist">● landed a point</span>
        <span className="label-data !text-cream/60">● searching</span>
      </div>
    </div>
  );
}
