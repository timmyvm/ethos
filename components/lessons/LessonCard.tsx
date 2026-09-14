"use client";

import Image from "next/image";
import Link from "next/link";
import type { Lesson } from "@/content/lessons";

/**
 * One lesson, one card, its own picture (DECISIONS #269).
 *
 * The road this replaces was a list of rows under hairlines: every
 * lesson looked like every other lesson, and the only thing separating
 * them was a title and a star count. A lesson is a thing somebody
 * chooses, so it gets a face.
 *
 * The art BLEEDS to the card's edge rather than sitting framed inside
 * it, and the type sits under it on the card's own surface. A picture
 * with a margin around it reads as an attachment; a picture that meets
 * the radius reads as the card being made of it.
 */
export function LessonCard({
  lesson,
  done,
}: {
  lesson: Lesson;
  /** How many of its practices have a recording against them. */
  done: number;
}) {
  const total = lesson.practices.length;
  const complete = done >= total;

  return (
    <Link
      href={`/lessons/${lesson.id}`}
      className="press elev-1 block overflow-hidden rounded-card border border-card-edge bg-raised"
    >
      <div className="relative aspect-[3/2] w-full bg-sand">
        <Image
          src={lesson.art}
          alt=""
          fill
          sizes="(max-width: 430px) 100vw, 390px"
          className="object-cover"
        />
      </div>

      <div className="p-4">
        {/*
         * The trait is NOT repeated here. The cards are grouped under a
         * trait heading, so printing it again on every card said
         * "PAUSING" twice within 80px of itself. The count keeps the
         * row instead.
         *
         * Progress as a count and not a ring: the rings on Today are
         * measurements of speech, this is how much of a lesson is left,
         * and the two should not share a grammar (docs/closure.md, two
         * channels never merged).
         */}
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display min-w-0 text-[17px] font-bold leading-snug">
            {lesson.title}
          </h3>
          <span
            className={`label-micro shrink-0 ${complete ? "text-sage-700" : "text-stone-400"}`}
          >
            {complete ? "Done" : `${done} of ${total}`}
          </span>
        </div>
        <p className="mt-1 text-caption leading-relaxed text-stone-500">
          {lesson.blurb}
        </p>
      </div>
    </Link>
  );
}
