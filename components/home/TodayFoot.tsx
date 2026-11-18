"use client";

import { IconCheck, IconFlag, IconWave } from "@/components/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import type { FootFigure } from "@/lib/home";

/*
 * The two numbers only Today holds (#500): today's line (#281) and the
 * longest stretch with no filler (#254, #267), as two figures on the
 * page's ground under the games. No box and no rule: a number at the
 * numbers' 24/800, what it counts on its baseline, and under it one line
 * in plain words with its mark. The five trait tiles and This week that
 * stood here live elsewhere now (lib/home.ts, "The foot").
 *
 * Where it starts is the CSS's (`.home-foot`): on the first screen it
 * either stands wholly clear of the tab bar or starts under the screen's
 * foot, so no half of it shows through the glass (#500, the judges'
 * "nothing under the glass at rest").
 */
export function TodayFoot({ line, run }: { line: FootFigure; run: FootFigure }) {
  return (
    <div className="home-foot arrive">
      <Figure f={line} mark={line.state === "closed" ? "check" : line.state === "open" ? "flag" : null} />
      <Figure f={run} mark={run.state === "none" ? null : "wave"} />
    </div>
  );
}

function Figure({ f, mark }: { f: FootFigure; mark: "flag" | "check" | "wave" | null }) {
  return (
    <p className="home-fig" data-state={f.state}>
      <span className="sr-only">{f.said}</span>
      <span aria-hidden className="home-fig-num font-display">
        {f.figure !== null ? (
          <>
            <span className="home-fig-value">{f.figure}</span>
            <span className="home-fig-rate" data-tight={f.rate === "s" || undefined}>
              {f.rate}
            </span>
          </>
        ) : (
          <span className="home-fig-value text-stone-400">&ndash;</span>
        )}
      </span>
      <span aria-hidden className="home-fig-label font-display">
        {mark && (
          <span className="home-fig-mark" data-mark={mark}>
            {mark === "flag" ? <IconFlag size={13} /> : mark === "check" ? <IconCheck size={13} /> : <IconWave size={14} />}
          </span>
        )}
        {f.label}
      </span>
    </p>
  );
}

/** The two figures while the history is read: each at its landed height. */
export function TodayFootSkeleton() {
  return (
    <div aria-hidden className="home-foot">
      {[0, 1].map((i) => (
        <p key={i} className="home-fig">
          <span className="home-fig-num flex items-center">
            <Skeleton className="h-6 w-16" />
          </span>
          <span className="home-fig-label flex items-start pt-1">
            <Skeleton className="h-3 w-28" />
          </span>
        </p>
      ))}
    </div>
  );
}
