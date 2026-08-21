"use client";

import Link from "next/link";
import { IconBoss } from "@/components/Icon";
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
 *
 * Since #155 this is the ONLY path surface: the tab is gone, and each
 * unit boundary is a gate (#156) that opens on stars and nothing else.
 * #89's line holds: progress-gating is earned and free; there is no
 * time-lock and no paid key, and, unlike Duolingo's "JUMP HERE", no
 * skipping past a closed door (#28: gates open on measured stars).
 */

/** The wind: node x-offsets cycling down the screen. */
const WIND = [0, 34, 52, 34, 0, -34, -52, -34];

/**
 * The gate (DECISIONS #156) — every unit past the first stands behind a
 * door across the road. Closed until the star total opens it, open
 * forever after; the two states are geometry, not animation. Drawn in
 * the icon grammar (1.5px stroke, currentColor, no fills) so it can
 * never carry a colour the theme doesn't know. It is decoration in the
 * strict sense, aria-hidden, because the line under it says everything
 * it means: which unit, and exactly how many stars away the handle is.
 *
 * The door is the road's one lock symbol. The lessons behind it stay
 * visible and dimmed (Duolingo's greyed future path), but they no
 * longer wear padlocks each: a mechanic is explained where it happens,
 * once, and it happens at the gate.
 */
function Gate({ open }: { open: boolean }) {
  const frame = (
    <>
      <path d="M6 66 H90" />
      <path d="M26 66 V32 a22 22 0 0 1 44 0 V66" />
    </>
  );
  return (
    <svg
      width={108}
      height={81}
      viewBox="0 0 96 72"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
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
              {step.endowed ? (
                "✓"
              ) : step.boss ? (
                <IconBoss size={18} />
              ) : step.stars > 0 ? (
                `★${step.stars}`
              ) : (
                i
              )}
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
                <div className="mb-3 mt-7 text-center">
                  {unit.unlocksAt > 0 && (
                    <div
                      className={`flex justify-center ${
                        step.locked ? "text-stone-500" : "text-stone-300"
                      }`}
                    >
                      <Gate open={!step.locked} />
                    </div>
                  )}
                  <div className={unit.unlocksAt > 0 ? "label-data mt-2" : "label-data"}>
                    {unit.icon} {unit.name}
                    {unit.boss ? " · weekly boss" : ""}
                  </div>
                  {step.locked && (
                    /* Why it's closed, with the exact distance (#44). */
                    <div className="mt-1 text-[11.5px] font-semibold text-stone-400">
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
          About {weeks} weeks at one a day.
        </p>
      </div>
    </section>
  );
}
