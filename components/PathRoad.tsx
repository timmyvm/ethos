"use client";

import Link from "next/link";
import { journeySteps, journeySummary } from "@/lib/progress";
import { UNITS } from "@/lib/path";
import { repHref } from "@/lib/rep-config";

/**
 * The road (DECISIONS #141) — the whole path, vertical and winding, on
 * the first screen. #90 deferred this because a 12-node road advertised
 * how little content existed; the fix was the content, and now the
 * point IS the length: every node visible without leaving home, ending
 * on an honest count of how far there is to go. Goal-gradient (#44)
 * says proximity moves effort — the road shows both the next step and
 * the summit.
 *
 * It inherits the rail's settled grammar: the endowed "Showed up" node
 * opens it (#45, stone because it's given, not earned), amber appears
 * only on earned stars, locked units name the exact stars to go, and
 * the ONE terracotta ring sits on the current node — the same rep the
 * floor card's button serves, so the screen still has one orange tap.
 */

/** The wind: node x-offsets cycling down the screen. */
const WIND = [0, 34, 52, 34, 0, -34, -52, -34];

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
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <div className="label-data">The road</div>
        <span className="text-[12.5px] text-stone-500">
          {summary.stars} of {summary.maxStars} stars
        </span>
      </div>

      <div className="mt-2">
        {steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          const unitHeader = step.unitName !== lastUnit && !step.endowed;
          lastUnit = step.endowed ? lastUnit : step.unitName;
          const unit = UNITS.find((u) => u.name === step.unitName);
          const x = WIND[i % WIND.length];

          const node = (
            <span
              className={`flex items-center justify-center rounded-full font-bold ${
                isCurrent
                  ? "h-14 w-14 text-[15px] ring-2 ring-terracotta-500 bg-surface text-stone-700"
                  : "h-12 w-12 text-[13px]"
              } ${
                step.endowed
                  ? // Given, not earned — stone, never amber (#45).
                    "bg-stone-900 text-cream"
                  : step.locked
                    ? "bg-sand text-stone-300"
                    : step.stars === 3
                      ? "bg-amber-500 text-cream"
                      : step.stars > 0
                        ? "bg-amber-50 text-amber-600 ring-1 ring-amber-500/40"
                        : isCurrent
                          ? ""
                          : "bg-surface text-stone-300 ring-1 ring-black/5"
              }`}
            >
              {step.endowed
                ? "✓"
                : step.locked
                  ? (unit?.icon ?? "·")
                  : step.stars > 0
                    ? `★${step.stars}`
                    : step.boss
                      ? "🔥"
                      : i}
            </span>
          );

          const wrapped = (
            <div
              className="flex flex-col items-center"
              style={{ transform: `translateX(${x}px)` }}
            >
              {node}
              {isCurrent && (
                <span className="mt-1.5 max-w-[140px] text-center text-[11px] font-semibold leading-tight text-stone-700">
                  {step.label}
                  <span className="block text-terracotta-600">up next</span>
                </span>
              )}
            </div>
          );

          return (
            <div key={step.id}>
              {unitHeader && unit && (
                <div className="mb-3 mt-6 text-center">
                  <div className="label-data">
                    {unit.icon} {unit.name}
                    {unit.boss ? " · weekly boss" : ""}
                  </div>
                  {step.locked && (
                    /* Why it's locked, with the exact distance (#44). */
                    <div className="mt-0.5 text-[11.5px] text-stone-400">
                      opens at {unit.unlocksAt} stars ·{" "}
                      {unit.unlocksAt - summary.stars} to go
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-center py-2.5">
                {step.locked || step.endowed || !step.lessonId ? (
                  wrapped
                ) : (
                  <Link
                    href={step.boss ? "/boss" : repHref({ lesson: step.lessonId })}
                    className="press"
                  >
                    {wrapped}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/*
       * The end of the road says how long the road is. An honest length
       * is the point — #90's objection inverted: with real content, the
       * distance is the pitch, and it names its numbers (#46).
       */}
      <div className="mt-6 rounded-[18px] border border-hairline bg-surface lift p-5 text-center">
        <div className="font-display text-[22px] font-bold leading-tight">
          {summary.totalLessons} lessons, end to end.
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">
          At one a day that&apos;s about {weeks} weeks of training — and three
          stars on everything takes longer. Every star is a measured number,
          never attendance.
        </p>
      </div>
    </section>
  );
}
