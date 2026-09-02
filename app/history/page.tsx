"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FillerHeatmap } from "@/components/FillerHeatmap";
import { Paywall, type PaywallAsk } from "@/components/Paywall";
import { ScoreCard } from "@/components/ScoreCard";
import { Sparkline } from "@/components/Sparkline";
import {
  Skeleton,
  SkeletonRegion,
  SkeletonRow,
  SkeletonScoreCard,
} from "@/components/ui/Skeleton";
import { Stars } from "@/components/Stars";
import { ErrorState } from "@/components/ui/ErrorState";
import { fetchProfile, fetchReps, type RepRow } from "@/lib/client-data";
import { limit } from "@/lib/entitlement";
import { fillerHeatmap, insights } from "@/lib/insights";
import { readable, readFailure } from "@/lib/load";
import {
  movedRows,
  presenceRow,
  recordingName,
  skillRows,
  type MovedRow,
} from "@/lib/log";
import { starsByLesson, totalStars, UNITS } from "@/lib/path";

const FREE_DAYS = 7; // mechanics.md: free tier sees the last 7 days
const DASH = "—";

/** The two grids, shared by header and rows so the columns line up. */
const MOVED_GRID = "grid grid-cols-[minmax(0,1fr)_38px_42px_58px_44px] gap-2";
const RECORD_GRID = "grid grid-cols-[34px_minmax(0,1fr)_44px_36px_36px_36px] gap-1.5";

/**
 * The training log (#17, rebuilt to #217): one hero, one row grammar,
 * and the empty state is the populated state with the numbers missing.
 *
 * Three bands. The score card Home already draws, so the shape is
 * learned once. "What moved", one row per metric: label, day one, now,
 * the change printed rather than left for the reader to subtract, and
 * the trend in a fixed track. "Every recording", as columns with the
 * units stated once in a header. Anything that needs its own shape
 * (the filler heatmap) is one tap down from the row it explains.
 */
