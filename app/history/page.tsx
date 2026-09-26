"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CountUp } from "@/components/CountUp";
import { PremiumMark } from "@/components/PremiumMark";
import { IconChevron } from "@/components/Icon";
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
import { DURATION } from "@/lib/motion";
import { fillerHeatmap, insights } from "@/lib/insights";
import { readable, readFailure } from "@/lib/load";
import {
  movedRows,
  presenceRow,
  recordingName,
  recordingTrait,
  rowTrait,
  skillRows,
  type MovedRow,
} from "@/lib/log";
import { starsByLesson, totalStars, UNITS } from "@/lib/path";
import { TRAIT, type TraitId } from "@/content/traits";

const FREE_DAYS = 7; // mechanics.md: free tier sees the last 7 days
const DASH = "—";
/** A formatted value CountUp can tick: whole digits, no decimal point. */
/** A cell the count can drive: a plain number, with or without a decimal. */
const NUMERIC = /^-?\d+(\.\d+)?$/;

/**
 * Count a value back in the shape the table already printed it: the
 * running number keeps the same number of decimal places as the final
 * one, so a row never changes width mid-tick and never shows the user a
 * precision the app does not claim.
 */
function decimalsOf(printed: string): (value: number) => string {
  const places = printed.split(".")[1]?.length ?? 0;
  return (value: number) => value.toFixed(places);
}

/** The two grids, shared by header and rows so the columns line up. */
const MOVED_GRID = "grid grid-cols-[minmax(0,1fr)_36px_42px_74px_44px] gap-2";
/* The date column is a 40px tile in the recording's trait tone (the
   colour pass), and the lesson title keeps 4px more air off it. */
const RECORD_GRID = "grid grid-cols-[40px_minmax(0,1fr)_44px_36px_36px_36px] gap-1.5";

/**
 * Which trait an insight is about, so its line wears that trait's tone.
 * The two that are about no single trait (the best hour, the rising
 * floor) stay on the plain ground.
 */
const INSIGHT_TRAIT: Record<string, TraitId> = {
  "dominant-filler": "fillers",
  "filler-cluster": "fillers",
  "pace-fixed": "pace",
  "pace-fast": "pace",
  "silence-up": "pause",
};

