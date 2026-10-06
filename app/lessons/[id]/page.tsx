"use client";

import { BackLink } from "@/components/ui/ScreenHeader";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IconCheck } from "@/components/Icon";
import { TraitChip } from "@/components/TraitChip";
import { lessonById } from "@/content/lessons";
import { TRAIT } from "@/content/traits";
import { fetchReps } from "@/lib/client-data";
import { lessonProgress, nextPractice } from "@/lib/lesson-progress";
import { lastReadings } from "@/lib/lesson-up-next";
import { repHref } from "@/lib/rep-config";
import { modById } from "@/lib/stress-mods";
import { fmtRaw } from "@/lib/trait-readings";
import { ACTION_CLASS, DISABLED_CLASS } from "@/lib/ui";
import { ErrorLine } from "@/components/ui/ErrorState";
import { FooterShelf } from "@/components/ui/FooterShelf";
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
   * three empty squares and a button saying "Start" until the read
   * landed, and a tap inside that window filed practice 1 a second
   * time. Unknown draws neutral squares and a button that cannot be
   * pressed; a failed read draws a retry, never a zero.
   */
  const [done, setDone] = useState<number | null>(null);
  /* The trait's last reading: undefined in flight, null when there is none. */
  const [reading, setReading] = useState<number | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    fetchReps(200)
      .then((reps) => {
        setDone(lessonProgress(reps)[id] ?? 0);
        const trait = lessonById(id)?.trait;
        setReading(trait ? (lastReadings(reps)[trait] ?? null) : null);
      })
      .catch(() => setFailed(true));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setFailed(false);
    setDone(null);
    setReading(undefined);
    load();
  };

  if (!lesson) notFound();

  const total = lesson.practices.length;
  const known = done !== null;
  const next = nextPractice(lesson, done ?? 0);
  const complete = known && done >= total;
  const trait = TRAIT[lesson.trait];
  const shown = typeof reading === "number" ? fmtRaw(reading) : null;

  return (
    <main
      data-trait={lesson.trait}
      className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-5"
    >
      {/*
       * The stage (round 2; Wellspoken 03-course's hero, Imprint's lesson
       * sheet, and the same stage R3 gives the trait page and the unit
       * intro). The tab bar is gone from this screen and Start is docked
       * at the foot, so the screen's free height goes HERE, never into a
       * band between the list and Start (principle 7): the trait's ground
       * runs from the top edge, under the back row, down to a shallow
       * arc of the page's ground rising into its foot, and the art stands
       * centred on it, as large as the room allows (120 to 176). On a
       * long lesson or a small phone it keeps its 204px and the page
       * scrolls under the shelf.
       *
       * The art stays a tile, never a full-bleed picture over the title
       * (#305): glossy art over a title is the shape of an ad, and a
       * first-time user read it exactly that way. The tone below the
       * stage is only the chip and the next square (wellspoken-course
       * s10).
       */}
      <div className="relative -mx-5 flex min-h-[204px] flex-1 flex-col px-5 pt-[env(safe-area-inset-top)]">
        {/* The ground, unclipped above the document's top so a pull past
            it shows more stage rather than a seam. Outside a trait it is
            the neutral surface. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 -top-96 bg-[var(--tone-stage,var(--color-surface))]"
        >
          <div className="absolute inset-x-0 -bottom-px h-6 rounded-[50%_50%_0_0/100%_100%_0_0] bg-ground" />
        </div>
        <BackLink
          href="/lessons"
          label="Lessons"
          className="relative z-[1] self-start"
        />
        <div className="relative min-h-0 flex-1">
          {/* A size container with a definite size (cq units read 0 in a
              container whose height comes from flex-grow), so the art can
              read the room's height. */}
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center pb-6 [container-type:size]"
          >
            <span className="lesson-art relative block aspect-square w-[clamp(120px,calc(100cqh-16px),176px)] shrink-0 overflow-hidden rounded-card bg-sand">
              {/* Soft 3D renders, square, cut to 360px; a plain img (#274). */}
              <img
                src={lesson.art}
                alt=""
                loading="eager"
                decoding="async"
                width={360}
                height={360}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </span>
          </div>
        </div>
      </div>
      <TraitChip trait={lesson.trait} size="md" className="mt-5 self-center" />
      <h1 className="font-display mt-3 text-center text-title">
        {lesson.title}
      </h1>

      {/*
       * Your number: where the trait this lesson works on stood on the
       * last recording. A number, never a description. Its height is held
       * while the log is in flight; with no reading the section is not
       * there at all, never a 0.
       */}
      {reading === undefined && !failed && (
        <div aria-hidden className="mt-7">
          <Skeleton className="h-[22.125px] w-28" rounded="rounded-none" />
          <Skeleton className="mt-3 h-[26.5px] w-56" rounded="rounded-none" />
        </div>
      )}
      {shown !== null && (
        <section className="arrive mt-7">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="detail-head">Your number</h2>
            <span className="text-caption text-stone-500">Last recording</span>
          </div>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-display text-num-m tabular-nums">
              {shown}
            </span>
            <span className="text-body text-stone-500">
              {shown === "1" ? trait.unitOne : trait.unit}
            </span>
          </p>
        </section>
      )}

      <p
        className={`${shown === null && (reading !== undefined || failed) ? "mt-7" : "mt-3"} text-read text-pretty text-stone-800`}
      >
        {lesson.blurb}
      </p>

      {/*
       * The three practices as a plain list: a numbered square that
       * turns sage with a check when it has a recording, the trait's
       * solid on the one the button starts, the prompt, and on the last
       * one what makes it harder. The squares are the progress (lessons-12).
       */}
      <h2 className="detail-head mt-7">The three practices</h2>
      <ol className="mt-3 flex flex-col gap-5">
        {lesson.practices.map((p, i) => {
          const n = i + 1;
          /* Unknown is neither done nor next: every square waits in the
             neutral surface until the log says which is which. */
          const did = known && n <= done;
          /* The one the button starts wears the trait's solid tone. */
          const here = known && !complete && n === next;
          const mod = p.mods?.[0] ? modById(p.mods[0]) : null;
          return (
            <li
              key={n}
              data-done={known ? did : undefined}
              className="flex gap-3.5"
            >
              <span
                aria-hidden
                className={`font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-row font-extrabold tabular-nums ${
                  did
                    ? "bg-sage-500 text-sage-ink"
                    : here
                      ? "tone-fill tone-on"
                      : "bg-surface text-stone-500"
                }`}
              >
                {did ? <IconCheck size={14} /> : n}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <span className="sr-only">
                  Practice {n}
                  {did ? ", done" : here ? ", next" : ""}.{" "}
                </span>
                <p
                  className={`text-read text-pretty ${did ? "text-stone-500" : "text-stone-800"}`}
                >
                  {p.prompt}
                </p>
                {/*
                 * The mod is named, never the tier. What makes the last
                 * one harder should be legible; which internal band a
                 * practice sits in should not be, and is not rendered
                 * anywhere in the app. A run-in label, so "No notes" is
                 * not read as a fragment of its own (lessons-11).
                 */}
                {mod && (
                  <p className="mt-1.5 text-caption text-stone-500">
                    <span className="font-semibold text-ink">{mod.name}:</span>{" "}
                    {mod.blurb}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/*
       * Bottom-anchored (lessons-7) in the flows' FooterShelf (round 2):
       * this screen hides the tab bar (Nav's DETAIL), so Start stands at
       * the foot over the home indicator like every flow's tap, and a
       * longer lesson scrolls under the shelf. No hairline: the ground
       * above it is open at rest, and Imprint's sheet cuts its list on
       * the ground the same way.
       */}
      <FooterShelf hairline={false}>
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
                ? "Start"
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
      </FooterShelf>
    </main>
  );
}
