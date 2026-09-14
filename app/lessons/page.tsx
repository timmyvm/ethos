"use client";

import { useEffect, useState } from "react";
import { PathRoad } from "@/components/PathRoad";
import { fetchReps } from "@/lib/client-data";
import { readOnboarding, EMPTY_ANSWERS, type Answers } from "@/lib/answers";
import { buildPortfolio } from "@/lib/portfolio";
import { starsByLesson } from "@/lib/path";

/**
 * Lessons (DECISIONS #141, #267, #269).
 *
 * It used to live under the floor card on Today and it was the same
 * road for everybody: units in an order chosen once, gated on stars.
 * The shift put the five traits there instead, because the only honest
 * reason a lesson is in front of you is that its number is yours.
 *
 * The road is not gone, it is a DOOR rather than furniture. Somebody
 * who wants to pick a lesson by name gets a page that is nothing but
 * that, linked from the bottom of the trait strip. This route already
 * existed as a redirect to Today, so old bookmarks and the service
 * worker's cached links land on the thing they were pointing at.
 */
export default function LessonsPage() {
  const [starMap, setStarMap] = useState<Record<string, number> | null>(null);
  const [hasAny, setHasAny] = useState(false);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);

  useEffect(() => {
    setAnswers(readOnboarding().answers);
    fetchReps(200)
      .then((reps) => {
        setStarMap(starsByLesson(reps));
        setHasAny(reps.length > 0);
      })
      .catch(() => setStarMap({}));
  }, []);

  return (
    <main className="mx-auto max-w-[430px] px-5 pb-24 pt-8">
      <h1 className="label-data">Every lesson</h1>
      <p className="mt-1.5 text-body text-stone-500">
        Today picks one from your numbers. This is the whole set.
      </p>
      {starMap !== null && (
        <PathRoad
          starMap={starMap}
          hasAnyRep={hasAny}
          focus={buildPortfolio(answers).focus}
        />
      )}
    </main>
  );
}
