"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LessonScreen } from "@/components/LessonScreen";
import { markWelcomed, WELCOME_STEPS } from "@/lib/onboarding";
import { nextLesson } from "@/lib/path";
import { repHref } from "@/lib/rep-config";

/**
 * Where "Take the floor" lands. Bare /rep serves the daily ROTATION —
 * whatever drill today's date rotates to — but a first recording has to
 * be the path's first lesson, "The baseline" (DECISIONS #135): the
 * introduction just promised a baseline, so the button delivers one.
 * An empty star map resolves to the first lesson of the first unit.
 */
const FIRST_REP = repHref({ lesson: nextLesson({})?.lesson.id });

/**
 * Onboarding — three screens, no quiz, no account. Wellspoken's
 * quiz-wall is a documented resentment point (DECISIONS #11), so this
 * exists only to say the thing honestly and hand over the mic. The
 * copy is WELCOME_STEPS (lib/onboarding), docs/voice.md verbatim.
 */
export default function Welcome() {
  const [i, setI] = useState(0);
  const step = WELCOME_STEPS[i];
  const last = i === WELCOME_STEPS.length - 1;

  // Seen once is seen — set on mount so neither finishing nor skipping
  // is needed to stop the floor routing back here (DECISIONS #133).
  useEffect(() => {
    markWelcomed();
  }, []);

  return (
    <LessonScreen
      center
      title={step.title}
      line={step.line}
      action={
        last
          ? { label: "Take the floor", href: FIRST_REP }
          : { label: "Next", onPress: () => setI(i + 1) }
      }
      art={
        <Image
          src={step.art}
          alt=""
          width={180}
          height={180}
          priority
          className="mx-auto mb-6 w-[180px]"
        />
      }
      aside={
        <div className="flex gap-1.5">
          {WELCOME_STEPS.map((_, n) => (
            <span
              key={n}
              className={`h-1.5 ${
                n === i ? "w-6 bg-terracotta-500" : "w-1.5 bg-stone-300"
              }`}
            />
          ))}
        </div>
      }
      footer={
        /*
         * Screen 1 carries the returning-user door (Duolingo's splash
         * pattern, DECISIONS #133): a new device belonging to an
         * existing account should sign in BEFORE recording anonymously,
         * because recordings made first would strand on this device.
         * Later screens keep Skip.
         */
        i === 0 ? (
          <Link
            href="/signin"
            className="mt-3 block text-center text-caption text-stone-500"
          >
            I already have an account
          </Link>
        ) : (
          <Link
            href="/"
            className="mt-3 block text-center text-caption text-stone-500"
          >
            Skip
          </Link>
        )
      }
    />
  );
}
