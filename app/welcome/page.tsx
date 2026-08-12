"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { markWelcomed } from "@/lib/onboarding";
import { nextLesson } from "@/lib/path";
import { repHref } from "@/lib/rep-config";

/**
 * Where "Take the floor" lands. Bare /rep serves the daily ROTATION —
 * whatever drill today's date rotates to — but a first rep has to be
 * the path's first lesson, "The baseline rep" (DECISIONS #135): the
 * introduction just promised a baseline, so the button delivers one.
 * An empty star map resolves to the first lesson of the first unit.
 */
const FIRST_REP = repHref({ lesson: nextLesson({})?.lesson.id });

/**
 * Onboarding — three screens, no quiz, no account. Wellspoken's
 * quiz-wall is a documented resentment point (DECISIONS #11), so this
 * exists only to name the felt problem honestly and hand over the mic.
 * Symptom-first copy per mechanics.md, inside vision.md's
 * no-manufactured-insecurity rule: we name what the user already
 * knows, we never tell them they're inadequate.
 */
const STEPS = [
  {
    art: "/demos-listening.webp",
    title: "You already know the gap.",
    body: "The sentence that came out fuzzy. The point you had and lost. You don't need convincing — you need reps.",
  },
  {
    art: "/demos-speaking.webp",
    title: "Sixty seconds a day.",
    body: "One prompt, one recording. The engine counts every filler, times every pause, and hands back real numbers — never vibes.",
  },
  {
    art: "/demos-celebrate.webp",
    // §8's hero line. It translates the name: ethos in Aristotle is
    // credibility earned through character, not claimed.
    title: "Earn the room.",
    body: "Silence is scored in your favour here — pauses you hold before a sentence read as composure. Nobody else measures that. It's the whole point.",
  },
];

export default function Welcome() {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  // Seen once is seen — set on mount so neither finishing nor skipping
  // is needed to stop the floor routing back here (DECISIONS #133).
  useEffect(() => {
    markWelcomed();
  }, []);

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-10 pt-7">
      <div className="font-display text-[22px] font-bold">ethos</div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Image
          src={step.art}
          alt=""
          width={180}
          height={180}
          priority
          className="w-[180px]"
        />
        <h1 className="font-display mt-6 text-[26px] font-bold leading-tight">
          {step.title}
        </h1>
        <p className="mt-3 max-w-[300px] text-[15px] leading-relaxed text-stone-500">
          {step.body}
        </p>
      </div>

      <div className="mb-5 flex justify-center gap-1.5">
        {STEPS.map((_, n) => (
          <span
            key={n}
            className={`h-1.5 rounded-full transition-all ${
              n === i ? "w-6 bg-terracotta-500" : "w-1.5 bg-stone-300"
            }`}
          />
        ))}
      </div>

      {last ? (
        <Link
          href={FIRST_REP}
          className="block w-full rounded-[14px] bg-terracotta-500 px-6 py-4 text-center text-base font-semibold text-cream press"
        >
          Take the floor
        </Link>
      ) : (
        <button
          onClick={() => setI(i + 1)}
          className="w-full rounded-[14px] bg-terracotta-500 px-6 py-4 text-base font-semibold text-cream press"
        >
          Next
        </button>
      )}

      {/*
       * Screen 1 carries the returning-user door (Duolingo's splash
       * pattern, DECISIONS #133): a new device belonging to an existing
       * account should sign in BEFORE recording anonymously — reps made
       * first would strand on this device, and /signin warning about it
       * later is worse than a door here. Later screens keep Skip.
       */}
      {i === 0 ? (
        <Link
          href="/signin"
          className="mt-3 block text-center text-[13px] text-stone-500"
        >
          I already have an account
        </Link>
      ) : (
        <Link
          href="/"
          className="mt-3 block text-center text-[13px] text-stone-500"
        >
          Skip
        </Link>
      )}
    </main>
  );
}
