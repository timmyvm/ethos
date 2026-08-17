import type { CoachOutput } from "@/lib/coach";
import { dimensionPoints, type Tier1Scores, type Tier2Anchors } from "@/lib/index-score";
import type { RepMetrics } from "@/lib/metrics";

interface Row {
  name: string;
  score: number;
  weight: number;
  detail: string;
  improve?: string;
}

/**
 * The Index dimensions as tappable rows (mechanics.md display rules:
 * never a wall of numbers — each row expands to why + how). Judged rows
 * carry the cited moment; measured rows carry the numbers behind them.
 * Explainability = trust.
 *
 * Each row shows its WEIGHTED contribution against its own denominator
 * — 132/150, not 88/100 — because the dimensions aren't worth the same
 * and pretending they are made the /1000 total look like it didn't add
 * up. Now it visibly does: the eight numbers on this list sum to the
 * Ethos Index above it. The bar fills to the same fraction, so half a
 * bar means half the points.
 */
export function DimensionList({
  tier1,
  anchors,
  metrics,
  coach,
  pauseDetail,
}: {
  tier1: Tier1Scores;
  anchors: Tier2Anchors;
  metrics: RepMetrics;
  coach: CoachOutput | null;
  /** The pause report's own line, when the results screen has one. */
  pauseDetail?: string;
}) {
  const measured: Row[] = [
    {
      name: "Pause",
      score: tier1.pause,
      weight: 150,
      detail: `${
        pauseDetail ??
        `${metrics.composedPauses} before a sentence, ${metrics.midSentencePauses} mid-sentence.`
      }${
        (metrics.unvoicedHesitations ?? 0) >= 3
          ? ` Plus ${metrics.unvoicedHesitations} short mid-sentence gaps: silent hesitation, under the length a held pause needs. Nobody else counts these and they're the tell that you're composing mid-clause.`
          : ""
      }`,
    },
    {
      name: "Fillers",
      score: tier1.fillers,
      weight: 100,
      detail: `${metrics.fillerCount} filler${metrics.fillerCount === 1 ? "" : "s"} · ${metrics.fillersPerMin}/min. 0/min scores 100; 8/min scores 0.${
        metrics.topFiller ? ` Most of them were "${metrics.topFiller}".` : ""
      }`,
      improve:
        metrics.fillerCount > 0
          ? "Replace it with silence, not with a different word. A gap you leave open is the fix."
          : undefined,
    },
    // Scored separately from fillers because they're separate problems
    // with separate fixes. Reps recorded before the split have no
    // repairs score, and get no row rather than an invented one.
    ...(typeof tier1.repairs === "number"
      ? [
          {
            name: "Self-corrections",
            score: tier1.repairs,
            weight: 50,
            detail: `${metrics.repairCount ?? 0} restarted phrase${(metrics.repairCount ?? 0) === 1 ? "" : "s"} · ${metrics.repairsPerMin ?? 0}/min. Rarer than fillers and costlier, so the scale runs out at 3/min.`,
            improve:
              (metrics.repairCount ?? 0) > 0
                ? "Finish the sentence you started, then say the better one. Restarting mid-phrase makes a listener drop the thread and re-follow you."
                : undefined,
          },
        ]
      : []),
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
          // The dimension's key stays `confidence` in the schema, the
          // prompt and every stored row — this is a LABEL change, so no
          // migration and no re-scoring. §8 bans the word from copy, and
          // "Steadiness" is closer to what the anchors actually count
          // (hedges and restarts) than the word it replaces.
          name: "Steadiness",
          score: coach.dimensions.confidence.score,
          weight: 100,
          detail: `${coach.dimensions.confidence.citedMoment} (${anchors.hedgeCount} hedges, ${anchors.restartCount} restarts · counted, not judged.)`,
          improve: coach.dimensions.confidence.improve,
        },
      ]
    : [];

  const rows = [...measured, ...judged];
  // Same rounding the Index uses, so the list adds up to the number
  // printed above it rather than to something a point or two off.
  const earned = rows.reduce(
    (sum, r) => sum + dimensionPoints(r.score, r.weight),
    0
  );
  const available = rows.reduce((sum, r) => sum + r.weight, 0);

  return (
    <div className="rounded-[18px] border border-hairline bg-surface lift px-5 py-2">
      {rows.map((row) => {
        const points = dimensionPoints(row.score, row.weight);
        return (
          <details
            key={row.name}
            className="group border-b border-sand py-3 last:border-b-0"
          >
            <summary className="flex cursor-pointer select-none items-center gap-3">
              <span className="w-[104px] shrink-0 text-[13.5px] font-semibold leading-tight">
                {row.name}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
                <span
                  className="block h-full rounded-full bg-amber-500"
                  style={{ width: `${(points / row.weight) * 100}%` }}
                />
              </span>
              <span className="w-[62px] shrink-0 text-right">
                <span className="font-display text-[15px] font-bold">
                  {points}
                </span>
                <span className="text-[12px] text-stone-500">/{row.weight}</span>
              </span>
            </summary>
            <div className="mt-2 pl-0 text-[13px] leading-relaxed text-stone-500">
              {row.detail}
              {row.improve && (
                <div className="mt-1 text-stone-600">↳ {row.improve}</div>
              )}
            </div>
          </details>
        );
      })}

      {/* The sum, stated. Every number above adds to this one, and this
          one is the Ethos Index — so the score is checkable by hand
          rather than taken on trust. */}
      <div className="flex items-center justify-between py-3 text-[13px]">
        <span className="label-data">
          {rows.length} dimension{rows.length === 1 ? "" : "s"} · added up
        </span>
        <span>
          <span className="font-display text-[15px] font-bold">{earned}</span>
          <span className="text-[12px] text-stone-500">/{available}</span>
        </span>
      </div>

      {!coach && (
        <p className="border-t border-sand py-3 text-[12px] leading-relaxed text-stone-500">
          These are the four measured dimensions, worth {available} of the
          1000. The judged four (structure, credibility, engagement,
          steadiness) need the coach layer, and it didn&apos;t run on this
          rep, so there is no Ethos Index rather than a partial one.
        </p>
      )}
    </div>
  );
}
