import type { Pause } from "@/lib/metrics";

interface Seg {
  type: "speech" | "pause";
  len: number;
  kind?: Pause["kind"];
}

/**
 * The signature element (DECISIONS.md #8): silence rendered amber as
 * achievement. Amber pills = held pauses before a sentence (composed);
 * stone pills = held pauses mid-sentence; dots = beats.
 */
export function PauseBar({
  pauses,
  durationS,
}: {
  pauses: Pause[];
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
    segs.push({ type: "pause", len: p.len, kind: p.kind });
    cursor = p.t + p.len;
  }
  if (durationS > cursor) speech(durationS - cursor);

  return (
    <div className="rounded-2xl bg-stone-900 px-4 pb-3.5 pt-4">
      <div className="label-data !text-stone-400">
        Pause bar · amber = silence you held
      </div>
      <div className="mt-3 flex h-14 items-center gap-[3px] overflow-hidden">
        {segs.slice(0, 48).map((s, i) => {
          if (s.type === "speech") {
            return (
              <span
                key={i}
                className="shrink-0 rounded-[3px] bg-stone-600"
                style={{ width: 5, height: 16 + Math.min(34, s.len * 11) }}
              />
            );
          }
          if (s.kind === "beat") {
            return (
              <span
                key={i}
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-stone-600"
              />
            );
          }
          return (
            <span
              key={i}
              className={`h-3 shrink-0 rounded-full ${
                s.kind === "pre" ? "bg-amber-500" : "bg-stone-400"
              }`}
              style={{ width: Math.min(34, 12 + s.len * 10) }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex gap-4">
        <span className="label-data !text-amber-500">● before a sentence</span>
        <span className="label-data !text-stone-400">● mid-sentence</span>
      </div>
    </div>
  );
}
