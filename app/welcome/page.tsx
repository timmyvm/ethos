"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

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
    title: "Silence is scored in your favour.",
    body: "Pauses you hold before a sentence read as composure. Nobody else measures that. It's the whole point.",
  },
];

export default function Welcome() {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

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
          href="/rep"
          className="block w-full rounded-[14px] bg-terracotta-500 px-6 py-4 text-center text-base font-semibold text-cream"
        >
          Take the floor
        </Link>
      ) : (
        <button
          onClick={() => setI(i + 1)}
          className="w-full rounded-[14px] bg-terracotta-500 px-6 py-4 text-base font-semibold text-cream"
        >
          Next
        </button>
      )}

      <Link
        href="/"
        className="mt-3 block text-center text-[13px] text-stone-500"
      >
        Skip
      </Link>
    </main>
  );
}
