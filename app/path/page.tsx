"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Paywall } from "@/components/Paywall";
import { Stars } from "@/components/Stars";
import { fetchReps, type RepRow } from "@/lib/client-data";
import {
  MAX_STARS,
  nextLesson,
  starsByLesson,
  totalStars,
  unitStates,
} from "@/lib/path";

// Duolingo-shaped path, Ethos-flavoured: stars come from metrics only
// (DECISIONS #10), so the copy says so out loud.
export default function PathPage() {
  const [reps, setReps] = useState<RepRow[]>([]);
  const [paywall, setPaywall] = useState<string | null>(null);

  useEffect(() => {
    fetchReps().then(setReps).catch(() => setReps([]));
  }, []);

  const starMap = starsByLesson(reps);
  const total = totalStars(starMap);
  const units = unitStates(starMap);
  const next = nextLesson(starMap);

  return (
    <main className="px-5 pb-24 pt-7">
      <h1 className="font-display text-2xl font-bold">The path</h1>
      <p className="mt-1 text-[13.5px] text-stone-500">
        Stars are earned by numbers, never by showing up.
      </p>

      <div className="mt-4 flex items-center gap-3 rounded-[18px] border border-black/5 bg-white lift p-4">
        <Stars n={3} size={17} />
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-sand">
            <div
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${(total / MAX_STARS) * 100}%` }}
            />
          </div>
        </div>
        <span className="font-display text-[15px] font-bold">
          {total}
          <span className="font-normal text-stone-500">/{MAX_STARS}</span>
        </span>
      </div>

      {units.map((u) => (
        <section key={u.id} className="mt-7">
          <div className="flex items-baseline justify-between">
            <div className="label-data">
              {u.icon} {u.name}
              {u.boss ? " · weekly boss" : ""}
            </div>
            <div className="label-data">
              {u.earned}/{u.possible}
            </div>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-stone-500">
            {u.blurb}
          </p>

          {u.locked && (
            <p className="mt-2 text-[12.5px] font-semibold text-stone-500">
              Opens at {u.unlocksAt} stars — {u.unlocksAt - total} to go.
            </p>
          )}

          <div className="mt-2 space-y-2.5">
            {u.lessons.map((l, i) => {
              const stars = starMap[l.id] ?? 0;
              const isNext = next?.lesson.id === l.id;
              const locked = u.locked || u.boss;
              const body = (
                <>
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[15px] font-semibold ${
                      stars > 0 ? "bg-terracotta-50" : "bg-sand"
                    }`}
                  >
                    {locked ? "🔒" : stars > 0 ? "✓" : i + 1}
                  </span>
                  <span className="flex-1">
                    <span className="block text-[14.5px] font-semibold">
                      {l.title}
                    </span>
                    {isNext && (
                      <span className="block text-[12px] font-semibold text-terracotta-600">
                        up next
                      </span>
                    )}
                    {u.boss && (
                      <span className="block text-[12px] text-stone-500">
                        Premium boss mode
                      </span>
                    )}
                  </span>
                  <Stars n={stars} />
                </>
              );
              const cls = `flex w-full items-center gap-3.5 rounded-[18px] border bg-white p-4 text-left ${
                isNext
                  ? "border-terracotta-500 border-2"
                  : "border-black/5"
              } ${u.locked && !u.boss ? "opacity-55" : ""}`;

              return locked ? (
                <button
                  key={l.id}
                  className={cls}
                  onClick={() =>
                    setPaywall(
                      u.boss ? "Boss mode · premium" : "Locked · keep training"
                    )
                  }
                >
                  {body}
                </button>
              ) : (
                <Link key={l.id} href={`/rep?lesson=${l.id}`} className={cls}>
                  {body}
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {paywall && (
        <Paywall reason={paywall} onClose={() => setPaywall(null)} />
      )}
    </main>
  );
}
