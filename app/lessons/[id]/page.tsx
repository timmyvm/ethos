"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { lessonById } from "@/content/lessons";
import { TRAIT } from "@/content/traits";
import { fetchReps } from "@/lib/client-data";
import { lessonProgress, nextPractice } from "@/lib/lesson-progress";
import { repHref } from "@/lib/rep-config";
import { modById } from "@/lib/stress-mods";
import { ACTION_CLASS } from "@/lib/ui";

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
  const [done, setDone] = useState(0);

  useEffect(() => {
    fetchReps(200)
      .then((reps) => setDone(lessonProgress(reps)[id] ?? 0))
      .catch(() => {});
  }, [id]);

  if (!lesson) notFound();

  const total = lesson.practices.length;
  const next = nextPractice(lesson, done);
  const complete = done >= total;

  return (
    <main className="mx-auto max-w-[430px] pb-28">
      <div className="relative aspect-[3/2] w-full bg-sand">
        <Image
          src={lesson.art}
          alt=""
          fill
          priority
          sizes="(max-width: 430px) 100vw, 430px"
          className="object-cover"
        />
      </div>

      <div className="px-5 pt-5">
        <Link
          href="/lessons"
          className="press -ml-1 inline-flex min-h-11 items-center px-1 text-sm text-stone-500"
        >
          ← Lessons
        </Link>

        <div className="label-data mt-1">{TRAIT[lesson.trait].name}</div>
        <h1 className="font-display mt-1.5 text-title leading-tight">
          {lesson.title}
        </h1>
        <p className="mt-2 text-body leading-relaxed text-stone-500">
          {lesson.blurb}
        </p>

        <ol className="mt-6 space-y-2.5">
          {lesson.practices.map((p, i) => {
            const n = i + 1;
            const did = n <= done;
            const mod = p.mods?.[0] ? modById(p.mods[0]) : null;
            return (
              <li
                key={n}
                className={`elev-1 rounded-card border border-card-edge bg-raised p-4 ${
                  did ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="label-micro text-stone-400">
                    Practice {n}
                  </span>
                  {did && <span className="label-micro text-sage-700">Done</span>}
                </div>
                <p className="mt-1.5 text-body leading-snug">{p.prompt}</p>
                {/*
                 * The mod is named, never the tier. What makes the last
                 * one harder should be legible; which internal band a
                 * practice sits in should not be, and is not rendered
                 * anywhere in the app.
                 */}
                {mod && (
                  <p className="mt-2 text-caption text-terracotta-700">
                    {mod.name}. {mod.blurb}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="px-5 pt-6">
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
        <p className="mt-2.5 text-center text-caption text-stone-400">
          {complete
            ? "All three done. Another run still counts."
            : `${done} of ${total} done.`}
        </p>
      </div>
    </main>
  );
}
