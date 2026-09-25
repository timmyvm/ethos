"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { lessonById } from "@/content/lessons";
import { TRAIT } from "@/content/traits";
import { fetchReps } from "@/lib/client-data";
import { lessonProgress, nextPractice } from "@/lib/lesson-progress";
import { repHref } from "@/lib/rep-config";
import { modById } from "@/lib/stress-mods";
import { ACTION_CLASS, DISABLED_CLASS } from "@/lib/ui";
import { LessonArt, Pips, progressLabel } from "@/components/lessons/LessonCard";
import { ErrorLine } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * One lesson (DECISIONS #269).
 *
 * Three practices, and the last one is harder than the two before it.
 * "Harder" is a MOD, not a longer timer or a higher bar to clear: the
 * mod system already exists, is already balanced, and already has a
 * free member. `no-notes` hides the prompt the moment recording starts,
 * which is the cheapest real difficulty in the app.
 *
 * It is always the free one. A lesson whose final step could not be
 * reached without paying would be progress sold for money, which #14
 * rules out, and the three premium mods stay where they are: optional,
 * and on top.
 *
 * Progress is READ from the recordings rather than tracked beside them
 * (`lib/lesson-progress.ts`). There is no lesson-progress table and
 * there should not be one: the recordings are what the product is made
 * of, and a counter that can drift from them will.
 */
export default function LessonPage() {
  const id = String(useParams().id ?? "");
  const lesson = lessonById(id);
  /*
   * null until the log is in. It started at 0, so a returning user saw
   * "3 practices", three empty segments and "Start the lesson" until
   * the read landed, and a tap inside that window filed practice 1 a
   * second time. Unknown draws skeletons and a button that cannot be
   * pressed; a failed read draws a retry, never a zero.
   */
  const [done, setDone] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    fetchReps(200)
      .then((reps) => setDone(lessonProgress(reps)[id] ?? 0))
      .catch(() => setFailed(true));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setFailed(false);
    setDone(null);
    load();
  };

  if (!lesson) notFound();

  const total = lesson.practices.length;
  const known = done !== null;
  const next = nextPractice(lesson, done ?? 0);
  const complete = known && done >= total;

  return (
    <main data-trait={lesson.trait} className="mx-auto max-w-[430px] px-5 pb-28 pt-4">
      <Link
        href="/lessons"
        className="press -ml-1 inline-flex min-h-11 items-center px-1 text-sm text-stone-500"
      >
        ← Lessons
      </Link>

      {/*
       * The head is the trait's own ground with the art as a tile on it,
       * not a full-bleed picture over the title. A banner of glossy art
       * with a title under it is the shape of an ad or a course you
       * buy, and a first-time user read it exactly that way (the
       * feedback round after #296). The tile keeps the picture; the
       * ground, the pips and the count say it is a thing you do.
       */}
      <header className="tone-wash mt-2 rounded-card border border-card-edge p-5">
        <div className="flex items-center gap-4">
          <LessonArt lesson={lesson} size={84} eager />
          <div className="min-w-0">
            <div className="label-data tone-ink">{TRAIT[lesson.trait].name}</div>
            <h1 className="font-display mt-1 text-title leading-tight">
              {lesson.title}
            </h1>
          </div>
        </div>
        <p className="mt-3 text-body leading-relaxed text-stone-600">
          {lesson.blurb}
        </p>
        {/* One line tall while it matters, so nothing moves when the log
            lands: skeletons in flight, then the pips. A failed read has
            no line at all; its retry sits where the button would be. */}
        {!failed && (
          <div className="mt-4 flex h-4 items-center gap-2.5">
            {known ? (
              <>
                <Pips done={done} total={total} />
                <span
                  className={`label-micro whitespace-nowrap ${complete ? "text-sage-700" : "tone-ink"}`}
                >
                  {progressLabel(done, total)}
                </span>
              </>
            ) : (
              <>
                <Skeleton className="h-[5px] w-[62px]" rounded="rounded-none" />
                <Skeleton className="h-2.5 w-16" rounded="rounded-none" />
              </>
            )}
          </div>
        )}
      </header>

      {/*
       * The three practices as one list: a numbered square that turns
       * sage when it has a recording, the prompt, and on the last one
       * what makes it harder.
       */}
      <ol className="elev-1 mt-4 overflow-hidden rounded-card border border-card-edge bg-raised">
        {lesson.practices.map((p, i) => {
          const n = i + 1;
          /* Unknown is neither done nor next: every square waits in
             the wash until the log says which is which. */
          const did = known && n <= done;
          /* The one the button starts wears the trait's solid tone. */
          const here = known && !complete && n === next;
          const mod = p.mods?.[0] ? modById(p.mods[0]) : null;
          return (
            <li
              key={n}
              data-done={known ? did : undefined}
              className={`flex gap-3.5 px-4 py-3.5 ${i ? "border-t border-hairline" : ""}`}
            >
              <span
                aria-hidden
                className={`font-display flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[13px] font-bold tabular-nums ${
                  did
                    ? "bg-sage-500 text-sage-ink"
                    : here
                      ? "tone-fill tone-on"
                      : "tone-wash tone-ink tone-ring"
                }`}
              >
                {did ? "✓" : n}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <span className="sr-only">Practice {n}{did ? ", done" : ""}. </span>
                <p className={`text-body leading-snug ${did ? "text-stone-500" : ""}`}>
                  {p.prompt}
                </p>
                {/*
                 * The mod is named, never the tier. What makes the last
                 * one harder should be legible; which internal band a
                 * practice sits in should not be, and is not rendered
                 * anywhere in the app.
                 */}
                {mod && (
                  <p className="mt-1.5 text-caption text-stone-500">
                    <span className="font-semibold text-ink">{mod.name}.</span>{" "}
                    {mod.blurb}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="pt-6">
        {known ? (
          <Link
            href={repHref({
              lesson: lesson.id,
              q: String(next),
              back: `/lessons/${lesson.id}`,
            })}
            className={ACTION_CLASS}
          >
            {complete
              ? "Run it again"
              : done === 0
                ? "Start the lesson"
                : `Practice ${next} of ${total}`}
          </Link>
        ) : failed ? (
          <ErrorLine className="text-center" onRetry={retry}>
            Your progress didn&apos;t load.
          </ErrorLine>
        ) : (
          /* The button's own shape, unpressable and unlabelled: which
             practice it starts is exactly what is not known yet. */
          <button
            type="button"
            disabled
            aria-busy="true"
            className={`${ACTION_CLASS} ${DISABLED_CLASS}`}
          >
            <span className="sr-only">Loading your progress</span>
            <Skeleton className="mx-auto h-3 w-28" rounded="rounded-none" />
          </button>
        )}
        {complete && (
          <p className="mt-2.5 text-center text-caption text-stone-400">
            Another run still counts.
          </p>
        )}
      </div>
    </main>
  );
}
