"use client";

import { notFound, useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LessonScreen } from "@/components/LessonScreen";
import { fetchReps } from "@/lib/client-data";
import { starsByLesson, unitById } from "@/lib/path";
import { repHref } from "@/lib/rep-config";

/**
 * The unit's teaching screen (DECISIONS #210).
 *
 * Shown on the way into a unit nobody has scored in yet, and never
 * again — Duolingo's unit header, which appears when the unit opens
 * rather than in front of every lesson. The technique is a screen; the
 * lesson is the doing.
 *
 * Copy is docs/voice.md Part 3, verbatim, and lives on the unit
 * (lib/path.ts). A unit without approved copy has no route here: the
 * floor links straight to its first lesson instead of showing a screen
 * somebody would have had to write in a hurry.
 */
export default function LessonIntroPage() {
  return (
    <Suspense fallback={<main className="px-5 pt-7" />}>
      <LessonIntro />
    </Suspense>
  );
}

function LessonIntro() {
  const params = useParams<{ unit: string }>();
  const searchParams = useSearchParams();
  const unit = unitById(params.unit);
  const mods = searchParams.get("mods");

  /*
   * Which lesson [Start] opens: the first in this unit still short of
   * three stars. Until the history lands it is the unit's first lesson,
   * which is the right answer for everyone this screen is shown to (a
   * unit with stars in it doesn't get this screen) and a harmless one
   * for anybody who arrives by URL.
   */
  const [starMap, setStarMap] = useState<Record<string, number>>({});
  useEffect(() => {
    fetchReps()
      .then((rows) => setStarMap(starsByLesson(rows)))
      .catch(() => {});
  }, []);

  if (!unit?.intro) notFound();

  const lesson =
    unit.lessons.find((l) => (starMap[l.id] ?? 0) < 3) ?? unit.lessons[0];

  return (
    <LessonScreen
      eyebrow={unit.name}
      title={unit.intro.title}
      line={unit.intro.line}
      howTo={unit.intro.howTo}
      lead="howTo"
      action={{
        label: "Start",
        href: repHref({
          lesson: lesson.id,
          mods: mods ? mods.split(",") : undefined,
        }),
      }}
    />
  );
}
