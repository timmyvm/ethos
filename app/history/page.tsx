"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ComparisonCard } from "@/components/ComparisonCard";
import { FillerHeatmap } from "@/components/FillerHeatmap";
import { Paywall } from "@/components/Paywall";
import { Sparkline } from "@/components/Sparkline";
import {
  Skeleton,
  SkeletonRegion,
  SkeletonRow,
} from "@/components/Skeleton";
import { Stars } from "@/components/Stars";
import { fetchProfile, fetchReps, type RepRow } from "@/lib/client-data";
import { limit } from "@/lib/entitlement";
import { insights } from "@/lib/insights";

const FREE_DAYS = 7; // mechanics.md: free tier sees the last 7 days

/** The training log (design direction B) — every rep is a row. */
export default function HistoryPage() {
  const [reps, setReps] = useState<RepRow[] | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [premium, setPremium] = useState(false);

  useEffect(() => {
    fetchReps().then(setReps).catch(() => setReps([]));
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => {});
  }, []);

  if (reps === null) {
    return (
      <main className="px-5 pb-24 pt-7">
        <h1 className="font-display text-2xl font-bold">The log</h1>
        <SkeletonRegion label="Loading your training log">
          <Skeleton className="mt-2 h-3 w-52" />
          <div className="mt-4 space-y-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-[18px] border border-hairline bg-surface lift p-5"
              >
                <div className="flex items-baseline justify-between">
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="mt-3 h-16 w-full" rounded="rounded-[8px]" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-7 h-2.5 w-24" />
          <div className="mt-2 space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </SkeletonRegion>
      </main>
    );
  }

  if (reps.length === 0) {
    return (
      <main className="px-5 pb-24 pt-7">
        <h1 className="font-display text-2xl font-bold">The log</h1>
        <div className="mt-6 rounded-[18px] border border-hairline bg-surface lift p-6 text-center">
          <Image
            src="/demos-asleep.webp"
            alt=""
            width={110}
            height={110}
            className="demos mx-auto w-[110px]"
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

  // The 7-day window used to apply to everyone, premium included — the
  // limit was a constant rather than a gate. It reads the entitlement now.
  const days = limit(FREE_DAYS);
  const cutoff = days === null ? -Infinity : Date.now() - days * 86_400_000;
  const visible = reps.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  const hidden = reps.length - visible.length;
  const newestFirst = [...visible].reverse();

  const indexSeries = reps
    .filter((r) => r.ethos_index !== null)
    .map((r) => r.ethos_index as number);
  const fillerSeries = reps.map((r) =>
    r.duration_s > 0 ? (r.filler_count / (r.duration_s / 60)) : 0
  );
  // Presence has its own history, separate from the Index — two scores,
  // two trendlines. Only video reps appear in it, which is why it can't
  // share the Index's line: the gaps would read as a collapse.
  const presenceSeries = reps
    .filter((r) => r.presence_score !== null)
    .map((r) => r.presence_score as number);

  return (
    <main className="px-5 pb-24 pt-7">
      <h1 className="font-display text-2xl font-bold">The log</h1>
      <p className="mt-1 text-[13.5px] text-stone-500">
        {reps.length} recording{reps.length === 1 ? "" : "s"}, one row each.
        Tap any of them for the full result.
      </p>

      <div className="mt-4 space-y-3">
        {indexSeries.length >= 2 && (
          <Sparkline values={indexSeries} label="Ethos Index" />
        )}
        <Sparkline values={fillerSeries} label="Fillers / min" invert />

        {/* Week-over-week Presence is a Pro surface (§2), so the free
            tier sees that it exists and how many reps are in it — never
            a padlock over an empty box. */}
        {presenceSeries.length >= 2 &&
          (premium ? (
            <Sparkline values={presenceSeries} label="Presence" />
          ) : (
            <button
              onClick={() => setPaywall("Presence trendline · premium")}
              className="press w-full rounded-[18px] border border-hairline bg-surface lift p-4 text-left"
            >
              <div className="label-data">Presence</div>
              <div className="mt-1 text-[13px] text-stone-500">
                {presenceSeries.length} video reps measured. Tap to see the
                line.
              </div>
            </button>
          ))}
      </div>

      {insights(reps).length > 0 && (
        <>
          <div className="label-data mt-7">What the reps say</div>
          <div className="mt-2 space-y-2.5">
            {insights(reps).map((i) => (
              <div
                key={i.id}
                className="rounded-[18px] border border-hairline bg-surface lift p-5"
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
              className="flex items-center gap-3 rounded-[18px] border border-hairline bg-surface lift p-4"
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
          {hidden} older recording{hidden === 1 ? "" : "s"} archived — unlock
          full history
        </button>
      )}

      {paywall && (
        <Paywall reason={paywall} onClose={() => setPaywall(null)} />
      )}
    </main>
  );
}
