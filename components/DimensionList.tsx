import { Fragment, type ReactNode } from "react";
import { IconChevron } from "@/components/Icon";
import { MomentChip } from "@/components/rep/MomentChip";
import type { TakeAudio } from "@/components/TakeAudio";
import { type TraitId } from "@/content/traits";
import type { CoachOutput } from "@/lib/coach";
import {
  BAND_WORD,
  dimensionRows,
  everyLine,
  isTraitKey,
  paceWords,
  plural,
  rowsHeadline,
  varietyWords,
  type Band,
  type DimensionRow,
} from "@/lib/dimension-rows";
import type { Tier1Scores, Tier2Anchors } from "@/lib/index-score";
import { ALL_FILLERS_PER_MIN } from "@/lib/metric-labels";
import { UNVOICED_MAX_S, UNVOICED_MIN_S, type RepMetrics } from "@/lib/metrics";
import { filledMoments, saysFilled, type FilledMoments, type MomentsPart } from "@/lib/pause-quality";
import type { TraitKey } from "@/lib/traits";

/** What a row says when it opens: what the take did, then how to move it. */
interface Detail {
  detail: string;
  /** The Pause row's moments (#424), under its detail. */
  moments?: ReactNode;
  improve?: string;
}

/**
 * The Index dimensions as tappable rows (mechanics.md display rules:
 * never a wall of numbers — each row expands to why + how). Judged rows
 * carry the cited moment; measured rows carry the numbers behind them.
 * Explainability = trust.
 *
 * Readable at a glance since #471 (the 14-day test: "did it mean i was
 * good in it or bad in it"). Every row is out of 100, the one scale the
 * rows share, with the word for how it went beside its number
 * (lib/dimension-rows.ts `band`: Strong from 70, Okay from 50, Work on
 * this under that) and a bar that shows the band: sage where it is
 * Strong, because a Strong row is earned, and a neutral where it is
 * not. A trait named for its fault is
 * named for its skill here (Filler control), so a high number reads as
 * good on every row; Sentence restarts keeps its one name (#502), and
 * its band word and bar say which way is good. The Index itself is the same
 * number: nothing is rescored.
 *
 * The rows end on their last row (#484, Timothy 16 Nov: the foot,
 * "9 dimensions, added up 624/1000" and then #471's "Rows are out of
 * 100. In the Index, ... count up to 150 each ...", underlined, remove).
 * The Ethos number over the page already says the total. A row's scale
 * is drawn, not printed: its bar runs the row's width at 100 (a screen
 * reader hears "out of 100"). The rows are weighted into the total, so
 * they do not add up to it; #471's foot said so, and Timothy struck it,
 * so nothing on the card offers a sum to check.
 */
