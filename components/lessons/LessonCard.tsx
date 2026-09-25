"use client";

import Link from "next/link";
import type { Lesson } from "@/content/lessons";
import { TRAIT } from "@/content/traits";
import { repHref } from "@/lib/rep-config";
import { ACTION_CLASS } from "@/lib/ui";

/**
 * A lesson, as a row you move through rather than a tile you buy.
 *
 * Until the feedback round after #296 every lesson was a card made of
 * its picture: full-bleed art over a bold title, two up, the trait's
 * first one a full-width 2:1 banner. A first-time user in the audience
 * read it as ads and asked whether she had to pay for them. She was
 * right about the shape: glossy art over a title, with nothing saying
 * what doing it involves or where you are in it, is a course store.
 *
 * So the art keeps its place and loses the lead. It is a thumbnail
 * beside the text, the text says what it is (three practices, as three
 * segments that fill in sage), and the row ends in the same arrow every
 * free door in the app ends in. The Practice tab puts the Premium chip
 * before that arrow where a tap leads to paying; a lesson never has one.
 */

/**
 * A plain <img>, not next/image, and that is about the offline shell
 * rather than about taste. The service worker pre-caches
 * /lessons/*.webp; next/image asks for /_next/image?url=… at a width it
 * picks per device, which is never the URL in the shell, so the PWA
 * would hold fifteen files the page never requests and show fifteen
 * holes offline. The art is already cut to 900×585 and about 130KB by
 * scripts/cut-lesson-art.mjs, so there is nothing for the optimiser to
 * do anyway.
 */
export function LessonArt({
  lesson,
  size,
  eager = false,
}: {
  lesson: Lesson;
  size: number;
  eager?: boolean;
}) {
  return (
    <span
      aria-hidden
      className="lesson-art relative block shrink-0 overflow-hidden rounded-control bg-sand"
      style={{ width: size, height: size }}
    >
      <img
        src={lesson.art}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        width={900}
        height={585}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </span>
  );
}

/**
 * The three practices as three segments. Square, like every bar in the
 * app (STATE.md), and sage when done because a practice recorded is a
 * thing worked for. The segments shrink before the label beside them
 * wraps (`.lesson-pip`), so at 320px "3 practices" stays one line.
 */
export function Pips({ done, total }: { done: number; total: number }) {
  return (
    <span className="flex min-w-0 shrink items-center gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="lesson-pip" data-done={i < done} />
      ))}
    </span>
  );
}

/** "3 practices" before you start, "1 of 3" during, "Done" after. */
export function progressLabel(done: number, total: number): string {
  if (done >= total) return "Done";
  if (done === 0) return `${total} practices`;
  return `${done} of ${total}`;
}

export function LessonRow({
  lesson,
  done,
  pending = true,
  first = false,
}: {
  lesson: Lesson;
  /**
   * How many of its practices have a recording against them, or null
   * while that is unknown: the log is in flight, or it failed. Unknown
   * draws no pips and no label, because "3 practices" and three empty
   * segments are a claim (you have not started) that a failed read
   * cannot make.
   */
  done: number | null;
  /**
   * Whether an unknown count is still coming. While it is, the empty
   * line keeps its height so nothing moves when the log lands; after a
   * failed read nothing is coming, the line goes, and the title centres
   * on its picture.
   */
  pending?: boolean;
  first?: boolean;
}) {
  const total = lesson.practices.length;
  const known = done !== null;
  const complete = known && done >= total;
  return (
    <Link
      href={`/lessons/${lesson.id}`}
      data-lesson={lesson.id}
      className={`press flex items-center gap-3.5 px-4 py-3 ${
        first ? "" : "border-t border-hairline"
      }`}
    >
      <LessonArt lesson={lesson} size={56} />
      <span className="min-w-0 flex-1">
        <span className="font-display block text-[15px] font-bold leading-snug">
          {lesson.title}
        </span>
        {(known || pending) && (
          <span
            data-progress={known ? done : "unknown"}
            className={`mt-1.5 flex items-center gap-2.5 ${known ? "" : "invisible"}`}
          >
            <Pips done={done ?? 0} total={total} />
            <span
              className={`label-micro whitespace-nowrap ${complete ? "text-sage-700" : "text-stone-400"}`}
            >
              {progressLabel(done ?? 0, total)}
            </span>
          </span>
        )}
      </span>
      <span aria-hidden className="shrink-0 text-stone-400">
        →
      </span>
    </Link>
  );
}

/**
 * The one tap on the page: the lesson that is yours next, on its
 * trait's own ground, with a button that goes straight into the next
 * practice. One tap from the tab to recording is what "you just start
 * it" looks like.
 */
export function UpNextCard({ lesson, done }: { lesson: Lesson; done: number }) {
  const total = lesson.practices.length;
  const next = Math.min(done + 1, total);
  return (
    <section
      data-trait={lesson.trait}
      data-up-next={lesson.id}
      className="arrive elev-2 overflow-hidden rounded-card border border-card-edge bg-raised"
    >
      <Link
        href={`/lessons/${lesson.id}`}
        className="press tone-wash flex items-center gap-4 p-4"
      >
        <LessonArt lesson={lesson} size={84} eager />
        <span className="min-w-0 flex-1">
          <span className="label-micro tone-ink block whitespace-nowrap">
            {done > 0 ? "Carry on" : "Up next"} · {TRAIT[lesson.trait].name}
          </span>
          <span className="font-display mt-1 block text-[19px] font-bold leading-tight">
            {lesson.title}
          </span>
          <span className="mt-2 flex items-center gap-2.5">
            <Pips done={done} total={total} />
            <span className="label-micro tone-ink whitespace-nowrap">
              {progressLabel(done, total)}
            </span>
          </span>
        </span>
      </Link>
      <div className="p-4">
        <Link
          href={repHref({
            lesson: lesson.id,
            q: String(next),
            back: `/lessons/${lesson.id}`,
          })}
          className={ACTION_CLASS}
        >
          {done === 0 ? "Start" : `Practice ${next} of ${total}`}
        </Link>
      </div>
    </section>
  );
}
