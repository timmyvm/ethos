"use client";

import Image from "next/image";
import { AccuracyCard } from "@/components/AccuracyCard";
import { CountUp } from "@/components/CountUp";
import { DimensionList } from "@/components/DimensionList";
import { PauseBar } from "@/components/PauseBar";
import { Stars } from "@/components/Stars";
import type { AccuracyResult } from "@/lib/accuracy";
import type { CoachOutput } from "@/lib/coach";
import type { ColdTopic } from "@/lib/cold-topics";
import type { Tier1Scores, Tier2Anchors } from "@/lib/index-score";
import type { RepMetrics } from "@/lib/metrics";

export interface ResultView {
  transcript: string;
  metrics: RepMetrics;
  tier1: Tier1Scores;
  anchors: Tier2Anchors;
  coach: CoachOutput | null;
  ethosIndex: number | null;
  previousIndex: number | null;
  accuracy?: AccuracyResult | null;
  scorable?: boolean;
  /** The pause report's one line — what the silences actually did. */
  pauseHeadline?: string | null;
}

/**
 * Which slice of the feedback to render.
 *
 * A finished rep walks these in order across separate screens rather
 * than dumping all of it at once — the old single page put the score,
 * eight dimensions, every filler timestamp and the transcript in one
 * scroll, which meant most of it was never read. The log renders "all"
 * because a stored rep is reference, not a debrief.
 */
export type ResultSection = "score" | "numbers" | "words" | "all";

/**
 * The results view, shared by a just-finished rep and any row in the
 * log. Leads with the Index delta and the ONE focus (mechanics.md
 * display rules) — never a wall of eight numbers.
 */
