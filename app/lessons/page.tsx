"use client";

import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useCallback, useEffect, useState } from "react";
import { LessonRow, UpNextCard } from "@/components/lessons/LessonCard";
import { ErrorLine } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { LESSONS } from "@/content/lessons";
import { TRAITS, type TraitDef, type TraitId } from "@/content/traits";
import { fetchReps } from "@/lib/client-data";
import { lessonProgress } from "@/lib/lesson-progress";
import { lastReadings, traitForSaid, upNextLesson } from "@/lib/lesson-up-next";
import { fmtRaw } from "@/lib/trait-readings";
import { readOnboarding } from "@/lib/answers";
import { buildPortfolio } from "@/lib/portfolio";

/**
 * Lessons (DECISIONS #269).
 *
 * The whole set, grouped by the trait each one works on, so choosing is
 * a real choice rather than a position on a track. Today picks one
 * practice from your numbers; this page is where you pick for yourself.
 *
 * A LIST YOU MOVE THROUGH, not a gallery (the feedback round after
 * #296: "lesson pictures look like ads", "makes you think you have to
 * pay for them"). The next lesson sits on top as the page's one card and
 * its one tap, straight into its next practice (M03). Under it the five
 * traits are open sections on the ground (M01, Imprint's home): a head
 * in the trait's ink, the trait's last number, and three rows. The
 * tone is on the head and the art and nowhere else, never a second tap.
 *
 * It carries over the one thing from the road worth keeping: the mark
 * on whichever trait their own answers named in the introduction, in
 * their words (#231, and check-onboarding waits on it, #294). The road's
 * endowed "Showed up" row does NOT carry over: docs/closure.md's reject
 * list opens with endowed progress, and CLAUDE.md says stars, streaks
 * and scores are earned.
 *
 * Under the title, one quiet line counts the practices done of all of
 * them (round 2, M26, Imprint's path s9; it reverses #317's "no
 * subtitle"): the earned count, read from the same log as the rows,
 * and while that log is in flight a bar holding the line, never "0".
 */
export default function LessonsPage() {
  /* null while the log is in flight, so the up-next card never shows
     one lesson and then swaps to another (Skeleton's rule 1). */
  const [done, setDone] = useState<Record<string, number> | null>(null);
  /* Each trait's last reading, null while the log is in flight. */
  const [readings, setReadings] = useState<Partial<
    Record<TraitId, number>
  > | null>(null);
  /* A failed read is its own state, never an empty log (#147). It used
     to land as done = {}, and the page said "Start" on a lesson they may
     have finished: no card, no bars, a line and a retry instead. */
  const [failed, setFailed] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchReps(200)
      .then((reps) => {
        setDone(lessonProgress(reps));
        setReadings(lastReadings(reps));
      })
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
    setReadings(null);
    load();
  };

  /* Practices with a recording, of every practice on the page. A lesson
     counts at most its own practices, whatever the log holds. */
  const total = LESSONS.reduce((n, l) => n + l.practices.length, 0);
  const earned = done
    ? LESSONS.reduce((n, l) => n + Math.min(done[l.id] ?? 0, l.practices.length), 0)
    : null;

  const focus = traitForSaid(said);
  const next = done ? upNextLesson(done, focus) : null;
  /* null reaches every row until the log is in: unknown, not zero. */
  const count = (id: string) => (done ? (done[id] ?? 0) : null);
  /* The row the card points at says so, in the card's own words. */
  const cue = (id: string) =>
    next?.id === id ? ((done?.[id] ?? 0) > 0 ? "Carry on" : "Up next") : null;

  return (
    <main className="mx-auto max-w-[430px] px-5 pb-[var(--nav-clear)] pt-7">
      <ScreenHeader
        title="Lessons"
        subtitle={
          earned !== null ? (
            <span className="arrive">
              {earned} of {total} practices
            </span>
          ) : failed ? (
            /* The error line below says why; the line keeps its height. */
            "\u00a0"
          ) : (
            <span aria-hidden className="flex h-5 items-center">
              <Skeleton className="h-3 w-32" rounded="rounded-none" />
            </span>
          )
        }
      />

      {/* system-7: the first block sits mt-5 under the header, every tab. */}
      <div className="mt-5">
        {failed ? (
          <ErrorLine onRetry={retry}>Your progress didn&apos;t load.</ErrorLine>
        ) : done === null ? (
          <Skeleton className="h-[100px] w-full" rounded="rounded-card" />
        ) : (
          next && <UpNextCard lesson={next} done={done[next.id] ?? 0} />
        )}
      </div>

      {TRAITS.map((t) => {
        const mine = LESSONS.filter((l) => l.trait === t.id);
        if (mine.length === 0) return null;
        return (
          <section key={t.id} data-trait={t.id} className="mt-7">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="section-head tone-ink">{t.name}</h2>
              {/* Their own words, kept from the road (#231). */}
              {focus === t.id && (
                <span className="section-head-aside tone-ink">
                  You said {said}
                </span>
              )}
            </div>
            <TraitNumber
              trait={t}
              raw={readings ? (readings[t.id] ?? null) : undefined}
              pending={!failed}
            />
            <div className="stagger mt-2">
              {mine.map((l, i) => (
                <LessonRow
                  key={l.id}
                  lesson={l}
                  done={count(l.id)}
                  pending={!failed}
                  first={i === 0}
                  eager={t.id === TRAITS[0].id}
                  cue={cue(l.id)}
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
 * The trait's last number under its head ("1.8 held pauses a minute"),
 * from the last recording. A number, not a description of the trait
 * (#317). `raw` is undefined while the log is in flight (the line keeps
 * its height), null when there is no reading (no line at all, never 0).
 */
function TraitNumber({
  trait,
  raw,
  pending,
}: {
  trait: TraitDef;
  raw: number | null | undefined;
  pending: boolean;
}) {
  if (raw === undefined) {
    return pending ? (
      <div aria-hidden className="mt-1 flex h-[22.5px] items-center">
        <Skeleton className="h-3 w-44" rounded="rounded-none" />
      </div>
    ) : null;
  }
  if (raw === null) return null;
  const shown = fmtRaw(raw);
  return (
    <p className="arrive mt-1 text-body text-stone-500">
      <span className="font-display font-bold tabular-nums text-ink">
        {shown}
      </span>{" "}
      {shown === "1" ? trait.unitOne : trait.unit}
    </p>
  );
}
