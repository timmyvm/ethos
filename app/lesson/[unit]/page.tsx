"use client";

import Image from "next/image";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LessonScreen } from "@/components/LessonScreen";
import { backFrom } from "@/lib/back-from";
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
  // The lesson a door named (the Log's Go on a waiting row), when it is
  // one of this unit's.
  const asked = searchParams.get("lesson");
  /* Who opened it (D18): Today's Start, the Log's Go or You's trait
     sheet pass `?from=`; by URL alone it belongs to Lessons. */
  const parent = backFrom(searchParams.get("from"), "lessons");

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
    unit.lessons.find((l) => l.id === asked) ??
    unit.lessons.find((l) => (starMap[l.id] ?? 0) < 3) ??
    unit.lessons[0];
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
      /* R3 (principle 7): the unit's stage takes the free height and
         the mark stands on it, scaled to the room, so the slack goes
         into the stage instead of two bands round a small block. The
         head shares the mark's axis; the tiles under "How to do this"
         keep their left edge. */
      fill
      align="center"
      stepKey="intro"
      trait={trait}
      /* This route draws no tab bar (Nav's BARE list) and this is its
         only screen, so without a back control the teaching screen is
         a one-way door into a recording (#279). It replaces this entry
         with the tab that opened it (practice-detail-24), so the OS back
         gesture from that tab does not open it again, and names it. */
      onBack={() => router.replace(parent.href)}
      backLabel={parent.label}
      /* The unit's own name, as lib/path.ts writes it: a proper name,
         so its capitals stay. */
      eyebrow={unit.name}
      /* The tactics stay tiles (#212), but the name is the title
         (26/700, D09): at 17 under the stage it read as a label. */
      title={unit.intro.title}
      titleSize="title"
      line={unit.intro.line}
      howTo={unit.intro.howTo}
      lead="howTo"
      /* D53: the stage stops short of the free height so the title and
         the tips lead. 368, not the 280 the round set: a 180 mark on a
         280 stage leaves 125px and 121px of ground over and under the
         words at 390x844, and 368 is where every band comes out under
         64 (check-gaps: 56, 58, 61, 51, 57). */
      stageMax={368}
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
 * The unit's mark on its stage (M19, #248, R3): the Demos pose made for
 * this unit, standing on the stage LessonScreen draws in the trait's
 * tone, with a contact shadow, scaled to the room (128 at the least,
 * 180 at the most, D53: the stage is capped at 280, so the mark takes
 * most of its room; the cut is 256px, so it stays crisp at 2x up to
 * 128 and soft only by a hair at the top). next/image is safe here
 * because the service worker does not pre-cache /unit/. It arrives
 * once, with the screen, and then breathes.
 */
function UnitStage({ id }: { id: string }) {
  return (
    <div className="arrive relative size-[clamp(128px,calc(100cqh_-_112px),180px)]">
      {/* He breathes on DemosArt's own loop and his shadow with him
          (`.demos-breath`, `.ground-breath`; still under reduced
          motion): the unit marks have no idle clip yet (#316). */}
      <div aria-hidden className="demos-ground">
        <span className="ground-breath" />
      </div>
      <Image
        src={`/unit/${id}.webp`}
        alt=""
        width={256}
        height={256}
        priority
        className="demos demos-breath pointer-events-none relative mx-auto size-full"
      />
    </div>
  );
}