export function DimensionList({
  tier1,
  anchors,
  metrics,
  coach,
  pauseDetail,
  take = null,
  fill = false,
  open,
  brief = false,
  scored = true,
  trend = null,
}: {
  tier1: Tier1Scores;
  anchors: Tier2Anchors;
  metrics: RepMetrics;
  coach: CoachOutput | null;
  /** The pause report's own line, when the results screen has one. */
  pauseDetail?: string;
  /**
   * The take's audio (#424): each filled pause the Pause row names plays
   * from a second before it to a second after. Null, or a take that
   * cannot play, and the timestamps are plain text.
   */
  take?: TakeAudio | null;
  /**
   * The debrief only (DECISIONS #225): the bars fill from nothing as
   * the numbers arrive. A stored recording's bars are already there.
   */
  fill?: boolean;
  /**
   * The trait whose row starts open (DECISIONS #427): in "Every
   * number", the practice's own trait, so its numbers are one scroll
   * in. Pausing opens the Pause row, Fillers the Filler control row, and
   * so on.
   */
  open?: TraitId;
  /**
   * The door's sheet (the #427 review): a row's detail says what the take
   * did, never how the score is computed ("None scores 100; 8 a minute
   * scores 0." was the scoring rule, not feedback). The Log's ledger
   * keeps the rule.
   */
  brief?: boolean;
  /**
   * Whether the rows are a reading. A take too short to score measured
   * nothing (#55), so its rows claim nothing in words: no headline, no
   * band's word and no sage, only the numbers it stored (#471 review).
   */
  scored?: boolean;
  /**
   * The trend in words for a row, by its key (plan §7, lib/dimension-rows
   * `fillerTrend`): "About half your first week's fillers a minute: 3.9,
   * from 7.6.", under what the take did. Where history was read.
   */
  trend?: Partial<Record<TraitKey, string>> | null;
}) {
  /* The filled pauses' moments, read off the verdicts the take stored
     (#422): nothing is judged again or rescored here. Where the detail
     is the filled headline, which already says how many had a sound in
     them, the moments say only where. */
  const moments = filledMoments(metrics.pauses, { counted: saysFilled(pauseDetail) });
  const secs = Math.round(metrics.durationS);
  const fillers = metrics.fillerCount;
  const repairs = metrics.repairCount ?? 0;

  const details: Record<TraitKey, Detail | null> = {
    pause: {
      /* In the house's plain words (#490): a pause is between sentences
         or mid-sentence ("under the held-pause bar: quiet hesitation" was
         the app talking to itself). The short gaps are said as what
         metrics.ts countUnvoicedHesitations counts, 0.3 to 1.2 seconds
         and not before a sentence, with no claim of where they fell (a
         gap under 0.8s is never told a sentence end) or that they were
         under a second (the review of #490). */
      detail: `${
        pauseDetail ??
        `${plural(metrics.composedPauses, "pause")} between sentences, ${metrics.midSentencePauses} mid-sentence.`
      }${
        (metrics.unvoicedHesitations ?? 0) >= 3
          ? ` Plus ${metrics.unvoicedHesitations} short gaps of ${UNVOICED_MIN_S} to ${UNVOICED_MAX_S} seconds.`
          : ""
      }`,
      moments: moments ? <PauseMoments moments={moments} take={take?.playable ? take : null} /> : undefined,
    },
    fillers: {
      // The score runs on every filler a minute, so the rate wears its
      // one label (E32): the row's own name is the skill's. How often, as
      // people feel it (§7: "about one 'um' every 20 seconds"), beside the
      // count; the Log keeps the rate and the scale, in the Sentence
      // restarts row's grammar: a bare "8 scores 0" read as 8 fillers.
      detail: brief
        ? fillers === 0
          ? `No fillers in ${secs} seconds.`
          : `${plural(fillers, "filler")} in ${secs} seconds${tail(everyLine(fillers, metrics.durationS))}.${
              metrics.topFiller ? ` Most were “${metrics.topFiller}”.` : ""
            }`
        : `${ALL_FILLERS_PER_MIN}: ${metrics.fillersPerMin} (${fillers} in all${tail(everyLine(fillers, metrics.durationS))}). 0 fillers a minute scores 100; 8 scores 0.${
            metrics.topFiller ? ` Most of them were “${metrics.topFiller}”.` : ""
          }`,
      improve: fillers > 0 ? "Replace it with silence, not a different word." : undefined,
    },
    // Scored separately from fillers because they're separate problems
    // with separate fixes. Reps recorded before the split have no
    // repairs score, and get no row rather than an invented one. One
    // name for the count everywhere since #502: "sentence restarts".
    repairs: {
      detail: `${
        repairs === 0
          ? `No sentence restarts in ${secs} seconds.`
          : `${plural(repairs, "sentence restart")} in ${secs} seconds${tail(everyLine(repairs, metrics.durationS))}.${
              brief ? "" : ` ${metrics.repairsPerMin ?? 0} a minute.`
            }`
      }${
        /* No-break spaces keep each number on its words' line: at 320 the
           rule broke after "0" (#502's look loop). */
        brief ? "" : " 0\u00a0sentence restarts a minute scores 100; 3\u00a0scores 0."
      }`,
      improve:
        repairs > 0
          ? "Finish the sentence, then say the better one. A sentence restart makes the listener start over with you."
          : undefined,
    },
    /* The Log's ledger keeps the rule, said with its number (#490: "A
       pace that moves earns a bonus" named neither the move nor the
       bonus; index-score.ts paceScore adds 10 for a speed that changes
       a little from sentence to sentence). */
    pace: {
      detail: `${paceWords(metrics.wpm)}${brief ? "" : " Speeding up and slowing down a little adds 10 points."}`,
    },
    range: {
      detail: [
        varietyWords(metrics.substance?.distinctRatio),
        brief ? null : "Words you repeat, and words like “really”, “very” and “thing”, cost points.",
      ]
        .filter(Boolean)
        .join(" ") || "Different words count for you; repeats and words like “really”, “very” and “thing” cost points.",
    },
    structure: coach
      ? { detail: coach.dimensions.structure.citedMoment, improve: coach.dimensions.structure.improve }
      : null,
    credibility: coach
      ? { detail: coach.dimensions.credibility.citedMoment, improve: coach.dimensions.credibility.improve }
      : null,
    engagement: coach
      ? { detail: coach.dimensions.engagement.citedMoment, improve: coach.dimensions.engagement.improve }
      : null,
    // The dimension's key stays `confidence` in the schema, the prompt
    // and every stored row: Steadiness is a LABEL (lib/dimension-rows
    // DIMENSION_NAME), so no migration and no re-scoring.
    /* The two counts beside Demos's quote, said as what was said (#490:
       "hedges" and "counted rather than judged" were the app's words).
       A hedge is "maybe", "I guess", "sort of" or "I feel like"
       (index-score.ts countHedges), so the line gives two as examples
       and never says the count was only those two. */
    confidence: coach
      ? {
          detail: `${coach.dimensions.confidence.citedMoment} (${hedgeWords(anchors.hedgeCount)}, ${plural(
            anchors.restartCount,
            "sentence restart"
          )}.)`,
          improve: coach.dimensions.confidence.improve,
        }
      : null,
  };

  const rows = dimensionRows(tier1, coach?.dimensions ?? null);
  const said = scored ? rowsHeadline(rows) : "";

  return (
    <>
      {said && (
        /* One headline in words, the numbers under it (plan §7): the
           strongest rows as what you did, then the one to work on. Every
           clause is a row on the card below. */
        <p data-dimension-headline className="mb-3 text-body text-ink text-pretty">
          {said}
        </p>
      )}
      <div className="card px-4 py-1">
        {rows.map((row) => (
          <RowDetails
            key={row.key}
            row={row}
            detail={details[row.key]}
            open={open !== undefined && row.key === open}
            scored={scored}
            fill={fill}
            trend={trend?.[row.key] ?? null}
          />
        ))}
      </div>
    </>
  );
}

