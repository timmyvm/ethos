import { fillerHeatmap, fillerTally } from "@/lib/insights";
import type { RepRow } from "@/lib/client-data";

/**
 * Where fillers land inside a rep, and which words they are. Sage is
 * earned-only, so the hotspot is terracotta-toned: this is a thing to
 * fix, not a thing to celebrate.
 */
export function FillerHeatmap({ reps }: { reps: RepRow[] }) {
  const heat = fillerHeatmap(reps);
  const total = heat.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const peak = Math.max(...heat);
  const tally = fillerTally(reps).slice(0, 6);
  const tallyTotal = tally.reduce((a, [, n]) => a + n, 0);

  return (
    <div className="rounded-xl border border-edge bg-raised px-4 py-3.5">
      <div className="label-data">Where your fillers land</div>
      <div className="mt-3 flex h-20 items-end gap-1.5">
        {heat.map((n, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full bg-terracotta-300"
                style={{
                  height: `${peak ? Math.max(4, (n / peak) * 100) : 4}%`,
                }}
              />
            </div>
            <span className="label-data !text-[9px]">{n}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between">
        <span className="label-data">start</span>
        <span className="label-data">end</span>
      </div>

      <div className="mt-4 border-t border-hairline pt-3">
        <div className="label-data">Your words</div>
        <div className="mt-2 space-y-1.5">
          {tally.map(([word, n]) => (
            <div key={word} className="flex items-center gap-2.5">
              <span className="w-20 shrink-0 text-[13px] font-semibold">
                {word}
              </span>
              <span className="h-[5px] flex-1 overflow-hidden bg-sand">
                <span
                  className="block h-full bg-stone-400"
                  style={{ width: `${(n / tallyTotal) * 100}%` }}
                />
              </span>
              <span className="w-7 shrink-0 text-right text-[12px] text-stone-500">
                {n}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