export function RepResult({
  result,
  topic = null,
  section = "all",
  baseline = false,
}: {
  result: ResultView;
  topic?: ColdTopic | null;
  section?: ResultSection;
  /**
   * Rep 1 only (DECISIONS #135): frame the first score as the floor
   * the graph grows from, in the slot the delta occupies from rep 2
   * on. Novices tune out on verdict-framed feedback; the number stays
   * exactly as measured, what changes is what it claims to be. The log
   * never sets this — a stored rep is reference, not a first meeting.
   */
  baseline?: boolean;
}) {
  const show = (s: ResultSection) => section === "all" || section === s;
  const { metrics: m, coach, tier1, anchors, ethosIndex, previousIndex } =
    result;
  const zone =
    m.wpm >= 130 && m.wpm <= 160
      ? "in the zone"
      : m.wpm > 160
        ? "sprinting"
        : "strolling";
  const delta =
    ethosIndex !== null && previousIndex !== null
      ? ethosIndex - previousIndex
      : null;

  const coachLine =
    coach?.coachLine ??
    `${m.fillerCount} filler${m.fillerCount === 1 ? "" : "s"} in ${Math.round(
      m.durationS
    )}s.${m.topFiller ? ` Tomorrow: kill "${m.topFiller}."` : " Clean rep."}`;

  return (
    <>
      {show("score") && (ethosIndex !== null ? (
        <div className="mt-3 flex items-baseline gap-3.5">
          <CountUp
            value={ethosIndex}
            className="font-display text-[64px] font-bold leading-none"
          />
          <div>
            <div className="text-[15px] font-semibold">
              your Ethos <span className="font-normal text-stone-500">/1000</span>
            </div>
            {delta !== null && delta !== 0 && (
              <div
                className={`text-[13px] font-semibold ${
                  delta > 0 ? "text-amber-500" : "text-stone-500"
                }`}
              >
                {delta > 0 ? "▲ +" : "▼ "}
                {delta} since last rep
              </div>
            )}
            {delta === null && baseline && (
              <div className="text-[13px] font-semibold text-stone-500">
                Day 0 — every rep after this has a number to beat.
              </div>
            )}
          </div>
          <div className="ml-auto">
            <Stars n={m.stars} size={22} />
          </div>
        </div>
      ) : result.scorable === false ? (
        /* Not a score of zero — no score. Saying "I don't know" over and
           over has no fillers and a fine pace; reporting those numbers as
           an achievement would be the app lying to you. */
        <div className="mt-3 rounded-[18px] border border-hairline bg-surface lift p-5">
          <div className="font-display text-[22px] font-bold leading-tight">
            Not enough to score.
          </div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-stone-500">
            {m.substance.wordCount < 20
              ? `${m.substance.wordCount} word${m.substance.wordCount === 1 ? "" : "s"} isn't a rep yet. Aim for 60–90 seconds of actually saying something.`
              : "Almost all of that was the same few words repeated. Say something you'd have to think about."}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Stars n={1} size={18} />
            <span className="label-data">1 star · nothing measured</span>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-baseline gap-3.5">
          <div className="font-display text-[64px] font-bold leading-none">
            {m.fillerCount}
          </div>
          <div>
            <div className="text-[15px] font-semibold">
              filler{m.fillerCount === 1 ? "" : "s"}
            </div>
            <div className="text-[13px] text-stone-500">
              {m.fillersPerMin}/min
            </div>
          </div>
          <div className="ml-auto">
            <Stars n={m.stars} size={22} />
          </div>
        </div>
      ))}

      {show("score") && (
      <div className="mt-4 flex items-end gap-3">
        <Image
          src="/demos-speaking.webp"
          alt="Demos"
          width={62}
          height={62}
          className="demos w-[62px] rounded-[14px] border border-sand bg-surface"
        />
        <div className="rounded-[14px] rounded-bl-[4px] bg-terracotta-50 px-4 py-3 text-sm leading-relaxed">
          <div className="label-data !text-terracotta-600 mb-0.5">Demos</div>
          {coachLine}
          {coach?.focus && (
            <div className="mt-1.5 text-[13px] text-stone-600">
              Tomorrow: {coach.focus}
            </div>
          )}
          {coach?.strength && (
            <div className="mt-1 text-[13px] text-stone-500">
              Kept: {coach.strength}
            </div>
          )}
        </div>
      </div>

      )}

      {show("score") && result.accuracy && (
        <AccuracyCard accuracy={result.accuracy} topic={topic} />
      )}

      {show("numbers") && (
        <>
          <div className="mt-4">
            <PauseBar pauses={m.pauses} durationS={m.durationS} />
          </div>

          {/* What the silences actually DID. The bar shows where they
              fell; this says whether they were earned. */}
          {result.pauseHeadline && (
            <p className="mt-2 text-[13px] leading-relaxed text-stone-600">
              {result.pauseHeadline}
            </p>
          )}
        </>
      )}

      {show("numbers") && (
      <div className="mt-4">
        {/* Counted, not asserted. The label read "The eight" on every
            rep — including ones where the coach layer never ran and only
            the measured half existed, and now including reps recorded
            before fillers and self-corrections were scored apart. */}
        <div className="label-data mb-2">
          {coach ? "Every dimension" : "The measured dimensions"} · tap for why
        </div>
        <DimensionList
          tier1={tier1}
          anchors={anchors}
          metrics={m}
          coach={coach}
          pauseDetail={result.pauseHeadline ?? undefined}
        />
      </div>
      )}

      {show("numbers") && (
      <div className="mt-4 flex gap-3">
        <Metric label="WPM" value={String(m.wpm)} note={zone} />
        <Metric
          label="Held pauses"
          value={String(m.heldPauses)}
          note="≥0.8s, good and bad"
          amber
        />
        <Metric
          label="Length"
          value={`${Math.round(m.durationS)}s`}
          note="target 60–90"
        />
      </div>
      )}

      {show("words") && coach?.supply && (
        <div className="mt-4 rounded-[18px] border border-hairline bg-surface lift p-5">
          <div className="label-data">Supply · one upgrade, yours to keep</div>
          <div className="mt-2.5 flex items-center gap-3 text-[15px]">
            <span className="text-stone-500 line-through">
              {coach.supply.original}
            </span>
            <span aria-hidden>→</span>
            <span className="font-semibold">{coach.supply.upgrade}</span>
          </div>
          {coach.supply.note && (
            <p className="mt-1.5 text-[13px] text-stone-500">
              {coach.supply.note}
            </p>
          )}
        </div>
      )}

      {show("numbers") && m.fillers.length > 0 && (
        <div className="mt-4 rounded-[18px] border border-hairline bg-surface lift p-5">
          <div className="label-data">Every filler, with its timestamp</div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {m.fillers.map((f, i) => (
              <span
                key={i}
                className="rounded-full bg-sand px-2.5 py-1 text-[12.5px]"
              >
                {f.word}{" "}
                <span className="text-stone-500">
                  {Math.floor(f.t / 60)}:{String(Math.floor(f.t % 60)).padStart(2, "0")}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Open, not hidden behind a disclosure. Every score on this screen
          is a claim about these words — you should be able to read them
          without going looking. */}
      {show("words") && (
      <div className="mt-4 rounded-[18px] border border-hairline bg-surface lift px-5 py-4">
        <div className="label-data">
          What you said · {m.substance?.wordCount ?? 0} words
        </div>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          {result.transcript || "Nothing was picked up."}
        </p>
      </div>
      )}
    </>
  );
}

function Metric({
  label,
  value,
  note,
  amber = false,
}: {
  label: string;
  value: string;
  note: string;
  amber?: boolean;
}) {
  return (
    <div className="flex-1 rounded-[18px] border border-hairline bg-surface lift p-3.5">
      <div className="label-data">{label}</div>
      <div
        className={`font-display text-[26px] font-bold ${amber ? "text-amber-500" : ""}`}
      >
        {value}
      </div>
      <div className="text-[11.5px] text-stone-500">{note}</div>
    </div>
  );
}