/** ", about one every 15 seconds", or nothing. */
function tail(s: string | null): string {
  return s ? `, ${s}` : "";
}

/**
 * "2 phrases like “maybe” or “I guess”", "no phrases like …". The count
 * is every hedge countHedges finds, “sort of” and “I feel like”
 * included: "“maybe” or “I guess” twice" told someone who said “sort
 * of” twice that they had said “maybe” (the review of #490).
 */
export function hedgeWords(n: number): string {
  const like = "like “maybe” or “I guess”";
  if (!(n > 0)) return `no phrases ${like}`;
  return `${n} ${n === 1 ? "phrase" : "phrases"} ${like}`;
}

/** The band's word, in the colour it means: sage where earned, ink where it asks for work. */
const BAND_TEXT: Record<Band, string> = {
  strong: "text-sage-700",
  okay: "text-stone-500",
  work: "text-ink",
};

/**
 * One row: the swatch and the skill's name, the band's word and the
 * score out of 100 on its right, and its bar under them across the row,
 * sage where it is Strong and a neutral where it is not. Two lines tall
 * to the eye and the thumb, so the bar can be read the width of the row.
 */
function RowDetails({
  row,
  detail,
  open,
  scored,
  fill,
  trend,
}: {
  row: DimensionRow;
  detail: Detail | null;
  open: boolean;
  /** False on a take too short to score: the number alone, no word, no sage. */
  scored: boolean;
  fill: boolean;
  trend: string | null;
}) {
  const trait = isTraitKey(row.key) ? row.key : undefined;
  const strong = scored && row.band === "strong";
  return (
    /* No `group` here (log-1): Tailwind's marker class matched the
       grouped list's old `.group` rule and drew a grey capsule round
       every row. Nothing on the row reads a group variant. */
    <details
      open={open || undefined}
      data-band={scored ? row.band : undefined}
      className="border-b border-hairline py-3 last-of-type:border-b-0"
    >
      <summary
        data-trait={trait}
        className="relative block cursor-pointer select-none list-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] [&::-webkit-details-marker]:hidden"
      >
        <span className="flex min-h-6 items-baseline gap-3">
          {/* An 8px slot on every row, the trait's swatch on the five
              measured ones (`.trait-dot`, the square the Log, You and
              Lessons draw; #493: it was a 3x14 tick of its own), blank
              on the four, so the nine names share one left edge. */}
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span aria-hidden className={`size-2 shrink-0 self-center ${trait ? "trait-dot" : ""}`} />
            <span className="font-display min-w-0 truncate text-row font-bold">{row.name}</span>
          </span>
          {scored && (
            <span data-band-word className={`shrink-0 text-caption font-semibold ${BAND_TEXT[row.band]}`}>
              {BAND_WORD[row.band]}
            </span>
          )}
          <span className="font-display w-8 shrink-0 text-right text-body font-extrabold tabular-nums">
            {row.score}
            <span className="sr-only"> out of 100</span>
          </span>
          {/* The row says it opens (log-5, recording-12); the chevron
              turns over on open (globals.css, details[open]). */}
          <span aria-hidden className="disclosure-mark shrink-0 self-center text-stone-400">
            <IconChevron size={14} />
          </span>
        </span>
        {/* The bar, the row's width from its name to its number: sage
            where the row is Strong (earned), the plain neutral where it
            is not. Never terracotta: that is the screen's one tap. */}
        <span aria-hidden className="mt-2 ml-4 mr-[26px] block h-1.5 overflow-hidden bg-sand">
          <span
            data-bar
            className={`block h-full ${strong ? "bg-sage-600" : "bg-bar-plain"} ${fill ? "fill" : ""}`}
            style={{ width: `${row.score}%` }}
          />
        </span>
      </summary>
      {/* The why drops out of the row that opened it (#227); a closed
          <details> doesn't render it, so it plays on every open and
          never on the page's load. */}
      {detail && (
        <div className="reveal mt-2 pl-4 text-caption leading-relaxed text-stone-500">
          {detail.detail}
          {trend && <div data-trend className="mt-1 text-stone-600">{trend}</div>}
          {detail.moments}
          {detail.improve && <div className="mt-1 text-stone-600">↳ {detail.improve}</div>}
        </div>
      )}
    </details>
  );
}