/**
 * The log (#17, rebuilt to #217): one hero, one row grammar,
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
      <main className="px-5 pb-22 pt-7">
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
      <main className="px-5 pb-22 pt-7">
        <h1 className="font-display text-[24px] font-extrabold">The log</h1>
        <SkeletonRegion label="Loading your log">
          <Skeleton className="mt-2 h-3 w-52" />
          {/* The score card carries no outer margin any more (#234), so
              the placeholder holds the same 28 the real card sits on. */}
          <div className="mt-7">
            <SkeletonScoreCard />
          </div>
          <Skeleton className="mt-7 h-2.5 w-24" />
          <div className="mt-3">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
          <Skeleton className="mt-7 h-2.5 w-28" />
          <div className="mt-3">
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
    <main className="px-5 pb-22 pt-7">
      {/* One entrance per band (#245). The read landing is still one
          event, but the two tables are lists, and a list assembles
          itself: `.stagger` ladders each section's eyebrow, column head
          and rows 40ms apart. It REPLACES the block's `.arrive` — a row
          that both fades with its parent and fades on its own clock
          arrives twice and reads as neither. */}
      {/* Outside the arrival on purpose: the loading state draws this
          exact h1, so fading it in with the read would take a title
          that is already on the screen down to nothing and back. */}
      <h1 className="font-display text-[24px] font-extrabold">The log</h1>
      <div className="arrive">
        <p className="mt-1 text-caption text-stone-400">
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
        <div className="mt-7">
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
        </div>
      </div>

      {/*
       * Band two: what moved. One table in place of five sparkline
       * cards, the comparison card and a column of insight prose. The
       * change column is what the reader used to compute.
       */}
      <section className="stagger mt-7">
        <div className="label-data">What moved</div>
        <div className={`${MOVED_GRID} mt-3 border-b border-edge pb-1.5`}>
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
                <MetricRow row={row} dim={empty} open={showFillers} />
              </button>
              {showFillers && (
                /* `.reveal`: the panel drops out of the row that opened
                   it, rather than being there the instant the row is
                   tapped (the before strip was five identical frames). */
                <div className="reveal py-3">
                  <FillerHeatmap reps={reps} />
                </div>
              )}
            </div>
          ) : (
            <MetricRow key={row.key} row={row} dim={empty} />
          )
        )}

        {/* Presence has its own history (#69) and its trendline is Premium
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
            skills.map((row) => (
              /* A taught trait's row takes the name Today and Lessons
                 print beside the same colour ("Restarts", not
                 "Self-corrections"), so one colour never has two names. */
              <MetricRow
                key={row.key}
                row={{ ...row, label: TRAIT[row.key as TraitId]?.name ?? row.label }}
              />
            ))
          ) : (
            <TeaserRow
              label="Every skill"
              note={`${skills.length} tracked`}
              onTap={() => setPaywall({ reason: "Skill trendlines · premium" })}
            />
          ))}

        {/* The one insight, ruled in its trait's tone when it has one:
            the sentence about "like" is a Fillers sentence, so it hangs
            off the Fillers colour the row above it and the heatmap wear.
            A rule, not a box: it annotates the table, it is no card. */}
        {top && (
          <p
            data-trait={INSIGHT_TRAIT[top.id]}
            className={`text-caption ${
              INSIGHT_TRAIT[top.id]
                ? "log-insight mt-3 py-2.5 pl-3 pr-3.5 text-stone-600"
                : "border-t border-hairline pt-3 text-stone-600"
            }`}
          >
            <span
              className={`font-semibold ${INSIGHT_TRAIT[top.id] ? "tone-ink" : "text-ink"}`}
            >
              {top.headline}
            </span>{" "}
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
      <section className="stagger mt-7">
        <div className="label-data">
          {empty ? "Waiting to be logged" : "Every recording"}
        </div>
        <div className={`${RECORD_GRID} mt-3 border-b border-edge pb-1.5`}>
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
                className={`${RECORD_GRID} items-center border-t border-hairline py-3 text-stone-400`}
              >
                <DateTile trait={recordingTrait({ lesson_id: lesson.id })}>
                  <span className="font-display block text-[16px] font-extrabold tabular-nums">
                    {i + 1}
                  </span>
                </DateTile>
                <span className="font-display truncate text-[14px] font-bold">
                  {lesson.title}
                </span>
                {[0, 1, 2, 3].map((c) => (
                  <span
                    key={c}
                    className="font-display text-right text-caption font-extrabold tabular-nums"
                  >
                    {DASH}
                  </span>
                ))}
              </div>
            ))
          : newestFirst.map((r) => {
              const d = new Date(r.created_at);
              const held = (r.pauses ?? []).filter((p) => p.kind !== "beat").length;
              const trait = recordingTrait(r);
              return (
                <Link
                  key={r.id}
                  href={`/rep/${r.id}`}
                  className={`press ${RECORD_GRID} items-center border-t border-hairline py-3`}
                >
                  <DateTile trait={trait}>
                    <span className="log-date-month block">
                      {d.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                    <span className="font-display mt-0.5 block text-[15px] font-extrabold tabular-nums">
                      {String(d.getDate()).padStart(2, "0")}
                    </span>
                  </DateTile>
                  <span className="min-w-0">
                    {/* Two lines, never an ellipsis: the lesson column is
                        134px and "Punctuate with silence" needs 165, so
                        the one label a row exists to show was the one
                        label you could not read (#287). */}
                    <span className="font-display line-clamp-2 text-[14px] font-bold leading-snug">
                      {recordingName(r)}
                    </span>
                    <Stars n={r.stars} size={11} />
                  </span>
                  <span className="font-display text-right text-[16px] font-extrabold tabular-nums">
                    {r.ethos_index === null ? (
                      DASH
                    ) : (
                      /* `max`, not `celebrate`: a row in a table is a
                         value arriving, not a rep landing, and 600ms
                         seven rows deep is a loading bar. */
                      <CountUp value={r.ethos_index} durationMs={DURATION.max} />
                    )}
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
            /* mt-2: air between the last tile and the plum chip, so a
               Variety tile's indigo never sits against Premium's plum. */
            className="press mt-2 flex w-full items-center justify-between gap-3 border-t border-hairline py-3 text-left"
          >
            <span className="text-caption text-stone-500">
              {hidden} older recording{hidden === 1 ? "" : "s"} held since{" "}
              {since}.
            </span>
            {/* Terracotta said "tap" on a row that was already a
                button, so the accent was carrying no information the
                row did not already carry. The mark carries the tier
                instead (#280). */}
            <PremiumMark variant="chip" />
          </button>
        )}
      </section>

      {/* Day zero (#213): Demos awake, one tap. The asleep pose on the
          one screen that says "you have not started" is the sad-mascot
          state brand.md bans. */}
      {empty && (
        <div className="arrive">
          <div className="mt-7 flex items-center gap-3.5">
            <Image
              src="/demos-speaking.webp"
              alt=""
              width={104}
              height={104}
              className="demos pointer-events-none w-[56px] shrink-0"
            />
            <p className="text-body text-stone-500">
              One recording and every number here fills in.
            </p>
          </div>
          <Link
            href="/rep"
            className="press font-display mt-4 block min-h-11 w-full rounded-control bg-terracotta-500 px-6 py-3.5 text-center text-[15px] font-bold text-on-accent hover:bg-terracotta-600"
          >
            Take the floor
          </Link>
        </div>
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
    <span className={`label-micro ${right ? "text-right" : ""}`}>
      {children}
    </span>
  );
}

function Cell({ children }: { children: number }) {
  return (
    <span className="font-display text-right text-caption font-extrabold text-stone-600 tabular-nums">
      {children}
    </span>
  );
}

/**
 * One metric, five cells. Direction wears the colour (#195): sage when
 * the number moved the right way, rust when it didn't, stone when it
 * hasn't moved or has nowhere to move from yet.
 */
function MetricRow({
  row,
  dim = false,
  open,
}: {
  row: MovedRow;
  dim?: boolean;
  /**
   * Present only on the row that opens the heatmap. The chevron is the
   * app's disclosure grammar (LessonScreen's "Why this works"): one
   * glyph that turns over in 120ms, so the tap is answered before the
   * panel has finished dropping, and the row says it opens before
   * anyone taps it.
   */
  open?: boolean;
}) {
  const trait = rowTrait(row.key);
  // The Index is the score the sage card carries, so its row is sage;
  // every other row is its trait's tone, or plain when it has none.
  const index = row.key === "index";
  const tone =
    row.direction === "up"
      ? "text-sage-700"
      : row.direction === "down"
        ? "text-rust"
        : "text-stone-400";
  return (
    <div
      data-trait={trait ?? undefined}
      data-index={index || undefined}
      className={`log-metric ${MOVED_GRID} items-center border-t border-hairline py-3 ${
        dim ? "text-stone-400" : ""
      }`}
    >
      <span className="font-display flex min-w-0 items-center gap-1 text-[14px] font-bold">
        {/* The trait's swatch, the key the recordings below are
            coloured by. A rectangle, like every mark that is not a
            chip. A row with no trait keeps the slot, blank, so every
            label in the column starts at the same x. */}
        <span
          aria-hidden
          className={`log-swatch ${trait || index ? "" : "log-swatch-blank"}`}
        />
        <span className={`truncate ${trait && !dim ? "tone-ink" : ""}`}>
          {row.label}
        </span>
        {open !== undefined && (
          <span
            aria-hidden
            data-open={open}
            className="disclosure-mark shrink-0 text-stone-300"
          >
            <IconChevron size={14} />
          </span>
        )}
      </span>
      <span
        className={`font-display text-right text-caption font-extrabold tabular-nums ${
          dim ? "" : "text-stone-400"
        }`}
      >
        {row.then ?? DASH}
      </span>
      <span className="font-display text-right text-[17px] font-extrabold tabular-nums">
        {/* `now` is already formatted (lib/log), so the count has to
            print it back the same way: a row reading "2.8" fillers a
            minute keeps its decimal on every frame, and a row reading
            "155" stays whole. Rounding a number the user reads, to make
            it tick, would animate a value the app does not report. */}
        {NUMERIC.test(row.now ?? "") ? (
          <CountUp
            value={Number(row.now)}
            durationMs={DURATION.max}
            format={decimalsOf(row.now!)}
          />
        ) : (
          (row.now ?? DASH)
        )}
      </span>
      <span
        className={`font-display whitespace-nowrap text-right text-caption font-extrabold tabular-nums ${
          dim ? "" : tone
        }`}
      >
        {row.change ?? DASH}
      </span>
      <Sparkline
        values={row.series}
        label={row.label}
        invert={row.invert}
        height={20}
        bare
        color={trait ? "var(--tone)" : index ? "var(--color-sage-600)" : undefined}
      />
    </div>
  );
}

/**
 * A recording's date as a small tile in its trait's tone: the wash for
 * a ground, the tone's ink for the digits. A recording that practised
 * no one trait (a game, a boss, a free recording) gets the plain
 * surface, so a colour always means a trait.
 */
function DateTile({
  trait,
  children,
}: {
  trait: TraitId | null;
  children: ReactNode;
}) {
  return (
    <span
      data-trait={trait ?? undefined}
      className={`log-date ${trait ? "tone-wash tone-ink" : ""}`}
    >
      {children}
    </span>
  );
}

/** A Premium row in the table's own grammar: label, what exists, the
    chip. The note still counts what is behind it: the mark names the
    tier and never hides a number (#280). */
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
    /*
     * NOT on MOVED_GRID. The data rows end in a 44px column sized for a
     * sparkline, and the mark is a word rather than the old two-letter
     * pill, so on the grid it sat on top of its own note. This row
     * carries no data columns to align with, so it is a plain flex row
     * like the "older recordings" row at the foot of the page.
     */
    <button
      type="button"
      onClick={onTap}
      className="press flex w-full items-center justify-between gap-3 border-t border-hairline py-3 text-left"
    >
      <span className="font-display flex min-w-0 items-center gap-1 text-[14px] font-bold">
        {/* The metric rows' blank swatch slot, so this label lines up
            with theirs. */}
        <span aria-hidden className="log-swatch log-swatch-blank" />
        <span className="truncate">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2.5">
        <span className="text-caption text-stone-400">{note}</span>
        <PremiumMark variant="chip" />
      </span>
    </button>
  );
}
