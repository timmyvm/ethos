"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ComparisonCard } from "@/components/ComparisonCard";
import { FillerHeatmap } from "@/components/FillerHeatmap";
import { Paywall } from "@/components/Paywall";
import { Sparkline } from "@/components/Sparkline";
import { Stars } from "@/components/Stars";
import { fetchReps, type RepRow } from "@/lib/client-data";
import { insights } from "@/lib/insights";

const FREE_DAYS = 7; // mechanics.md: free tier sees the last 7 days

/** The training log (design direction B) — every rep is a row. */
export default function HistoryPage() {
  const [reps, setReps] = useState<RepRow[] | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);

  useEffect(() => {
    fetchReps().then(setReps).catch(() => setReps([]));
  }, []);

  if (reps === null) {
    return (
      <main className="px-5 pb-24 pt-7">
        <h1 className="font-display text-2xl font-bold">The log</h1>
        <p className="mt-2 text-[13.5px] text-stone-500">Loading…</p>
      </main>
    );
  }

  if (reps.length === 0) {
    return (
      <main className="px-5 pb-24 pt-7">
        <h1 className="font-display text-2xl font-bold">The log</h1>
        <div className="mt-6 rounded-[18px] border border-black/5 bg-white p-6 text-center">
          <Image
            src="/demos-asleep.webp"
            alt=""
            width={110}
            height={110}
            className="mx-auto w-[110px]"
          />
          <p className="mt-2 text-[14px] font-semibold">Nothing logged yet.</p>
          <p className="mt-1 text-[13px] text-stone-500">
            One rep and this page becomes a training log.
          </p>
          <Link
            href="/rep"
            className="mt-4 block w-full rounded-[14px] bg-terracotta-500 px-6 py-3.5 text-[15px] font-semibold text-cream"
          >
            Take the floor
          </Link>
        </div>
      </main>
    );
  }

  const cutoff = Date.now() - FREE_DAYS * 86_400_000;
  const visible = reps.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  const hidden = reps.length - visible.length;
  const newestFirst = [...visible].reverse();

  const indexSeries = reps
    .filter((r) => r.ethos_index !== null)
    .map((r) => r.ethos_index as number);
  const fillerSeries = reps.map((r) =>
    r.duration_s > 0 ? (r.filler_count / (r.duration_s / 60)) : 0
  );

  return (
    <main className="px-5 pb-24 pt-7">
      <h1 className="font-display text-2xl font-bold">The log</h1>
      <p className="mt-1 text-[13.5px] text-stone-500">
        {reps.length} rep{reps.length === 1 ? "" : "s"}. Tap any row for the
        full result.
      </p>

      <div className="mt-4 space-y-3">
        {indexSeries.length >= 2 && (
          <Sparkline values={indexSeries} label="Ethos Index" />
        )}
        <Sparkline values={fillerSeries} label="Fillers / min" invert />
      </div>

      {insights(reps).length > 0 && (
        <>
          <div className="label-data mt-7">What the reps say</div>
          <div className="mt-2 space-y-2.5">
            {insights(reps).map((i) => (
              <div
                key={i.id}
                className="rounded-[18px] border border-black/5 bg-white p-5"
              >
                <div className="text-[14.5px] font-semibold">{i.headline}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-stone-500">
                  {i.detail}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-3">
        <FillerHeatmap reps={reps} />
      </div>

      {reps.length >= 2 && (
        <div className="mt-4">
          <ComparisonCard reps={reps} />
        </div>
      )}

      <div className="label-data mt-7">Every rep</div>
      <div className="mt-2 space-y-2.5">
        {newestFirst.map((r) => {
          const d = new Date(r.created_at);
          const held = (r.pauses ?? []).filter((p) => p.kind !== "beat").length;
          return (
            <Link
              key={r.id}
              href={`/rep/${r.id}`}
              className="flex items-center gap-3 rounded-[18px] border border-black/5 bg-white p-4"
            >
              <div className="w-[52px] shrink-0">
                <div className="label-data !text-stone-400">
                  {d.toLocaleDateString(undefined, { month: "short" })}
                </div>
                <div className="font-display text-[20px] font-bold leading-none">
                  {d.getDate()}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[17px] font-bold">
                    {r.ethos_index ?? "—"}
                  </span>
                  <span className="text-[11.5px] text-stone-500">/1000</span>
                  <span className="ml-auto">
                    <Stars n={r.stars} size={12} />
                  </span>
                </div>
                <div className="mt-0.5 text-[12px] text-stone-500">
                  {r.filler_count} filler{r.filler_count === 1 ? "" : "s"} ·{" "}
                  {r.wpm} wpm · {held} held · {Math.round(r.duration_s)}s
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {hidden > 0 && (
        <button
          onClick={() => setPaywall("Full history · premium")}
          className="mt-3 w-full rounded-[18px] border border-terracotta-100 bg-terracotta-50 p-4 text-[13.5px] font-semibold"
        >
          {hidden} older rep{hidden === 1 ? "" : "s"} archived — unlock full
          history
        </button>
      )}

      {paywall && (
        <Paywall reason={paywall} onClose={() => setPaywall(null)} />
      )}
    </main>
  );
}