/**
 * "0:15 and 0:40 had a sound in them." (#424): the moments a lower Pause
 * score comes from, each a chip that plays the take a second either side
 * of its pause, so the number traces to something you can hear. With no
 * take to play (a stored recording whose audio is gone, an upload that
 * was not kept, a file that would not decode) the times are plain text.
 */
function PauseMoments({
  moments,
  take,
}: {
  moments: FilledMoments;
  take: TakeAudio | null;
}) {
  const { parts } = moments;
  const draw = (part: MomentsPart, i: number): ReactNode => {
    if (part.kind === "moment") {
      return take ? (
        <MomentChip key={i} moment={part.moment} take={take} />
      ) : (
        <span key={i} data-pause-moment className="font-semibold tabular-nums text-ink">
          {part.moment.clock}
        </span>
      );
    }
    return part.keep ? (
      <span key={i} className="whitespace-nowrap">
        {part.text}
      </span>
    ) : (
      <Fragment key={i}>{part.text}</Fragment>
    );
  };
  /* The run of times and the words between them ("0:15, 0:27 and 0:40")
     never breaks, so the chips share one line and their 44px targets
     never stack (review of #424: three chips balanced into two lines
     and a tap on 0:15's lower edge played 0:40). Three chips and their
     words take about 210px; the line at 320 holds about 245. The line
     breaks in the words after them, balanced. */
  const at = parts.flatMap((p, i) => (p.kind === "moment" ? [i] : []));
  const [first, last] = [at[0], at[at.length - 1]];
  return (
    <p className={`text-balance ${take ? "mt-1 leading-7" : ""}`}>
      {parts.slice(0, first).map(draw)}
      <span data-moment-run className="whitespace-nowrap">
        {parts.slice(first, last + 1).map((p, i) => draw(p, first + i))}
      </span>
      {parts.slice(last + 1).map((p, i) => draw(p, last + 1 + i))}
    </p>
  );
}
