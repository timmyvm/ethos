"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ComparisonCard } from "@/components/ComparisonCard";
import { FillerHeatmap } from "@/components/FillerHeatmap";
import { Paywall, type PaywallAsk } from "@/components/Paywall";
import { Sparkline } from "@/components/Sparkline";
import {
  Skeleton,
  SkeletonRegion,
  SkeletonRow,
} from "@/components/ui/Skeleton";
import { Stars } from "@/components/Stars";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { fetchProfile, fetchReps, type RepRow } from "@/lib/client-data";
import { limit } from "@/lib/entitlement";
import { dimensionPoints, INDEX_WEIGHTS } from "@/lib/index-score";
import { insights } from "@/lib/insights";
import { readable, readFailure } from "@/lib/load";
import { TRAITS, type TraitKey } from "@/lib/traits";

const FREE_DAYS = 7; // mechanics.md: free tier sees the last 7 days

/**
 * History per dimension — the premium display rule mechanics.md always
 * named and nothing ever rendered. One series per skill, in the same
 * weighted points the debrief's dimension list speaks (#101), skipping
 * reps that never carried the dimension (no judge ran, an old row with
 * no repairs score). Pure arithmetic over stored reps (#30).
 */
function skillSeries(reps: RepRow[]) {
  return TRAITS.map((t) => {
    const values: number[] = [];
    for (const r of reps) {
      const d = r.dimensions;
      if (!d) continue;
      const tier1 = d.tier1 as Partial<Record<TraitKey, number>>;
      const tier2 = d.tier2 as Partial<Record<TraitKey, { score: number }>> | null;
      const raw = tier1[t.key] ?? tier2?.[t.key]?.score;
      if (typeof raw === "number") {
        values.push(dimensionPoints(raw, INDEX_WEIGHTS[t.key]));
      }
    }
    return { ...t, values, weight: INDEX_WEIGHTS[t.key] };
  }).filter((s) => s.values.length >= 2);
}

