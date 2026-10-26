"use client";

import { Disclosure } from "@/components/ui/Disclosure";
import { HeroStage, StageChip } from "@/components/ui/HeroStage";
import { SegmentBar } from "@/components/ui/SegmentBar";
import Link from "next/link";
import type { Lesson } from "@/content/lessons";
import { nextPractice } from "@/lib/lesson-progress";
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
 * beside the text, the text says where you are in it (three practices,
 * as one bar of three segments that fill in sage), and the row ends in
 * the same Disclosure every row-shaped door in the app ends in. A
 * lesson never carries the Premium chip.
 *
 * QUIETER (the cohesion pass, 26 Oct). A first-time tester in dark:
 * "the colors are too bright", "lessons look really weird". Fifteen
 * glossy renders at 56px in saturated blue, pink, orange, green and
 * violet, under heads in those tones, were the loudest page in the app.
 * The renders stay (they are the set) and come down: 44px, desaturated
 * to a third (`.lesson-art-quiet`), the heads in ink with the trait's
 * 8px mark, the bars in stone. The page's colour is its one hero.
 */

/**
 * A plain <img>, not next/image, and that is about the offline shell
 * rather than about taste. The service worker pre-caches
 * /lessons/*.webp; next/image asks for /_next/image?url=… at a width it
 * picks per device, which is never the URL in the shell, so the PWA
 * would hold fifteen files the page never requests and show fifteen
 * holes offline. The art is already cut to 360px square and a few KB by
 * scripts/cut-lesson-art.mjs, so there is nothing for the optimiser to
 * do anyway.
 */
