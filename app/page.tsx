"use client";

import Image from "next/image";
import Link from "next/link";
import { todaysDrill } from "@/lib/drills";

// "The Floor" (DECISIONS.md #9) — one dominant rep card.
// Step-2 scope: one drill per day. Path, streaks, and shop come later.
// Client component so "today" is the user's day, not the server's.
export default function Home() {
  const drill = todaysDrill();

  return (
    <main className="px-5 pt-7">
      <div className="font-display text-[22px] font-bold">ethos</div>

      <div className="label-data mt-8">Today&apos;s rep · {drill.unit}</div>
      <div className="relative mt-2.5 overflow-hidden rounded-[18px] border border-black/5 bg-white p-5 pb-16">
        <h1 className="font-display max-w-[78%] text-[22px] font-bold leading-tight">
          {drill.title}
        </h1>
        <p className="mt-2.5 max-w-[72%] text-[14.5px] leading-relaxed text-stone-500">
          {drill.prompt}
        </p>
        <div className="relative z-10 mt-4">
          <Link
            href="/rep"
            className="block w-full rounded-[14px] bg-terracotta-500 px-6 py-4 text-center text-base font-semibold text-cream transition-colors hover:bg-terracotta-600"
          >
            Take the floor
          </Link>
        </div>
        <Image
          src="/demos.png"
          alt="Demos"
          width={150}
          height={150}
          priority
          className="pointer-events-none absolute -bottom-9 -right-7 w-[150px]"
        />
      </div>

      <p className="mt-5 text-center text-[13px] text-stone-500">
        60–90 seconds. Pauses are allowed — they&apos;re scored in your favor.
      </p>
    </main>
  );
}
