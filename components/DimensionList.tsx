import { IconChevron } from "@/components/Icon";
import { TRAIT, type TraitId } from "@/content/traits";
import type { CoachOutput } from "@/lib/coach";
import { dimensionPoints, type Tier1Scores, type Tier2Anchors } from "@/lib/index-score";
import type { RepMetrics } from "@/lib/metrics";

interface Row {
  name: string;
  /**
   * The trait a measured row IS (log-6, recording-8, system-9): its
   * name comes from content/traits.ts and its swatch wears the trait's
   * tone, so one colour never has two names between the Log and here.
   * The four judged rows have none and stay neutral.
   */
  trait?: TraitId;
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
 * bar means half the points. The bars stay sage on every row, measured
 * or judged, because points are earned; a measured row carries its
 * trait in the swatch beside its name instead.
 */
export function DimensionList({
  tier1,
  anchors,
  metrics,
  coach,
  pauseDetail,
  fill = false,
}: {
  tier1: Tier1Scores;
  anchors: Tier2Anchors;
  metrics: RepMetrics;
  coach: CoachOutput | null;
  /** The pause report's own line, when the results screen has one. */
  pauseDetail?: string;
  /**
   * The debrief only (DECISIONS #225): the bars fill from nothing as
   * the numbers arrive. A stored recording's bars are already there.
   */
  fill?: boolean;
}) {
  const measured: Row[] = [
    {
      name: TRAIT.pause.name,
      trait: "pause",
      score: tier1.pause,
      weight: 150,
      detail: `${
        pauseDetail ??
        `${metrics.composedPauses} before a sentence, ${metrics.midSentencePauses} mid-sentence.`
      }${
        (metrics.unvoicedHesitations ?? 0) >= 3
          ? ` Plus ${metrics.unvoicedHesitations} short mid-sentence gaps, under the held-pause bar: quiet hesitation.`
          : ""
      }`,
    },
    {
      name: TRAIT.fillers.name,
      trait: "fillers",
      score: tier1.fillers,
      weight: 100,
      detail: `${metrics.fillerCount} filler${metrics.fillerCount === 1 ? "" : "s"}, ${metrics.fillersPerMin} a minute. None scores 100; 8 a minute scores 0.${
        metrics.topFiller ? ` Most of them were “${metrics.topFiller}”.` : ""
      }`,
      improve:
        metrics.fillerCount > 0
          ? "Replace it with silence, not a different word."
          : undefined,
    },
    // Scored separately from fillers because they're separate problems
    // with separate fixes. Reps recorded before the split have no
    // repairs score, and get no row rather than an invented one.
    ...(typeof tier1.repairs === "number"
      ? [
          {
            name: TRAIT.repairs.name,
            trait: "repairs" as const,
            score: tier1.repairs,
            weight: 50,
            detail: `${metrics.repairCount ?? 0} restarted phrase${(metrics.repairCount ?? 0) === 1 ? "" : "s"}, ${metrics.repairsPerMin ?? 0} a minute. None scores 100; 3 a minute scores 0.`,
            improve:
              (metrics.repairCount ?? 0) > 0
                ? "Finish the sentence, then say the better one. A restart makes the listener re-follow you."
                : undefined,
          },
        ]
      : []),
    {
      name: TRAIT.pace.name,
      trait: "pace",
      score: tier1.pace,
      weight: 100,
      detail: `${metrics.wpm} words a minute against the 130 to 160 zone, plus a bonus when pace moves.`,
    },
    {
      name: TRAIT.range.name,
      trait: "range",
      score: tier1.range,
      weight: 100,
      detail: "Distinct words against repeats and crutch words (“really”, “very”, “thing”).",
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
          detail: `${coach.dimensions.confidence.citedMoment} (${anchors.hedgeCount} hedges and ${anchors.restartCount} restarts, counted rather than judged.)`,
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
    <div className="card px-4 py-1">
      {rows.map((row) => {
        const points = dimensionPoints(row.score, row.weight);
        return (
          /* No `group` here (log-1): Tailwind's marker class matched the
             grouped list's old `.group` rule and drew a grey capsule
             round every row. Nothing on the row reads a group variant. */
          <details
            key={row.name}
            className="border-b border-hairline py-3 last:border-b-0"
          >
            <summary
              data-trait={row.trait}
              className="flex min-h-6 cursor-pointer select-none list-none items-center gap-3 [&::-webkit-details-marker]:hidden"
            >
              {/* A 3px slot on every row, the tone swatch on the five
                  measured ones, so the nine names share one left edge. */}
              <span className="flex w-[104px] shrink-0 items-center gap-2">
                <span
                  aria-hidden
                  className={`h-3.5 w-[3px] shrink-0 ${row.trait ? "tone-fill" : ""}`}
                />
                <span className="font-display min-w-0 truncate text-row font-bold">
                  {row.name}
                </span>
              </span>
              <span className="h-1.5 flex-1 overflow-hidden bg-sand">
                <span
                  className={`block h-full bg-sage-500 ${fill ? "fill" : ""}`}
                  style={{ width: `${(points / row.weight) * 100}%` }}
                />
              </span>
              <Score points={points} of={row.weight} />
              {/* The row says it opens (log-5, recording-12); the chevron
                  turns over on open (globals.css, details[open]). */}
              <span aria-hidden className="disclosure-mark shrink-0 text-stone-400">
                <IconChevron size={14} />
              </span>
            </summary>
            {/* The why drops out of the row that opened it (#227); a
                closed <details> doesn't render it, so it plays on every
                open and never on the page's load. */}
            <div className="reveal mt-2 pl-[11px] text-caption leading-relaxed text-stone-500">
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
          rather than taken on trust. The total sits in the same column
          as the rows' scores, over the chevron's slot. */}
      <div className="flex items-center gap-3 border-t border-hairline py-3">
        <span className="flex-1 pl-[11px] text-caption font-semibold text-stone-500">
          {rows.length} dimension{rows.length === 1 ? "" : "s"}, added up
        </span>
        <Score points={earned} of={available} />
        <span aria-hidden className="w-3.5 shrink-0" />
      </div>

      {/* Counts the rows rather than claiming a number (#102): the
          measured tier grew once already and this line didn't notice. */}
      {!coach && (
        <p className="border-t border-hairline py-3 text-caption leading-relaxed text-stone-500">
          The coach didn&apos;t run this time. These {rows.length} measured
          dimensions cover {available} of the 1000; without the judged ones
          there is no Ethos Index.
        </p>
      )}
    </div>
  );
}

/**
 * Points over a denominator on one fixed edge (log-11): the numerator
 * right-aligned in its own column and the denominator left-aligned in
 * a 34px one, both tabular Outfit, so '33/50' ends where '99/150' does.
 */
function Score({ points, of }: { points: number; of: number }) {
  return (
    <span className="grid w-[66px] shrink-0 grid-cols-[1fr_34px] items-baseline">
      <span className="font-display text-right text-body font-extrabold tabular-nums">
        {points}
      </span>
      <span className="font-display text-left text-caption font-semibold tabular-nums text-stone-500">
        /{of}
      </span>
    </span>
  );
}
