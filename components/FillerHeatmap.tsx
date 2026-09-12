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
    <div className="elev-1 rounded-card border border-card-edge bg-raised p-4">
      <div className="label-data">Where your fillers land</div>
      {/* `items-end` here collapsed every column to the height of its
          number, so the bars drew at 100% of 0 and the card was a row of
          counts with no chart above it. The columns stretch; the bar
          sits at the bottom of its own track. */}
      <div className="mt-3 flex h-20 items-stretch gap-1.5">
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
            <span className="label-micro">{n}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between">
        <span className="label-micro">start</span>
        <span className="label-micro">end</span>
      </div>

      <div className="mt-4 border-t border-hairline pt-3">
        <div className="label-data">Your words</div>
        <div className="mt-2 space-y-1.5">
          {tally.map(([word, n]) => (
            <div key={word} className="flex items-center gap-2.5">
              <span className="w-20 shrink-0 text-caption font-semibold">
                {word}
              </span>
              <span className="h-[5px] flex-1 overflow-hidden bg-sand">
                <span
                  className="block h-full bg-stone-400"
                  style={{ width: `${(n / tallyTotal) * 100}%` }}
                />
              </span>
              <span className="font-display w-7 shrink-0 text-right text-caption font-extrabold tabular-nums text-stone-500">
                {n}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