/** The training log (design direction B) — every rep is a row. */
export default function HistoryPage() {
  const [reps, setReps] = useState<RepRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [paywall, setPaywall] = useState<PaywallAsk | null>(null);
  const [premium, setPremium] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setReps(null);
    const read = await readable(fetchReps);
    if (read.ok) setReps(read.data);
    else setFailed(true);
  }, []);

  useEffect(() => {
    void load();
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => {});
  }, [load]);

  /*
   * The failure and the empty state have to be different screens. They
   * were the same one: a dead connection rendered "Nothing logged yet"
   * over a sleeping Demos, which tells someone with sixty recordings
   * that they have none.
   */
  if (failed) {
    return (
      <main className="px-5 pb-24 pt-7">
        <h1 className="font-display text-[24px] font-extrabold">The log</h1>
        <ErrorState
          className="mt-4"
          {...readFailure("The log")}
          onRetry={() => void load()}
        />
      </main>
    );
  }

  if (reps === null) {
    return (
      <main className="px-5 pb-24 pt-7">
        <h1 className="font-display text-[24px] font-extrabold">The log</h1>
        <SkeletonRegion label="Loading your training log">
          <Skeleton className="mt-2 h-3 w-52" />
          <div className="mt-4 space-y-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-edge px-4 py-3.5"
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
        <h1 className="font-display text-[24px] font-extrabold">The log</h1>
        <EmptyState
          className="mt-6"
          art={
            <Image
              src="/demos-asleep.webp"
              alt=""
              width={110}
              height={110}
              className="demos mx-auto w-[110px]"
            />
          }
          title="Nothing logged yet."
          body="One recording and this becomes a training log."
          action={
            <Link
              href="/rep"
              className="press font-display block min-h-11 w-full rounded-xl bg-terracotta-500 px-6 py-3.5 text-[15px] font-bold text-cream hover:bg-terracotta-600"
            >
              Take the floor
            </Link>
          }
        />
      </main>
    );
  }

  // The 7-day window used to apply to everyone, premium included — the
  // limit was a constant rather than a gate. It reads the entitlement now.
  const days = limit(FREE_DAYS, premium);
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
  const skills = skillSeries(reps);

  return (
    <main className="px-5 pb-24 pt-7">
      <h1 className="font-display text-[24px] font-extrabold">The log</h1>
      <p className="mt-1 text-[13px] text-stone-400">
        {reps.length} recording{reps.length === 1 ? "" : "s"}. Tap one for the
        full result.
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
              onClick={() =>
                setPaywall({
                  reason: "Presence trendline · premium",
                  headline: "See what the camera measured.",
                })
              }
              className="press flex w-full items-center justify-between gap-3 rounded-xl border border-edge px-4 py-3.5 text-left"
            >
              <span className="min-w-0">
                <span className="label-data block">Presence</span>
                <span className="mt-1 block text-[12.5px] text-stone-500">
                  {presenceSeries.length} video recordings measured. Tap to see
                  the line.
                </span>
              </span>
              <span className="font-display shrink-0 rounded-full border border-stone-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-stone-400">
                Pro
              </span>
            </button>
          ))}
      </div>

      {/* One line per skill (mechanics.md: "history per dimension" is
          the premium tier's display rule). Same honesty pattern as the
          Presence teaser: free sees what exists and how much of it. */}
      {skills.length > 0 && (
        <>
          <div className="section-title mt-7">Every skill</div>
          {premium ? (
            <div className="mt-2 space-y-2.5">
              {skills.map((s) => (
                <Sparkline
                  key={s.key}
                  values={s.values}
                  label={`${s.name} · of ${s.weight}`}
                  height={44}
                />
              ))}
            </div>
          ) : (
            <button
              onClick={() =>
                setPaywall({ reason: "Skill trendlines · premium" })
              }
              className="press mt-2 w-full rounded-xl border border-edge px-4 py-3.5 text-left"
            >
              <div className="text-[12.5px] text-stone-500">
                {skills.length} skill{skills.length === 1 ? "" : "s"} tracked
                across {reps.length} recording{reps.length === 1 ? "" : "s"}.
                Tap to see the lines.
              </div>
            </button>
          )}
        </>
      )}

      {insights(reps).length > 0 && (
        <div className="mt-6 border-t border-hairline pt-3.5">
          <div className="label-data">What the numbers say</div>
          {/* Plain prose on the paper — arithmetic doesn't need a box. */}
          <div className="mt-1.5 space-y-2">
            {insights(reps).map((i) => (
              <p
                key={i.id}
                className="text-[13.5px] leading-[1.5] text-stone-600"
              >
                <span className="font-semibold text-ink">{i.headline}</span>{" "}
                {i.detail}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        <FillerHeatmap reps={reps} />
      </div>

      {reps.length >= 2 && (
        <div className="mt-4">
          <ComparisonCard reps={reps} />
        </div>
      )}

      <div className="label-data mt-6 pb-1.5">Every recording</div>
      <div>
        {newestFirst.map((r) => {
          const d = new Date(r.created_at);
          const held = (r.pauses ?? []).filter((p) => p.kind !== "beat").length;
          return (
            <Link
              key={r.id}
              href={`/rep/${r.id}`}
              className="press flex items-center gap-3.5 border-t border-hairline px-0.5 py-2.5"
            >
              <div className="w-11 shrink-0">
                <div className="font-display text-[10px] font-bold uppercase tracking-[0.1em] text-stone-300">
                  {d.toLocaleDateString(undefined, { month: "short" })}
                </div>
                <div className="font-display text-[18px] font-extrabold leading-none tabular-nums">
                  {String(d.getDate()).padStart(2, "0")}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-[16px] font-extrabold tabular-nums">
                    {r.ethos_index ?? "—"}
                  </span>
                  <span className="text-[11px] text-stone-400">/1000</span>
                </div>
                <div className="mt-px text-[12px] text-stone-400">
                  {r.filler_count} filler{r.filler_count === 1 ? "" : "s"} ·{" "}
                  {r.wpm} wpm · {held} held · {Math.round(r.duration_s)}s
                </div>
              </div>
              <span className="shrink-0">
                <Stars n={r.stars} size={12} />
              </span>
            </Link>
          );
        })}
      </div>

      {hidden > 0 && (
        <button
          onClick={() =>
            setPaywall({
              reason: "Full history · premium",
              headline: "Your first recording is still here.",
            })
          }
          className="press flex w-full items-center justify-between gap-3 border-y border-hairline px-0.5 py-3 text-left"
        >
          <span className="text-[13px] font-semibold text-stone-500">
            {hidden} older recording{hidden === 1 ? "" : "s"} held since{" "}
            {new Date(reps[0].created_at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}
            .
          </span>
          <span className="font-display shrink-0 text-[13px] font-bold text-terracotta-700">
            Unlock full history →
          </span>
        </button>
      )}

      {paywall && (
        <Paywall
          reason={paywall.reason}
          headline={paywall.headline}
          onClose={() => setPaywall(null)}
        />
      )}
    </main>
  );
}
