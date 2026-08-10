"use client";

import Image from "next/image";
import { DimensionList } from "@/components/DimensionList";
import { PauseBar } from "@/components/PauseBar";
import { Stars } from "@/components/Stars";
import type { CoachOutput } from "@/lib/coach";
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
}

/**
 * The results view, shared by a just-finished rep and any row in the
 * log. Leads with the Index delta and the ONE focus (mechanics.md
 * display rules) — never a wall of eight numbers.
 */
export function RepResult({ result }: { result: ResultView }) {
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
      {ethosIndex !== null ? (
        <div className="mt-3 flex items-baseline gap-3.5">
          <div className="font-display text-[64px] font-bold leading-none">
            {ethosIndex}
          </div>
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
          </div>
          <div className="ml-auto">
            <Stars n={m.stars} size={22} />
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
      )}

      <div className="mt-4 flex items-end gap-3">
        <Image
          src="/demos-speaking.webp"
          alt="Demos"
          width={62}
          height={62}
          className="w-[62px] rounded-[14px] border border-sand bg-white"
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

      <div className="mt-4">
        <PauseBar pauses={m.pauses} durationS={m.durationS} />
      </div>

      <div className="mt-4">
        <div className="label-data mb-2">The eight · tap for why</div>
        <DimensionList
          tier1={tier1}
          anchors={anchors}
          metrics={m}
          coach={coach}
        />
      </div>

      <div className="mt-4 flex gap-3">
        <Metric label="WPM" value={String(m.wpm)} note={zone} />
        <Metric
          label="Held pauses"
          value={String(m.heldPauses)}
          note="≥0.8s, on purpose"
          amber
        />
        <Metric
          label="Length"
          value={`${Math.round(m.durationS)}s`}
          note="target 60–90"
        />
      </div>

      {coach?.supply && (
        <div className="mt-4 rounded-[18px] border border-black/5 bg-white p-5">
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

      {m.fillers.length > 0 && (
        <div className="mt-4 rounded-[18px] border border-black/5 bg-white p-5">
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

      <details className="mt-4 rounded-[18px] border border-black/5 bg-white px-5 py-4">
        <summary className="label-data cursor-pointer select-none">
          Transcript
        </summary>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          {result.transcript}
        </p>
      </details>
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
    <div className="flex-1 rounded-[18px] border border-black/5 bg-white p-3.5">
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
