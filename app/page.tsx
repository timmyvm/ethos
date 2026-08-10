"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ComparisonCard } from "@/components/ComparisonCard";
import { Paywall } from "@/components/Paywall";
import { StreakBadge } from "@/components/StreakBadge";
import { fetchReps, type RepRow } from "@/lib/client-data";
import { todaysDrill } from "@/lib/drills";
import { nextLesson, starsByLesson } from "@/lib/path";
import { computeStreak, type StreakState } from "@/lib/streak";

// "The Floor" (DECISIONS #9) — one dominant rep card, one terracotta tap.
export default function Home() {
  const [reps, setReps] = useState<RepRow[] | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);

  useEffect(() => {
    fetchReps().then(setReps).catch(() => setReps([]));
  }, []);

  const history = reps ?? [];
  const streak: StreakState = computeStreak(
    history.map((r) => new Date(r.created_at))
  );
  const starMap = starsByLesson(history);
  const next = nextLesson(starMap);
  // The path decides what to train; the daily rotation is the fallback
  // once every lesson is at three stars.
  const drill = next?.lesson ?? todaysDrill();
  const unitName = next?.unit.name ?? drill.unit;

  // mechanics.md: the paywall waits for the day-3 progress card.
  const showDay3 = history.length >= 3;

  return (
    <main className="px-5 pb-24 pt-7">
      <div className="flex items-center justify-between">
        <div className="font-display text-[22px] font-bold">ethos</div>
        <StreakBadge streak={streak} />
      </div>

      <div className="label-data mt-8">
        {streak.didToday ? "Extra rep" : "Today's rep"} · {unitName}
      </div>
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
            {streak.didToday ? "Go again" : "Take the floor"}
          </Link>
        </div>
        <Image
          src={streak.didToday ? "/demos-celebrate.webp" : "/demos.webp"}
          alt="Demos"
          width={150}
          height={150}
          priority
          className="pointer-events-none absolute -bottom-9 -right-7 w-[150px]"
        />
      </div>

      {history.length === 0 ? (
        <p className="mt-5 text-center text-[13px] text-stone-500">
          60–90 seconds. Pauses are allowed — they&apos;re scored in your favor.
        </p>
      ) : (
        <div className="mt-4 flex gap-3">
          <Stat
            label="Last Ethos"
            value={
              history[history.length - 1]?.ethos_index?.toString() ?? "—"
            }
            note="/1000"
          />
          <Stat
            label="Reps"
            value={String(history.length)}
            note={history.length === 1 ? "logged" : "logged"}
          />
          <Stat
            label="Best streak"
            value={String(streak.longest)}
            note="days"
          />
        </div>
      )}

      {showDay3 && (
        <div className="mt-4">
          <ComparisonCard reps={history} />
        </div>
      )}

      <button
        onClick={() => setPaywall("Sunday boss · locked")}
        className="mt-4 flex w-full items-center gap-3 rounded-[18px] border border-terracotta-100 bg-terracotta-50 p-4 text-left"
      >
        <Image
          src="/demos-workout.webp"
          alt=""
          width={40}
          height={40}
          className="w-10 shrink-0"
        />
        <span className="flex-1">
          <span className="block text-[14.5px] font-semibold">
            Sunday boss: Cold Topic
          </span>
          <span className="block text-[12.5px] text-stone-500">
            A topic you&apos;ve never studied. 4 min research, 90s to explain.
          </span>
        </span>
        <span className="text-[13px]">🔒</span>
      </button>

      {paywall && (
        <Paywall reason={paywall} onClose={() => setPaywall(null)} />
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex-1 rounded-[18px] border border-black/5 bg-white p-3.5">
      <div className="label-data">{label}</div>
      <div className="font-display text-[26px] font-bold leading-tight">
        {value}
      </div>
      <div className="text-[11.5px] text-stone-500">{note}</div>
    </div>
  );
}
