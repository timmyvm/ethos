import type { RepRow } from "@/lib/client-data";

/**
 * Day-1 vs day-N — the core retention asset AND the core marketing
 * asset, same artifact (vision.md principle 4). Deliberately built to
 * be screenshot-shaped: dark, dense, one claim per row, no chrome.
 */
export function ComparisonCard({ reps }: { reps: RepRow[] }) {
  if (reps.length < 2) return null;

  const first = reps[0];
  const last = reps[reps.length - 1];
  const days =
    Math.round(
      (new Date(last.created_at).getTime() -
        new Date(first.created_at).getTime()) /
        86_400_000
    ) + 1;

  const fpm = (r: RepRow) =>
    r.duration_s > 0 ? (r.filler_count / (r.duration_s / 60)) : 0;
  const held = (r: RepRow) =>
    (r.pauses ?? []).filter((p) => p.kind !== "beat").length;

  const rows: { label: string; a: string; b: string; better: boolean }[] = [
    {
      label: "Fillers / min",
      a: fpm(first).toFixed(1),
      b: fpm(last).toFixed(1),
      better: fpm(last) < fpm(first),
    },
    {
      label: "Words / min",
      a: String(first.wpm),
      b: String(last.wpm),
      better:
        Math.abs(last.wpm - 145) < Math.abs(first.wpm - 145),
    },
    {
      label: "Held pauses",
      a: String(held(first)),
      b: String(held(last)),
      better: held(last) > held(first),
    },
  ];

  if (first.ethos_index !== null && last.ethos_index !== null) {
    rows.unshift({
      label: "Ethos",
      a: String(first.ethos_index),
      b: String(last.ethos_index),
      better: last.ethos_index > first.ethos_index,
    });
  }

  return (
    <div className="rounded-2xl bg-stage p-5 text-cream">
      <div className="label-data !text-cream/60">
        Day 1 → day {days} · your training log
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline gap-3">
            <span className="w-28 text-[13px] text-cream/60">{r.label}</span>
            <span className="font-display text-[20px] text-cream/45">
              {r.a}
            </span>
            <span className="text-cream/40">→</span>
            <span
              className={`font-display text-[24px] font-bold ${
                r.better ? "text-sage-lit" : "text-rust-lit"
              }`}
            >
              {r.b}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-cream/15 pt-3 text-[12px] text-cream/60">
        {reps.length} recordings. Every number measured, none awarded.
      </div>
    </div>
  );
}