export default function HistoryPage() {
  const [reps, setReps] = useState<RepRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [paywall, setPaywall] = useState<PaywallAsk | null>(null);
  const [premium, setPremium] = useState(false);
  const [showFillers, setShowFillers] = useState(false);

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
          <SkeletonScoreCard />
          <Skeleton className="mt-6 h-2.5 w-24" />
          <div className="mt-2 space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
          <Skeleton className="mt-7 h-2.5 w-28" />
          <div className="mt-2 space-y-2.5">
            {[0, 1, 2].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </SkeletonRegion>
      </main>
    );
  }

  const empty = reps.length === 0;
  const starMap = starsByLesson(reps);
  const scored = reps.filter((r) => r.ethos_index !== null);
  const firstIndex = scored[0]?.ethos_index ?? null;
  const lastIndex = scored[scored.length - 1]?.ethos_index ?? null;
  // Against the FIRST scored recording, as on Home: the arc, not the
  // last step.
  const indexDelta =
    lastIndex !== null && firstIndex !== null && scored.length > 1
      ? lastIndex - firstIndex
      : null;

  const rows = movedRows(reps);
  const presence = presenceRow(reps);
  const skills = skillRows(reps);
  const heatCount = fillerHeatmap(reps).reduce((a, b) => a + b, 0);
  const top = insights(reps)[0];

  // The 7-day window used to apply to everyone, premium included — the
  // limit was a constant rather than a gate. It reads the entitlement now.
  const days = limit(FREE_DAYS, premium);
  const cutoff = days === null ? -Infinity : Date.now() - days * 86_400_000;
  const visible = reps.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  const hidden = reps.length - visible.length;
  const newestFirst = [...visible].reverse();
  const since = empty
    ? null
    : new Date(reps[0].created_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });

  return (
    <main className="px-5 pb-24 pt-7">
      <h1 className="font-display text-[24px] font-extrabold">The log</h1>
      <p className="mt-1 text-[13px] text-stone-400">
        {empty
          ? "0 recordings."
          : `${reps.length} recording${reps.length === 1 ? "" : "s"} since ${since}. Tap one for the full result.`}
      </p>

      {/*
       * Band one: the hero (#217). The card Home draws, so the log is
       * no longer the one data screen without a landing point, and the
       * day-zero card (#213) finally has the populated twin it was
       * drawn against. The footer anchors the delta without a second
       * card.
       */}
      <ScoreCard
        index={lastIndex}
        delta={indexDelta}
        recordings={reps.length}
        stars={totalStars(starMap)}
        foot={
          empty
            ? "Day 1 sets the number to beat."
            : indexDelta !== null
              ? `Day 1 scored ${firstIndex}.`
              : undefined
        }
      />

      {/*
       * Band two: what moved. One table in place of five sparkline
       * cards, the comparison card and a column of insight prose. The
       * change column is what the reader used to compute.
       */}
      <section className="mt-6">
        <div className="label-data pb-1.5">What moved</div>
        <div className={`${MOVED_GRID} border-b border-edge pb-1.5`}>
          <ColumnHead>metric</ColumnHead>
          <ColumnHead right>day 1</ColumnHead>
          <ColumnHead right>now</ColumnHead>
          <ColumnHead right>change</ColumnHead>
          <ColumnHead right>trend</ColumnHead>
        </div>

        {rows.map((row) =>
          row.key === "fillers" && heatCount > 0 ? (
            <div key={row.key}>
              {/* Where the fillers land is detail about this number, so
                  it lives one tap down from the row rather than as a
                  fourth grammar on the summary. */}
              <button
                type="button"
                aria-expanded={showFillers}
                onClick={() => setShowFillers((v) => !v)}
                className="press block w-full text-left"
              >
                <MetricRow row={row} dim={empty} />
              </button>
              {showFillers && (
                <div className="py-2.5">
                  <FillerHeatmap reps={reps} />
                </div>
              )}
            </div>
          ) : (
            <MetricRow key={row.key} row={row} dim={empty} />
          )
        )}

        {/* Presence has its own history (#69) and its trendline is Pro
            (§2). Free sees the row exists and how many recordings are
            in it, in the same grammar, never a padlock over an empty
            box. */}
        {presence &&
          (premium ? (
            <MetricRow row={presence} />
          ) : (
            <TeaserRow
              label="Presence"
              note={`${presence.series.length} video recording${presence.series.length === 1 ? "" : "s"}`}
              onTap={() =>
                setPaywall({
                  reason: "Presence trendline · premium",
                  headline: "See what the camera measured.",
                })
              }
            />
          ))}

        {/* One row per skill (mechanics.md: history per dimension is
            the premium display rule, #200). Same honesty pattern. */}
        {skills.length > 0 &&
          (premium ? (
            skills.map((row) => <MetricRow key={row.key} row={row} />)
          ) : (
            <TeaserRow
              label="Every skill"
              note={`${skills.length} tracked`}
              onTap={() => setPaywall({ reason: "Skill trendlines · premium" })}
            />
          ))}

        {top && (
          <p className="mt-3 text-caption text-stone-600">
            <span className="font-semibold text-ink">{top.headline}</span>{" "}
            {top.detail}
          </p>
        )}
      </section>

      {/*
       * Band three: every recording, as columns. The unit words leave
       * the rows and become a header; digits line up under them, so
       * the eye runs down the fillers column and sees the trend
       * without a chart. Duration lives on the full result.
       */}
      <section className="mt-7">
        <div className="label-data pb-1.5">
          {empty ? "Waiting to be logged" : "Every recording"}
        </div>
        <div className={`${RECORD_GRID} border-b border-edge pb-1.5`}>
          <ColumnHead>date</ColumnHead>
          <ColumnHead>lesson</ColumnHead>
          <ColumnHead right>index</ColumnHead>
          <ColumnHead right>fill</ColumnHead>
          <ColumnHead right>wpm</ColumnHead>
          <ColumnHead right>held</ColumnHead>
        </div>

        {empty
          ? UNITS[0].lessons.slice(0, 3).map((lesson, i) => (
              <div
                key={lesson.id}
                className={`${RECORD_GRID} items-center border-t border-hairline py-2.5 text-stone-300`}
              >
                <span className="font-display text-[16px] font-extrabold leading-none tabular-nums">
                  {i + 1}
                </span>
                <span className="font-display truncate text-[13.5px] font-bold">
                  {lesson.title}
                </span>
                {[0, 1, 2, 3].map((c) => (
                  <span key={c} className="text-right text-[13px] tabular-nums">
                    {DASH}
                  </span>
                ))}
              </div>
            ))
          : newestFirst.map((r) => {
              const d = new Date(r.created_at);
              const held = (r.pauses ?? []).filter((p) => p.kind !== "beat").length;
              return (
                <Link
                  key={r.id}
                  href={`/rep/${r.id}`}
                  className={`press ${RECORD_GRID} items-center border-t border-hairline py-2.5`}
                >
                  <span className="leading-none">
                    <span className="font-display block text-[9px] font-bold uppercase tracking-[0.1em] text-stone-300">
                      {d.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                    <span className="font-display block text-[16px] font-extrabold tabular-nums">
                      {String(d.getDate()).padStart(2, "0")}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="font-display block truncate text-[13.5px] font-bold">
                      {recordingName(r)}
                    </span>
                    <Stars n={r.stars} size={9} />
                  </span>
                  <span className="font-display text-right text-[16px] font-extrabold tabular-nums">
                    {r.ethos_index ?? DASH}
                  </span>
                  <Cell>{r.filler_count}</Cell>
                  <Cell>{r.wpm}</Cell>
                  <Cell>{held}</Cell>
                </Link>
              );
            })}

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
              {since}.
            </span>
            <span className="font-display shrink-0 text-[13px] font-bold text-terracotta-700">
              Unlock full history →
            </span>
          </button>
        )}
      </section>

      {/* Day zero (#213): Demos awake, one tap. The asleep pose on the
          one screen that says "you have not started" is the sad-mascot
          state brand.md bans. */}
      {empty && (
        <>
          <div className="mt-6 flex items-center gap-3.5">
            <Image
              src="/demos-speaking.webp"
              alt=""
              width={104}
              height={104}
              className="demos pointer-events-none w-[56px] shrink-0"
            />
            <p className="text-body text-stone-500">
              One recording and this becomes a training log.
            </p>
          </div>
          <Link
            href="/rep"
            className="press font-display mt-4 block min-h-11 w-full rounded-xl bg-terracotta-500 px-6 py-3.5 text-center text-[15px] font-bold text-cream hover:bg-terracotta-600"
          >
            Take the floor
          </Link>
        </>
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

function ColumnHead({
  children,
  right = false,
}: {
  children: string;
  right?: boolean;
}) {
  return (
    <span className={`label-data !text-[9.5px] ${right ? "text-right" : ""}`}>
      {children}
    </span>
  );
}

function Cell({ children }: { children: number }) {
  return (
    <span className="text-right text-[13px] font-semibold text-stone-600 tabular-nums">
      {children}
    </span>
  );
}

/**
 * One metric, five cells. Direction wears the colour (#195): sage when
 * the number moved the right way, rust when it didn't, stone when it
 * hasn't moved or has nowhere to move from yet.
 */
function MetricRow({ row, dim = false }: { row: MovedRow; dim?: boolean }) {
  const tone =
    row.direction === "up"
      ? "text-sage-700"
      : row.direction === "down"
        ? "text-rust"
        : "text-stone-400";
  return (
    <div
      className={`${MOVED_GRID} items-center border-t border-hairline py-2.5 ${
        dim ? "text-stone-300" : ""
      }`}
    >
      <span className="font-display truncate text-[13px] font-bold">
        {row.label}
      </span>
      <span
        className={`font-display text-right text-[13px] font-semibold tabular-nums ${
          dim ? "" : "text-stone-400"
        }`}
      >
        {row.then ?? DASH}
      </span>
      <span className="font-display text-right text-[17px] font-extrabold tabular-nums">
        {row.now ?? DASH}
      </span>
      <span
        className={`font-display whitespace-nowrap text-right text-[12px] font-bold tabular-nums ${
          dim ? "" : tone
        }`}
      >
        {row.change ?? DASH}
      </span>
      <Sparkline values={row.series} label={row.label} invert={row.invert} height={20} bare />
    </div>
  );
}

/** A Pro row in the table's own grammar: label, what exists, the chip. */
function TeaserRow({
  label,
  note,
  onTap,
}: {
  label: string;
  note: string;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`press ${MOVED_GRID} w-full items-center border-t border-hairline py-2.5 text-left`}
    >
      <span className="font-display truncate text-[13px] font-bold">{label}</span>
      <span className="col-span-3 text-right text-[12px] text-stone-400">
        {note}
      </span>
      <span className="font-display justify-self-end rounded-full border border-stone-200 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-stone-400">
        Pro
      </span>
    </button>
  );
}