export function LessonArt({
  lesson,
  size,
  eager = false,
  radius = "rounded-control",
  className = "",
  quiet = false,
  stage = false,
}: {
  lesson: Lesson;
  size: number;
  eager?: boolean;
  /** A thumbnail is a control's 12; the lesson page's 120 stands at the card's 16. */
  radius?: "rounded-control" | "rounded-card";
  className?: string;
  /** In a list: desaturated to a third (`.lesson-art-quiet`). */
  quiet?: boolean;
  /** On the hero stage: no sand behind it (HeroStage's `artBlend` lays
      its light over the sky). */
  stage?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`lesson-art relative block shrink-0 overflow-hidden ${stage ? "" : "bg-sand"} ${
        quiet ? "lesson-art-quiet" : ""
      } ${radius} ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Soft 3D renders since #319, square, cut to 360px. */}
      <img
        src={lesson.art}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        width={360}
        height={360}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </span>
  );
}

/**
 * The count beside the bar, printed only when it is news (M10): nothing
 * before you start (three empty segments already say three), "1 of 3"
 * during, "Done" after. It used to print "3 PRACTICES" in tracked caps
 * on all sixteen bars, the same words sixteen times (lessons-1).
 */
export function progressLabel(done: number, total: number): string | null {
  if (done >= total) return "Done";
  if (done <= 0) return null;
  return `${done} of ${total}`;
}

/**
 * The bar and its label, one line. `cue` takes the label slot on the
 * row Up next points at ("Up next", "Carry on"), in the trait's ink, so
 * the row says it is the lesson on the card above (lessons-19). The slot
 * keeps its width when it is empty, so every bar in a list ends at the
 * same x whether or not its count is news (52px holds "Carry on").
 */
function Progress({
  done,
  total,
  cue,
  className = "",
}: {
  done: number;
  total: number;
  cue?: string | null;
  className?: string;
}) {
  const label = progressLabel(done, total);
  return (
    <span className={`flex h-4.5 items-center gap-2.5 ${className}`}>
      <SegmentBar total={total} done={done} tone="neutral" className="min-w-0 flex-1" />
      <span className="w-13 shrink-0">
        {cue ? (
          <span
            data-progress-label
            className="whitespace-nowrap text-caption font-semibold text-ink"
          >
            {cue}
          </span>
        ) : (
          label && (
            <span
              data-progress-label
              className={`whitespace-nowrap text-link tabular-nums ${
                done >= total ? "font-semibold text-ink" : "font-medium text-stone-500"
              }`}
            >
              {label}
            </span>
          )
        )}
      </span>
    </span>
  );
}

/**
 * The inset rule between rows: a hairline from the title's edge (20 gutter
 * + 44 art + 14 gap = 78px) to the row's end, the `.inset-group` icon-inset
 * grammar on the open ground. None above a section's first row.
 */
const RULE =
  "before:absolute before:left-[78px] before:right-0 before:top-0 before:h-px before:origin-top before:scale-y-50 before:bg-hairline";

export function LessonRow({
  lesson,
  done,
  pending = true,
  first = false,
  eager = false,
  cue = null,
}: {
  lesson: Lesson;
  /**
   * How many of its practices have a recording against them, or null
   * while that is unknown: the log is in flight, or it failed. Unknown
   * draws no bar and no label, because three empty segments are a
   * claim (you have not started) that a failed read cannot make.
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
  /** Above the fold: load the thumbnail at once (lessons-21). */
  eager?: boolean;
  /** "Up next" or "Carry on" on the row the Up next card points at. */
  cue?: string | null;
}) {
  const total = lesson.practices.length;
  const known = done !== null;
  /*
   * Flush to the gutter (-mx-5 px-5), so the press lights the whole width
   * the way an iOS list row does, and never scales: a row that shrinks
   * pulls away from the rows beside it (`.press-row`, lessons-4). The
   * focus ring is drawn inside, because outside it would sit on the
   * screen's edge (lessons-5).
   */
  return (
    <Link
      href={`/lessons/${lesson.id}`}
      data-lesson={lesson.id}
      className={`press-row relative -mx-5 flex items-center gap-3.5 px-5 py-3 focus-visible:-outline-offset-3! ${
        first ? "" : RULE
      }`}
    >
      <LessonArt lesson={lesson} size={44} eager={eager} quiet />
      <span className="min-w-0 flex-1">
        <span className="font-display block text-row">{lesson.title}</span>
        {(known || pending) && (
          <span
            data-progress={known ? done : "unknown"}
            className={`mt-2 block ${known ? "" : "invisible"}`}
          >
            <Progress done={done ?? 0} total={total} cue={known ? cue : null} />
          </span>
        )}
      </span>
      <Disclosure />
    </Link>
  );
}

/**
 * The page's hero and its one tap (the cohesion pass, 26 Oct): the lesson
 * that is yours next, on the house stage (`HeroStage`), with the tap on
 * the ground under it, as on Practice and Today. It was a lifted card
 * with a 64px render and a terracotta chevron square (M03, Imprint's
 * "continue" card); a first-time tester read the page's colours as "too
 * bright" and the tabs as not matching, and the stage is what matches.
 *
 * The eyebrow is the trait on its stage chip, then "Up next"; the title
 * is the lesson; the line is its three practices as the stage's
 * segments; the art is the lesson's own render, its light laid over the
 * sky (`stage`). The tap says what it does: "Carry on" part way in,
 * "Start" before. One tap from the tab to recording is what "you just
 * start it" looks like.
 */
export function UpNextCard({ lesson, done }: { lesson: Lesson; done: number }) {
  const total = lesson.practices.length;
  const next = nextPractice(lesson, done);
  const label = progressLabel(done, total);
  const verb = done > 0 ? "Carry on" : "Start";
  return (
    <div className="arrive">
      {/* No `data-trait` on the stage itself: the trait's `--tone` would
          repaint the sky in the trait's colour. The chip carries it. */}
      <HeroStage
        eyebrow={
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <StageChip trait={lesson.trait} />
            <span className="eyebrow stage-ink">Up next</span>
          </span>
        }
        eyebrowWide
        title={lesson.title}
        artSize={112}
        artBlend
        art={
          <span className="flex h-full w-full items-end justify-end pb-3 pr-3">
            <LessonArt lesson={lesson} size={92} eager stage radius="rounded-card" />
          </span>
        }
        line={
          <span className="mt-auto flex items-center gap-2.5 pt-3">
            <span className="w-24 shrink-0">
              <SegmentBar total={total} done={done} tone="stage" />
            </span>
            {label && (
              <span className="stage-ink font-display whitespace-nowrap text-link font-bold tabular-nums">
                {label}
              </span>
            )}
          </span>
        }
      />
      <Link
        href={repHref({
          lesson: lesson.id,
          q: String(next),
          back: `/lessons/${lesson.id}`,
        })}
        data-up-next={lesson.id}
        aria-label={`${verb} ${lesson.title}, practice ${next} of ${total}`}
        className={`${ACTION_CLASS} mt-3`}
      >
        {verb}
      </Link>
    </div>
  );
}
