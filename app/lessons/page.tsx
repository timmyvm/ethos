"use client";

import { useCallback, useEffect, useState } from "react";
import { LessonRow, UpNextCard } from "@/components/lessons/LessonCard";
import { ErrorLine } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { LESSONS } from "@/content/lessons";
import { TRAITS } from "@/content/traits";
import { fetchReps } from "@/lib/client-data";
import { lessonProgress } from "@/lib/lesson-progress";
import { traitForSaid, upNextLesson } from "@/lib/lesson-up-next";
import { readOnboarding } from "@/lib/answers";
import { buildPortfolio } from "@/lib/portfolio";

/**
 * Lessons (DECISIONS #269).
 *
 * The whole set, grouped by the trait each one trains, so choosing is a
 * real choice rather than a position on a track. Today picks one
 * practice from your numbers; this page is where you pick for yourself.
 *
 * A LIST YOU MOVE THROUGH, not a gallery (the feedback round after
 * #296: "lesson pictures look like ads", "makes you think you have to
 * pay for them"). The shape that fixes it is Duolingo's and Headspace's:
 * the next lesson sits on top with the page's one tap and goes straight
 * into its next practice, and every trait is a coloured group of rows
 * with a thumbnail, the three practices as segments, and the same arrow
 * the app's free doors end in. The colour is the trait's tone
 * (globals.css, "lessons (trait tones)"), a ground and a label, never
 * a second tap.
 *
 * It carries over the one thing from the road worth keeping: the mark
 * on whichever trait their own answers named in the introduction, in
 * their words (#231). The road's endowed "Showed up" row does NOT carry
 * over: docs/closure.md's reject list opens with endowed progress, and
 * CLAUDE.md says stars, streaks and scores are earned.
 */
export default function LessonsPage() {
  /* null while the log is in flight, so the up-next card never shows
     one lesson and then swaps to another (Skeleton's rule 1). */
  const [done, setDone] = useState<Record<string, number> | null>(null);
  /* A failed read is its own state, never an empty log (#147). It used
     to land as done = {}, and the page said "Start" on a lesson they may
     have finished: no card, no pips, a line and a retry instead. */
  const [failed, setFailed] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchReps(200)
      .then((reps) => setDone(lessonProgress(reps)))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    const answers = readOnboarding().answers;
    setSaid(buildPortfolio(answers).focus?.said ?? null);
    load();
  }, [load]);

  const retry = () => {
    setFailed(false);
    setDone(null);
    load();
  };

  const focus = traitForSaid(said);
  const next = done ? upNextLesson(done, focus) : null;
  /* null reaches every row until the log is in: unknown, not zero. */
  const count = (id: string) => (done ? (done[id] ?? 0) : null);

  return (
    <main className="mx-auto max-w-[430px] px-5 pb-24 pt-8">
      <h1 className="font-display text-title">Lessons</h1>
      <p className="mt-1.5 text-pretty text-body text-stone-500">
        Fifteen lessons, all free. Three practices each.
      </p>

      <div className="mt-6">
        {failed ? (
          <ErrorLine onRetry={retry}>Your progress didn&apos;t load.</ErrorLine>
        ) : done === null ? (
          <Skeleton className="h-[200px] w-full" rounded="rounded-card" />
        ) : (
          next && <UpNextCard lesson={next} done={done[next.id] ?? 0} />
        )}
      </div>

      {TRAITS.map((t) => {
        const mine = LESSONS.filter((l) => l.trait === t.id);
        if (mine.length === 0) return null;
        return (
          <section
            key={t.id}
            data-trait={t.id}
            className="elev-1 mt-5 overflow-hidden rounded-card border border-card-edge bg-raised"
          >
            <header className="tone-wash flex items-center gap-3 px-4 py-3">
              <span aria-hidden className="tone-fill h-7 w-1.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <h2 className="label-data tone-ink">{t.name}</h2>
                  {/* Their own words, kept from the road (#231). */}
                  {focus === t.id && (
                    <span className="text-caption font-semibold tone-ink">
                      You said {said}
                    </span>
                  )}
                </span>
                <span className="tone-ink mt-0.5 block text-pretty text-caption opacity-80">
                  {t.what}
                </span>
              </span>
            </header>
            <div className="stagger">
              {mine.map((l, i) => (
                <LessonRow
                  key={l.id}
                  lesson={l}
                  done={count(l.id)}
                  pending={!failed}
                  first={i === 0}
                />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
