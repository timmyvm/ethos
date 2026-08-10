"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ComparisonCard } from "@/components/ComparisonCard";
import { ModPicker } from "@/components/ModPicker";
import { NextUp } from "@/components/NextUp";
import { PathRail } from "@/components/PathRail";
import { Paywall } from "@/components/Paywall";
import { StreakBadge } from "@/components/StreakBadge";
import { achievements } from "@/lib/achievements";
import { fetchProfile, fetchReps, fetchXp, type RepRow } from "@/lib/client-data";
import { todaysDrill } from "@/lib/drills";
import { syncFreezes } from "@/lib/freeze-sync";
import { nextLesson, starsByLesson } from "@/lib/path";
import { nextMilestones } from "@/lib/progress";
import { repHref } from "@/lib/rep-config";
import { armReminder } from "@/lib/reminders";
import { freshStart, nearMisses, openLoop } from "@/lib/rewards";
import { Moment } from "@/components/Moment";
import { UNITS } from "@/lib/path";
import { computeStreak, type StreakState } from "@/lib/streak";

const EMPTY: StreakState = {
  current: 0,
  longest: 0,
  atRisk: false,
  didToday: false,
  frozenInRun: 0,
};

// "The Floor" (DECISIONS #9) — one dominant rep card, one terracotta tap.
export default function Home() {
  const [reps, setReps] = useState<RepRow[] | null>(null);
  const [streak, setStreak] = useState<StreakState>(EMPTY);
  const [rescued, setRescued] = useState(0);
  const [premium, setPremium] = useState(false);
  const [mods, setMods] = useState<string[]>([]);
  const [showMods, setShowMods] = useState(false);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [xp, setXp] = useState(0);
  const [freezes, setFreezes] = useState(0);

  useEffect(() => {
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => {});
    fetchXp()
      .then((x) => setXp(x.total))
      .catch(() => {});

    fetchReps()
      .then(async (rows) => {
        setReps(rows);
        const dates = rows.map((r) => new Date(r.created_at));
        // Optimistic: show the unfrozen streak immediately, then
        // reconcile freezes (which may involve a write).
        setStreak(computeStreak(dates));
        try {
          const sync = await syncFreezes(dates);
          setStreak(sync.streak);
          setRescued(sync.rescued.length);
          setFreezes(sync.equipped);
          void armReminder({
            streak: sync.streak.current,
            didToday: sync.streak.didToday,
          });
        } catch {}
      })
      .catch(() => setReps([]));
  }, []);

  const history = reps ?? [];
  const starMap = starsByLesson(history);
  const next = nextLesson(starMap);
  // The path decides what to train; the daily rotation is the fallback
  // once every lesson is at three stars.
  const drill = next?.lesson ?? todaysDrill();
  const unitName = next?.unit.name ?? drill.unit;

  // mechanics.md: the paywall waits for the day-3 progress card.
  const showDay3 = history.length >= 3;

  const milestones = nextMilestones({
    reps: history,
    starMap,
    streak,
    xp,
    freezesEquipped: freezes,
    achievements: achievements(history),
  });

  // Fresh-start framing beats the open loop on a landmark day; the rest
  // of the week, the unfinished lesson is the stronger pull (Zeigarnik).
  const banner =
    freshStart() ??
    openLoop(
      starMap,
      UNITS.flatMap((u) => u.lessons)
    );
  const almost = nearMisses(milestones);

  return (
    <main className="px-5 pb-24 pt-7">
      <div className="flex items-center justify-between">
        <div className="font-display text-[22px] font-bold">ethos</div>
        <StreakBadge streak={streak} />
      </div>

      {rescued > 0 && (
        <div className="mt-4 rounded-[18px] border border-amber-500/30 bg-white px-4 py-3 text-[13px] leading-relaxed">
          <span className="font-semibold">
            A freeze covered {rescued === 1 ? "a day" : `${rescued} days`} you
            missed.
          </span>{" "}
          <span className="text-stone-500">
            The streak held. It didn&apos;t grow — you only count days you
            spoke.
          </span>
        </div>
      )}

      {almost.length > 0 && !streak.didToday && (
        <div className="mt-4">
          <Moment
            moment={{
              headline: `${almost[0].label} — ${almost[0].remainingLabel}`,
              detail: `${almost[0].detail}. One rep could do it.`,
              tone: "amber",
            }}
            emphasis
          />
        </div>
      )}

      {banner && history.length > 0 && (
        <div className="mt-4">
          <Moment moment={banner} />
        </div>
      )}

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
            href={repHref({ lesson: next?.lesson.id, mods })}
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

      {/* The path, directly under the floor. The rep card stays the one
          dominant action (DECISIONS #9); this answers "where am I". */}
      <div className="mt-6">
        <PathRail starMap={starMap} hasAnyRep={history.length > 0} />
      </div>

      <button
        onClick={() => setShowMods((v) => !v)}
        className="mt-5 text-[13px] font-semibold text-stone-500"
      >
        {showMods
          ? "Hide mods"
          : mods.length > 0
            ? `${mods.length} mod${mods.length === 1 ? "" : "s"} on · edit`
            : "Make it harder"}
      </button>

      {showMods && (
        <div className="mt-2">
          <ModPicker
            selected={mods}
            onChange={setMods}
            premium={premium}
            onPremiumTap={(m) => setPaywall(`${m.name} · premium mod`)}
          />
        </div>
      )}

      {history.length === 0 ? (
        <p className="mt-5 text-center text-[13px] text-stone-500">
          60–90 seconds. Pauses are allowed — they&apos;re scored in your favor.
        </p>
      ) : (
        <div className="mt-4 flex gap-3">
          <Stat
            label="Last Ethos"
            value={history[history.length - 1]?.ethos_index?.toString() ?? "—"}
            note="/1000"
          />
          <Stat label="Reps" value={String(history.length)} note="logged" />
          <Stat
            label="Best streak"
            value={String(streak.longest)}
            note="days"
          />
        </div>
      )}

      <div className="mt-6">
        <NextUp milestones={milestones} />
      </div>

      {showDay3 && (
        <div className="mt-4">
          <ComparisonCard reps={history} />
        </div>
      )}

      <Link
        href="/boss"
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
            This week&apos;s boss: Cold Topic
          </span>
          <span className="block text-[12.5px] text-stone-500">
            A topic you&apos;ve never studied. 4 min research, 90s to explain,
            fact-checked.
          </span>
        </span>
        <span className="text-[13px] text-stone-400" aria-hidden>
          →
        </span>
      </Link>

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
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
