"use client";

import Image from "next/image";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LessonScreen } from "@/components/LessonScreen";
import { fetchReps } from "@/lib/client-data";
import { recordingTrait } from "@/lib/log";
import { starsByLesson, unitById } from "@/lib/path";
import { repHref } from "@/lib/rep-config";

/**
 * The unit's teaching screen (DECISIONS #210).
 *
 * Shown on the way into a unit nobody has scored in yet, and never
 * again: Duolingo's unit header, which appears when the unit opens
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
  const router = useRouter();
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
  /*
   * The trait this unit works on, read the way the log reads a
   * recording's: Filler Elimination, Pace Control and The Pause name
   * one, and the rest do not, so their stage stays the neutral surface
   * rather than wearing a tone nobody chose for them.
   */
  const trait = recordingTrait({ lesson_id: unit.lessons[0]?.id ?? null }) ?? undefined;

  return (
    /* The eyebrow takes the trait's ink where the unit has a trait, as
       on the trait's own page: LessonScreen tones it from `trait`. */
    <LessonScreen
      /* practice-detail-8, M19: one centred column in the height above
         Start, so the slack splits above and below instead of pooling
         in one band over the button. The head shares the mark's axis;
         the tiles under "How to do this" keep their left edge. */
      center
      align="center"
      stepKey="intro"
      trait={trait}
      /* This route draws no tab bar (Nav's BARE list) and this is its
         only screen, so without a back control the teaching screen is
         a one-way door into a recording (#279). It replaces this entry
         with Today (practice-detail-24), so the OS back gesture from
         Today does not open it again. */
      onBack={() => router.replace("/")}
      /* The unit's own name, as lib/path.ts writes it: a proper name,
         so its capitals stay. */
      eyebrow={unit.name}
      /* #212 (Timothy): the tactics lead, so the title rises only to
         the detail step (17/700) that `lead="howTo"` gives it. */
      title={unit.intro.title}
      line={unit.intro.line}
      howTo={unit.intro.howTo}
      lead="howTo"
      art={<UnitStage id={unit.id} />}
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

/**
 * The unit's mark on its stage (M19, #248): the Demos pose made for this
 * unit, standing on the trait's dome with a contact shadow, the lesson
 * page's grammar (M06) so the three one-step-in screens read as one
 * family. 128px from a 256px cut, so it stays crisp at 2x; next/image is
 * safe here because the service worker does not pre-cache /unit/. It
 * arrives once, with the screen, and then breathes.
 */
function UnitStage({ id }: { id: string }) {
  return (
    <div className="relative -mx-5 mb-4 flex justify-center pb-[22px]">
      <div aria-hidden className="stage-dome absolute inset-x-0 bottom-0" />
      <div className="arrive relative h-32 w-32">
        {/* He breathes on DemosArt's own loop and his shadow with him
            (`.demos-breath`, `.ground-breath`; still under reduced
            motion): the unit marks have no idle clip yet (#316). */}
        <div aria-hidden className="demos-ground">
          <span className="ground-breath" />
        </div>
        <Image
          src={`/unit/${id}.webp`}
          alt=""
          width={128}
          height={128}
          priority
          className="demos demos-breath pointer-events-none relative mx-auto h-32 w-32"
        />
      </div>
    </div>
  );
}
