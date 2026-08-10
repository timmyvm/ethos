"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { journeySteps, journeySummary } from "@/lib/progress";
import { repHref } from "@/lib/rep-config";

/**
 * The path, on the first screen. Amabile & Kramer's diary study found
 * nothing moves motivation like visible progress in work that matters,
 * so it goes above the fold rather than behind a tab.
 *
 * The rail auto-scrolls to the current node: the user should see where
 * they are without hunting, and should see filled nodes behind them.
 */
export function PathRail({
  starMap,
  hasAnyRep,
}: {
  starMap: Record<string, number>;
  hasAnyRep: boolean;
}) {
  const steps = journeySteps(starMap, hasAnyRep);
  const summary = journeySummary(starMap);
  const railRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLAnchorElement>(null);

  const currentIndex = steps.findIndex(
    (s) => !s.endowed && !s.locked && s.stars < 3
  );

  useEffect(() => {
    const rail = railRef.current;
    const node = currentRef.current;
    if (!rail || !node) return;
    rail.scrollTo({
      left: Math.max(0, node.offsetLeft - rail.clientWidth / 2 + 40),
      behavior: "auto",
    });
  }, [currentIndex]);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="label-data">Your path</div>
        <Link href="/path" className="text-[12.5px] font-semibold text-stone-500">
          all units →
        </Link>
      </div>

      {/* One honest headline number, not a vanity percentage. */}
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-display text-[26px] font-bold leading-none">
          {summary.stars}
        </span>
        <span className="text-[13px] text-stone-500">
          of {summary.maxStars} stars · {summary.lessonsMastered} lesson
          {summary.lessonsMastered === 1 ? "" : "s"} at 3★
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand">
        <div
          className="h-full rounded-full bg-amber-500 transition-[width] duration-700"
          style={{ width: `${Math.max(2, summary.pct * 100)}%` }}
        />
      </div>

      <div
        ref={railRef}
        className="-mx-5 mt-3 flex snap-x gap-2 overflow-x-auto px-5 pb-1"
      >
        {steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          const body = (
            <>
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-bold ${
                  step.endowed
                    ? // Stone, not amber: this node is given, not earned,
                      // and amber is earned-only (DECISIONS #4).
                      "bg-stone-900 text-cream"
                    : step.locked
                      ? "bg-sand text-stone-300"
                      : step.stars === 3
                        ? "bg-amber-500 text-cream"
                        : step.stars > 0
                          ? "bg-amber-50 text-amber-600 ring-1 ring-amber-500/40"
                          : isCurrent
                            ? "bg-surface text-stone-700 ring-2 ring-terracotta-500"
                            : "bg-surface text-stone-300 ring-1 ring-black/5"
                }`}
              >
                {step.endowed
                  ? "✓"
                  : step.locked
                    ? "🔒"
                    : step.stars > 0
                      ? "★".repeat(step.stars)
                      : i}
              </span>
              <span
                className={`mt-1 block w-[72px] text-center text-[10.5px] leading-tight ${
                  isCurrent ? "font-semibold text-stone-700" : "text-stone-400"
                }`}
              >
                {step.endowed ? "Showed up" : step.label}
              </span>
            </>
          );

          if (step.locked || step.endowed || !step.lessonId) {
            return (
              <div
                key={step.id}
                className="flex shrink-0 snap-start flex-col items-center"
              >
                {body}
              </div>
            );
          }

          return (
            <Link
              key={step.id}
              ref={isCurrent ? currentRef : undefined}
              href={repHref({ lesson: step.lessonId })}
              className="flex shrink-0 snap-start flex-col items-center"
            >
              {body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
