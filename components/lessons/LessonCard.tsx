"use client";

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
 *
 * TWO UP, and that is a choosing decision rather than a density one
 * (#274). Full width, each card was most of a screen and the fifteen
 * ran to eleven thousand pixels: nothing could be compared with
 * anything, and a commissioned set that is never seen together is
 * fifteen unrelated pictures. Side by side the set reads as a set.
 *
 * The blurb went with the width. The trait's own line already sits
 * above the grid and says what all three cards under it are for, so a
 * per-card blurb at this size was the section header said three more
 * times in smaller type.
 *
 * `lead` is the first lesson of a trait and it takes the full row. Three
 * cards in a two-column grid orphan the third, and that hole repeated
 * five times down the page read as something failing to load rather
 * than as a grid. It also happens to be true: within a trait the
 * lessons are ordered, and the first one is where you start.
 */
export function LessonCard({
  lesson,
  done,
  lead = false,
}: {
  lesson: Lesson;
  /** How many of its practices have a recording against them. */
  done: number;
  /** The trait's first lesson, which takes the whole row. */
  lead?: boolean;
}) {
  const total = lesson.practices.length;
  const complete = done >= total;

  return (
    <Link
      href={`/lessons/${lesson.id}`}
      className={`press elev-1 flex flex-col overflow-hidden rounded-card border border-card-edge bg-raised ${
        lead ? "col-span-2" : ""
      }`}
    >
      <div
        className={`relative w-full bg-sand ${lead ? "aspect-[2/1]" : "aspect-[4/3]"}`}
      >
        {/*
         * A plain <img>, not next/image, and that is about the offline
         * shell rather than about taste. The service worker pre-caches
         * /lessons/*.webp; next/image asks for /_next/image?url=… at a
         * width it picks per device, which is never the URL in the
         * shell — so the PWA would hold fifteen files the page never
         * requests and show fifteen holes offline. The art is already
         * cut to 900×585 and about 130KB by scripts/cut-lesson-art.mjs,
         * so there is nothing for the optimiser to do anyway.
         */}
        <img
          src={lesson.art}
          alt=""
          loading="lazy"
          decoding="async"
          width={900}
          height={585}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      {/*
       * The trait is NOT repeated here. The cards are grouped under a
       * trait heading, so printing it again on every card said
       * "PAUSING" twice within 80px of itself.
       *
       * Progress as a count and not a ring: the rings on Today are
       * measurements of speech, this is how much of a lesson is left,
       * and the two should not share a grammar (docs/closure.md, two
       * channels never merged).
       */}
      <div className="flex flex-1 flex-col justify-between gap-1.5 p-3">
        <h3
          className={`font-display font-bold leading-snug ${lead ? "text-[17px]" : "text-[15px]"}`}
        >
          {lesson.title}
        </h3>
        <span
          className={`label-micro ${complete ? "text-sage-700" : "text-stone-400"}`}
        >
          {complete ? "Done" : `${done} of ${total}`}
        </span>
      </div>
    </Link>
  );
}
