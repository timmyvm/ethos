"use client";

import Link from "next/link";
import { IconBoss } from "@/components/Icon";
import { journeySteps, journeySummary } from "@/lib/progress";
import { UNITS } from "@/lib/path";
import { repHref } from "@/lib/rep-config";

/**
 * The road (DECISIONS #141) — the whole path on the first screen. #90
 * deferred this because a 12-node road advertised how little content
 * existed; the fix was the content, and now the point IS the length:
 * every lesson visible without leaving home, ending on an honest count
 * of how far there is to go. Goal-gradient (#44) says proximity moves
 * effort — the road shows both the next step and the summit.
 *
 * Instrument grammar (#201): a vertical LIST, not winding nodes.
 * Completed lessons are rows with an olive number and their stars;
 * the current lesson sits in the one terracotta-bordered card (the
 * same recording the floor button serves, so the screen still has one
 * terracotta tap); future lessons wait at 40%; and each unit boundary is a
 * checkpoint between two ink rules. The endowed "Showed up" row still
 * opens it (#45, ink because it's given, not earned).
 *
 * Since #155 this is the ONLY path surface: the tab is gone, and each
 * gate opens on stars and nothing else. #89's line holds: progress-
 * gating is earned and free; there is no time-lock and no paid key,
 * and, unlike Duolingo's "JUMP HERE", no skipping past a closed door
 * (#28: gates open on measured stars).
 */

/**
 * The gate (DECISIONS #156) — every unit past the first stands behind a
 * door. Closed until the star total opens it, open forever after; the
 * two states are geometry, not animation. Drawn in the icon grammar
 * (currentColor, no fills) so it can never carry a colour the theme
 * doesn't know, sized to the checkpoint row it marks, with the stroke
 * compensated so it renders at the set's visual weight.
 */
function Gate({ open, width = 96 }: { open: boolean; width?: number }) {
  const frame = (
    <>
      <path d="M6 66 H90" />
      <path d="M26 66 V32 a22 22 0 0 1 44 0 V66" />
    </>
  );
  return (
    <svg
      width={width}
      height={(width * 72) / 96}
      viewBox="0 0 96 72"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.75 * (96 / Math.max(width, 1)) * 0.55}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {frame}
      {open ? (
        <>
          <path d="M26 66 12 59.5 V27.5 L26 33.5" />
          <path d="M70 66 84 59.5 V27.5 L70 33.5" />
        </>
      ) : (
        <>
          <path d="M48 66 V10.5" />
          <circle cx="43.5" cy="42" r="1.4" />
          <circle cx="52.5" cy="42" r="1.4" />
        </>
      )}
    </svg>
  );
}

/** The 18px thread between rows — the road, drawn as a line. */
function Connector() {
  return <div aria-hidden className="ml-3.5 h-[18px] border-l border-edge" />;
}

export function PathRoad({
  starMap,
  hasAnyRep,
}: {
  starMap: Record<string, number>;
  hasAnyRep: boolean;
}) {
  const steps = journeySteps(starMap, hasAnyRep);
  const summary = journeySummary(starMap);
  const currentIndex = steps.findIndex(
    (s) => !s.endowed && !s.locked && !s.boss && s.stars < 3
  );
  const weeks = Math.round(summary.totalLessons / 7);

  let lastUnit: string | null = null;

  return (
    <section className="mt-7 border-t border-hairline pt-4">
      <div className="label-data">The road</div>

      <div className="mt-3 flex flex-col">
        {steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          const unitHeader = step.unitName !== lastUnit && !step.endowed;
          lastUnit = step.endowed ? lastUnit : step.unitName;
          const unit = UNITS.find((u) => u.name === step.unitName);
          const done = !step.endowed && step.stars > 0;

          const row = isCurrent ? (
            /* The current lesson: the screen's terracotta element, on the
               raised paper. Same recording as the floor button above. */
            <span className="-mx-3.5 flex items-center gap-3.5 rounded-xl border-[1.5px] border-terracotta-500 bg-raised px-3.5 py-2.5">
              <span className="font-display w-[30px] shrink-0 text-[12px] font-extrabold tabular-nums">
                {i}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-[14px] font-bold">
                  {step.label}
                </span>
                <span className="mt-px block text-[12px] text-stone-400">
                  Today · same recording as the card
                </span>
              </span>
            </span>
          ) : (
            <span
              className={`flex items-center gap-3.5 px-0.5 ${
                done || step.endowed ? "" : "opacity-40"
              }`}
            >
              <span
                className={`font-display w-[30px] shrink-0 text-[12px] font-bold tabular-nums ${
                  done ? "text-sage-700" : ""
                }`}
              >
                {step.endowed ? "✓" : step.boss ? <IconBoss size={15} /> : i}
              </span>
              <span className="font-display min-w-0 flex-1 truncate text-left text-[14px] font-semibold">
                {step.label}
              </span>
              {done && (
                <span className="font-display shrink-0 text-[12px] font-bold text-sage-700 tabular-nums">
                  {step.stars}★
                </span>
              )}
            </span>
          );

          return (
            <div key={step.id} className="flex flex-col">
              {unitHeader && unit && (
                <>
                  {i > 0 && <Connector />}
                  {/* The checkpoint: a unit boundary between two ink
                      rules. The door is the road's one lock symbol
                      (#156); the distance keeps #44's exact count. */}
                  <div className="flex items-center gap-3.5 border-y border-ink py-2.5">
                    <span
                      className={`flex w-[30px] shrink-0 justify-center ${
                        step.locked ? "text-stone-500" : "text-stone-300"
                      }`}
                    >
                      {unit.unlocksAt > 0 ? (
                        <Gate open={!step.locked} width={26} />
                      ) : null}
                    </span>
                    <span className="font-display min-w-0 flex-1 text-[13.5px] font-bold">
                      {unit.name}
                      {unit.boss ? " · weekly boss" : ""}
                    </span>
                    {step.locked && (
                      <span className="shrink-0 text-[12px] text-stone-500 tabular-nums">
                        {unit.unlocksAt}★ · {unit.unlocksAt - summary.stars} to
                        go
                      </span>
                    )}
                  </div>
                </>
              )}
              {(i > 0 || unitHeader) && <Connector />}
              {step.locked || step.endowed || !step.lessonId ? (
                row
              ) : (
                <Link
                  href={step.boss ? "/boss" : repHref({ lesson: step.lessonId })}
                  className="press -my-3 block py-3"
                >
                  {row}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/*
       * The end of the road says how long the road is. An honest length
       * is the point — #90's objection inverted: with real content, the
       * distance is the pitch, and it names its numbers (#46).
       */}
      <p className="mt-4 text-[12px] text-stone-400">
        {summary.totalLessons} lessons, end to end. About {weeks} weeks at one
        a day.
      </p>
    </section>
  );
}
