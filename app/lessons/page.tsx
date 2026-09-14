"use client";

import { useEffect, useState } from "react";
import { LessonCard } from "@/components/lessons/LessonCard";
import { LESSONS } from "@/content/lessons";
import { TRAITS } from "@/content/traits";
import { fetchReps } from "@/lib/client-data";
import { lessonProgress } from "@/lib/lesson-progress";
import { readOnboarding } from "@/lib/answers";
import { buildPortfolio } from "@/lib/portfolio";

/**
 * Lessons (DECISIONS #269).
 *
 * The road used to live under the floor card on Today, and it was the
 * same road for everybody: units in an order chosen once, gated on
 * stars, rows under hairlines. The shift put the five traits on Today
 * instead, because the only honest reason a practice is in front of you
 * is that its number is yours. This page is the other half of that: the
 * whole set, grouped by the trait each one trains, so choosing is a
 * real choice rather than a position on a track.
 *
 * It carries over the one thing from the road worth keeping: the mark
 * on whichever trait their own answers named in the introduction, in
 * their words (#231). The road's endowed "Showed up" row does NOT
 * carry over, and that is a correction rather than a loss:
 * docs/closure.md's reject list opens with endowed progress, which
 * works precisely because the head start is unearned, and CLAUDE.md
 * says stars, streaks and scores are earned.
 */
export default function LessonsPage() {
  const [done, setDone] = useState<Record<string, number>>({});
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    const answers = readOnboarding().answers;
    setSaid(buildPortfolio(answers).focus?.said ?? null);
    fetchReps(200)
      .then((reps) => setDone(lessonProgress(reps)))
      .catch(() => {});
  }, []);

  return (
    <main className="mx-auto max-w-[430px] px-5 pb-24 pt-8">
      <h1 className="font-display text-title">Lessons</h1>
      <p className="mt-1.5 text-body text-stone-500">
        Today picks one practice from your numbers. This is the whole set, and
        you choose.
      </p>

      {TRAITS.map((t) => {
        const mine = LESSONS.filter((l) => l.trait === t.id);
        if (mine.length === 0) return null;
        return (
          <section key={t.id} className="mt-8">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="label-data">{t.name}</h2>
              {/* Their own words, kept from the road (#231). */}
              {said && buildPortfolioTrait(said) === t.id && (
                <span className="text-caption text-terracotta-700">
                  You said {said}
                </span>
              )}
            </div>
            <p className="mt-1 text-caption text-stone-400">{t.what}</p>
            <div className="stagger mt-3 grid grid-cols-2 gap-3">
              {mine.map((l, i) => (
                <LessonCard
                  key={l.id}
                  lesson={l}
                  done={done[l.id] ?? 0}
                  lead={i === 0}
                />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

/**
 * Which trait an introduction answer points at. The portfolio's focus
 * still speaks in the road's vocabulary (units), so this is the one
 * place that translation lives until `lib/portfolio.ts` is moved onto
 * traits outright.
 */
function buildPortfolioTrait(said: string): string | null {
  const s = said.toLowerCase();
  if (s.includes("filler") || s.includes("um")) return "fillers";
  if (s.includes("rush") || s.includes("fast") || s.includes("slow")) return "pace";
  if (s.includes("pause") || s.includes("silence") || s.includes("blank")) return "pause";
  if (s.includes("restart") || s.includes("repeat")) return "repairs";
  return null;
}
