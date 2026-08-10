import type { CoachOutput } from "@/lib/coach";
import type { Tier1Scores, Tier2Anchors } from "@/lib/index-score";
import type { RepMetrics } from "@/lib/metrics";

interface Row {
  name: string;
  score: number;
  weight: number;
  detail: string;
  improve?: string;
}

/**
 * The eight Index dimensions as tappable rows (mechanics.md display
 * rules: never a wall of numbers — each row expands to why + how).
 * Judged rows carry the cited moment; measured rows carry the numbers
 * behind them. Explainability = trust.
 */
export function DimensionList({
  tier1,
  anchors,
  metrics,
  coach,
}: {
  tier1: Tier1Scores;
  anchors: Tier2Anchors;
  metrics: RepMetrics;
  coach: CoachOutput | null;
}) {
  const measured: Row[] = [
    {
      name: "Pause",
      score: tier1.pause,
      weight: 150,
      detail: `${metrics.composedPauses} composed before a sentence, ${metrics.midSentencePauses} mid-sentence.`,
    },
    {
      name: "Fillers",
      score: tier1.fillers,
      weight: 150,
      detail: `${metrics.fillerCount} fillers — ${metrics.fillersPerMin}/min. 0/min scores 100; 8/min scores 0.`,
    },
    {
      name: "Pace",
      score: tier1.pace,
      weight: 100,
      detail: `${metrics.wpm} WPM against the 130–160 zone, plus a bonus when pace moves.`,
    },
    {
      name: "Range",
      score: tier1.range,
      weight: 100,
      detail: `Distinct words vs repeats and crutch words ("really", "very", "thing").`,
    },
  ];

  const judged: Row[] = coach
    ? [
        {
          name: "Structure",
          score: coach.dimensions.structure.score,
          weight: 150,
          detail: coach.dimensions.structure.citedMoment,
          improve: coach.dimensions.structure.improve,
        },
        {
          name: "Credibility",
          score: coach.dimensions.credibility.score,
          weight: 150,
          detail: coach.dimensions.credibility.citedMoment,
          improve: coach.dimensions.credibility.improve,
        },
        {
          name: "Engagement",
          score: coach.dimensions.engagement.score,
          weight: 100,
          detail: coach.dimensions.engagement.citedMoment,
          improve: coach.dimensions.engagement.improve,
        },
        {
          name: "Confidence",
          score: coach.dimensions.confidence.score,
          weight: 100,
          detail: `${coach.dimensions.confidence.citedMoment} (${anchors.hedgeCount} hedges, ${anchors.restartCount} restarts — counted, not judged.)`,
          improve: coach.dimensions.confidence.improve,
        },
      ]
    : [];

  return (
    <div className="rounded-[18px] border border-black/5 bg-white lift px-5 py-2">
      {[...measured, ...judged].map((row) => (
        <details key={row.name} className="group border-b border-sand py-3 last:border-b-0">
          <summary className="flex cursor-pointer select-none items-center gap-3">
            <span className="w-24 text-[13.5px] font-semibold">{row.name}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
              <span
                className="block h-full rounded-full bg-stone-800"
                style={{ width: `${row.score}%` }}
              />
            </span>
            <span className="font-display w-9 text-right text-[15px] font-bold">
              {row.score}
            </span>
          </summary>
          <div className="mt-2 pl-0 text-[13px] leading-relaxed text-stone-500">
            {row.detail}
            {row.improve && (
              <div className="mt-1 text-stone-600">↳ {row.improve}</div>
            )}
          </div>
        </details>
      ))}
      {!coach && (
        <p className="py-3 text-[12px] text-stone-500">
          Judged dimensions (structure, credibility, engagement, confidence)
          need the coach layer — measured scores above are complete.
        </p>
      )}
    </div>
  );
}
