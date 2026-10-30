"use client";

import { ScreenHeader } from "@/components/ui/ScreenHeader";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CountUp } from "@/components/CountUp";
import { PremiumDoor, PremiumMark } from "@/components/PremiumMark";
import { IconChevron } from "@/components/Icon";
import { FillerHeatmap } from "@/components/FillerHeatmap";
import { Paywall, type PaywallAsk } from "@/components/Paywall";
import { ScoreCard } from "@/components/ScoreCard";
import { Sparkline } from "@/components/Sparkline";
import {
  Skeleton,
  SkeletonRegion,
  SkeletonScoreCard,
} from "@/components/ui/Skeleton";
import { Stars } from "@/components/Stars";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  fetchProfile,
  fetchRepSpine,
  fetchReps,
  type RepRow,
  type RepSpine,
} from "@/lib/client-data";
import { limit } from "@/lib/entitlement";
import { DURATION } from "@/lib/motion";
import { waitingRows } from "@/lib/log-waiting";
import { fillerHeatmap, insights } from "@/lib/insights";
import { readable, readFailure } from "@/lib/load";
import {
  movedRows,
  presenceRow,
  recordingName,
  recordingTrait,
  rolling,
  rowTrait,
  skillRows,
  type MovedRow,
} from "@/lib/log";
import { starsByLesson, totalStars } from "@/lib/path";
import { readPrefs } from "@/lib/prefs";
import { TRAIT, type TraitId } from "@/content/traits";
import { usePaywallReturn } from "@/lib/use-paywall-return";

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

/** The two grids, shared by header and rows so the columns line up.
    Under 360px the trend column steps out (TREND_CELL), so the metric's
    name keeps room to be read: at 320 it truncated to "Eth..." and
    "F...". E32's "All fillers / min" is 104px with its chevron, so the
    number columns are as narrow as their contents and the gaps 6: Day 1
    28 under 360 (its values reach 25; its head hangs 4px into the gap
    by the empty end of "Metric", since right-aligned heads and changes
    overflow to their left and keep one right edge) and 32 over it, Now
    36 and 38 (its widest, "12.3", is 34), Change 76 ("in 130 to 160" is
    75.5), Trend 40 (its head is 38). The label and its chevron hold one
    line at 320 and from 375 up; at 360 it takes two, as it did before. */
const MOVED_GRID =
  "grid grid-cols-[minmax(0,1fr)_28px_36px_76px] gap-1.5 min-[360px]:grid-cols-[minmax(0,1fr)_32px_38px_76px_40px]";
/* Out of the flow and unseen under 360px, rather than `display: none`:
   toggling display restarts the line's unroll (`.fill`), and the
   camera's full-page capture caught it part way. */
const TREND_CELL = "max-[359px]:invisible max-[359px]:absolute";
/* The date is a bare 40px column, the day over its month (D33), and the
   number columns are as wide as their heads, so the lesson's name gets
   the width: "Punctuate with silence" sets on one line at 390. */
const RECORD_GRID =
  "grid grid-cols-[40px_minmax(0,1fr)_36px_28px_30px] min-[360px]:grid-cols-[40px_minmax(0,1fr)_36px_28px_30px_28px] gap-1";
/* The table while every row waits keeps the old grid (#394), with the
   Index column at the Go pill's 56px (D11), since a 44px pill in a 44px
   column is a circle and Record is the only circle. */
const WAITING_GRID =
  "grid grid-cols-[40px_minmax(0,1fr)_56px_36px_36px] min-[360px]:grid-cols-[40px_minmax(0,1fr)_56px_36px_36px_36px] gap-1.5";
/* Under 360px the held column steps out of the recordings table, so a
   lesson's name wraps between its words: at 320 the column was 87px and
   "Punctuate" broke inside itself (the fix round). Held pauses are in
   What moved above and on every recording's own page. */
const HELD_CELL = "max-[359px]:hidden";

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
/** "4 Oct": a date as the hill's ends say it. */
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Where the Log was scrolled when a recording was opened from it. */
const PLACE_KEY = "ethos.log.place";

function keepPlace() {
  try {
    sessionStorage.setItem(PLACE_KEY, String(window.scrollY));
  } catch {}
}

export default function HistoryPage() {
  const [reps, setReps] = useState<RepRow[] | null>(null);
  /** Every recording, a few columns each: the counts and Day 1. */
  const [spine, setSpine] = useState<RepSpine[]>([]);
  /* The clock the free window is cut against, read when the data
     lands rather than on every render. */
  const [readAt, setReadAt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [paywall, setPaywall] = useState<PaywallAsk | null>(null);
  // Back from the paywall's account doors or Checkout's back arrow
  // (paywall=1): the sheet opens again where it was.
  usePaywallReturn(() => setPaywall({ reason: "Premium" }));
  /** The plan: null until the profile answers, and on a failed read.
   *  Unknown is never free (#353): no cut, no teaser, until it says so. */
  const [premium, setPremium] = useState<boolean | null>(null);
  // Whether a waiting row's Go meets the unit's teaching screen first, as
  // Today's Start does (#232: the introduction can turn intros off).
  const [skipIntros, setSkipIntros] = useState(false);
  useEffect(() => {
    setSkipIntros(readPrefs().skipIntros);
  }, []);
  /** The plan's read failed: unknown for good, drawn unlocked, never as a teaser. */
  const [planFailed, setPlanFailed] = useState(false);
  const [showFillers, setShowFillers] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setReps(null);
    // The newest 90 whole rows for the tables, and every recording's
    // date, stars and Index for the counts and Day 1, which the newest 90
    // stopped holding past 90 recordings.
    const read = await readable(() => Promise.all([fetchReps(), fetchRepSpine()]));
    if (read.ok) {
      setReadAt(Date.now());
      setSpine(read.data[1]);
      setReps(read.data[0]);
    } else setFailed(true);
  }, []);

  /*
   * The Log's place, kept across opening a recording. Both ways back (the
   * recording's "Log" link, a push, and the browser's back, whose restore
   * runs against the short skeleton page) landed near the top. Read and
   * cleared once, after the rows have landed, so the scroll is measured
   * against the real page; opening the Log from its tab still starts at
   * the top.
   */
  useEffect(() => {
    if (reps === null) return;
    let y: number | null = null;
    try {
      const raw = sessionStorage.getItem(PLACE_KEY);
      sessionStorage.removeItem(PLACE_KEY);
      y = raw === null ? null : Number(raw);
    } catch {}
    if (y !== null && Number.isFinite(y) && y > 0) window.scrollTo({ top: y });
  }, [reps]);

  useEffect(() => {
    void load();
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => setPlanFailed(true));
  }, [load]);

  /*
   * The failure and the empty state have to be different screens. They
   * were the same one: a dead connection rendered "Nothing logged yet"
   * over a sleeping Demos, which tells someone with sixty recordings
   * that they have none.
   */
  if (failed) {
    return (
      <main className="px-5 pb-[var(--nav-clear)] pt-7">
        <ScreenHeader title="Log" />
        <ErrorState
          className="mt-5"
          {...readFailure("The log")}
          onRetry={() => void load()}
        />
      </main>
    );
  }

  if (reps === null) {
    return (
      <main className="px-5 pb-[var(--nav-clear)] pt-7">
        <ScreenHeader title="Log" />
        <SkeletonRegion label="Loading your log">
          {/* The score card carries no outer margin any more (#234), so
              the placeholder holds the same 20 the real card sits on
              (system-7: the first block is mt-5 on every tab). */}
          {/* Nothing under the title: the count line is gone (#317), and
              a placeholder for it pushed the card 20px when the data
              landed. */}
          <div className="mt-5">
            <SkeletonScoreCard />
          </div>
          {/* The two tables at their own row heights (PRINCIPLES 8):
              the head, the column heads, four 45px metric rows and the
              Premium row, the insight, then 69px recording rows. */}
          <Line className="section-head mt-7" width="w-32" />
          <div className="label-micro invisible mt-3 pb-1.5">Ag</div>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`${MOVED_GRID} items-center border-t border-hairline py-3`}
            >
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="ml-auto h-3 w-6" />
              <Skeleton className="ml-auto h-4 w-8" />
              <Skeleton className="ml-auto h-3 w-10" />
              <Skeleton className={`h-5 w-full ${TREND_CELL}`} />
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-hairline py-3">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-[21px] w-20" rounded="rounded-full" />
          </div>
          <Skeleton className="mt-3 h-[58px] w-full" rounded="rounded-none" />
          <Line className="section-head mt-7" width="w-40" />
          <div className="label-micro invisible mt-3 pb-1.5">Ag</div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`${RECORD_GRID} items-center border-t border-hairline py-3`}
            >
              <Skeleton className="h-11 w-10" rounded="rounded-[10px]" />
              <span className="min-w-0">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="mt-2 h-2.5 w-12" />
              </span>
              <Skeleton className="ml-auto h-4 w-9" />
              <Skeleton className="ml-auto h-3 w-4" />
              <Skeleton className="ml-auto h-3 w-7" />
              <Skeleton className={`ml-auto h-3 w-4 ${HELD_CELL}`} />
            </div>
          ))}
        </SkeletonRegion>
      </main>
    );
  }

  const empty = reps.length === 0;
  const starMap = starsByLesson(spine);
  const scored = spine.filter((r) => r.ethos_index !== null);
  const firstIndex = scored[0]?.ethos_index ?? null;
  const lastIndex = scored[scored.length - 1]?.ethos_index ?? null;
  // Against the FIRST scored recording, as on Home: the arc, not the
  // last step.
  const indexDelta =
    lastIndex !== null && firstIndex !== null && scored.length > 1
      ? lastIndex - firstIndex
      : null;

  /* The stage already carries the Index and its change since day one
     (D32), so What moved starts at the first thing under it. */
  const rows = movedRows(reps).filter((row) => row.key !== "index");
  const presence = presenceRow(reps);
  const skills = skillRows(reps);
  const heatCount = fillerHeatmap(reps).reduce((a, b) => a + b, 0);
  const top = insights(reps)[0];

  // The 7-day window used to apply to everyone, premium included — the
  // limit was a constant rather than a gate. It reads the entitlement now.
  const days = premium === false ? limit(FREE_DAYS, false) : null;
  const cutoff = days === null ? -Infinity : readAt - days * 86_400_000;
  const visible = reps.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  // Held back by the free window, counted over every recording.
  const hidden =
    days === null
      ? 0
      : spine.filter((r) => new Date(r.created_at).getTime() < cutoff).length;
  const newestFirst = [...visible].reverse();
  const since =
    spine.length === 0
      ? null
      : new Date(spine[0].created_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });

  return (
    <main className="px-5 pb-[var(--nav-clear)] pt-7">
      {/* One entrance per band (#245). The read landing is still one
          event, but the two tables are lists, and a list assembles
          itself: `.stagger` ladders each section's eyebrow, column head
          and rows 40ms apart. It REPLACES the block's `.arrive` — a row
          that both fades with its parent and fades on its own clock
          arrives twice and reads as neither. */}
      {/* Outside the arrival on purpose: the loading state draws this
          exact h1, so fading it in with the read would take a title
          that is already on the screen down to nothing and back. */}
      <ScreenHeader title="Log" />
      <div className="arrive">

        {/*
         * Band one: the hero (#217). The card Home draws, so the log is
         * no longer the one data screen without a landing point, and the
         * day-zero card (#213) finally has the populated twin it was
         * drawn against. The footer anchors the delta without a second
         * card.
         */}
        <div className="mt-5">
          {/* The house stage (the cohesion pass): the number, its change,
              the counts, and the Index's own history as the art. "Day 1
              scored" left the foot: "since day one" says it, and What
              moved prints the Day 1 column under it. */}
          <ScoreCard
            index={lastIndex}
            delta={indexDelta}
            recordings={spine.length}
            stars={totalStars(starMap)}
            series={scored.map((r) => r.ethos_index as number)}
            span={
              scored.length > 1
                ? [shortDate(scored[0].created_at), shortDate(scored[scored.length - 1].created_at)]
                : undefined
            }
            demos
          />
        </div>
      </div>

      {/*
       * Band two: what moved. One table in place of five sparkline
       * cards, the comparison card and a column of insight prose. The
       * change column is what the reader used to compute.
       */}
      <section className="stagger mt-7">
        <h2 className="section-head">What moved</h2>
        <div className={`${MOVED_GRID} mt-3 pb-1.5`}>
          <ColumnHead>metric</ColumnHead>
          <ColumnHead right>day 1</ColumnHead>
          <ColumnHead right>now</ColumnHead>
          <ColumnHead right>change</ColumnHead>
          <ColumnHead right className={TREND_CELL}>
            trend
          </ColumnHead>
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
                aria-controls="filler-heatmap"
                onClick={() => setShowFillers((v) => !v)}
                className="press-row block w-full text-left"
              >
                <MetricRow row={row} dim={empty} open={showFillers} />
              </button>
              {showFillers && (
                /* `.reveal`: the panel drops out of the row that opened
                   it, rather than being there the instant the row is
                   tapped (the before strip was five identical frames). */
                <div id="filler-heatmap" className="reveal py-3">
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
          (premium === null && !planFailed ? (
            <PlanRowSkeleton />
          ) : premium !== false ? (
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
          (premium === null && !planFailed ? (
            <PlanRowSkeleton />
          ) : premium !== false ? (
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
            A rule, not a box: it annotates the table, it is no card.
            Since the cohesion pass the rule is the only colour: no wash
            behind it (it read as a maroon callout in dark), the words in
            ink. */}
        {top && (
          <p
            data-trait={INSIGHT_TRAIT[top.id]}
            className="border-t border-hairline pt-3 text-caption text-stone-600"
          >
            {/* D32: the trait's 8px square leads the line, the swatch
                the rows above wear, where a pink side rule stood alone;
                the number in it is the weight. */}
            <span className="flex items-center gap-2 font-medium text-ink">
              {INSIGHT_TRAIT[top.id] && <span aria-hidden className="log-swatch mr-0!" />}
              <span>
                {top.headline.split(/(\d+%)/).map((part, i) =>
                  /^\d+%$/.test(part) ? (
                    <b key={i} className="font-bold">
                      {part}
                    </b>
                  ) : (
                    part
                  )
                )}
              </span>
            </span>
            {/* Its own line: the headline has no full stop, so run on
                it read "of your fillers 70 of 132" (log-18). */}
            <span className={`mt-0.5 block ${INSIGHT_TRAIT[top.id] ? "pl-4" : ""}`}>{top.detail}</span>
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
        <h2 className="section-head">
          {empty ? "Waiting to be logged" : "Every recording"}
        </h2>
        <div aria-hidden className={`${empty ? WAITING_GRID : RECORD_GRID} mt-3 pb-1.5`}>
          <ColumnHead>date</ColumnHead>
          <ColumnHead>lesson</ColumnHead>
          <ColumnHead right>index</ColumnHead>
          <ColumnHead right>fill</ColumnHead>
          <ColumnHead right>wpm</ColumnHead>
          <ColumnHead right className={HELD_CELL}>
            held
          </ColumnHead>
        </div>

        {empty
          ? waitingRows(3, { intros: !skipIntros }).map((row) => (
              <div
                key={row.id}
                className={`${WAITING_GRID} items-center border-t border-hairline py-3 text-stone-400`}
              >
                <DateTile trait={recordingTrait({ lesson_id: row.id })}>
                  <span className="font-display block text-num-s tabular-nums">
                    {row.n}
                  </span>
                </DateTile>
                {/* Two lines, never an ellipsis, as a logged row's name
                    (#287): at 320 "Silence beats 'um'" truncated. */}
                <span className="font-display line-clamp-2 text-row leading-snug">
                  {row.title}
                </span>
                {/* Go stands in the Index column, where this lesson's
                    Index will land once it is recorded; the other
                    columns keep their dashes. The secondary control
                    (#234: surface, a rule edge, no shadow), the same
                    three times: three terracotta fills would be three
                    primaries on a screen that has none. */}
                <Link
                  href={row.href}
                  aria-label={row.label}
                  className="press font-display flex min-h-11 min-w-14 items-center justify-center justify-self-end rounded-tap border border-edge bg-surface px-4 text-row text-ink"
                >
                  Go
                </Link>
                {[0, 1, 2].map((c) => (
                  <span
                    key={c}
                    className={`font-display text-right text-caption font-extrabold tabular-nums ${
                      c === 2 ? HELD_CELL : ""
                    }`}
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
              const name = recordingName(r);
              /* log-21: the row's name, not four bare numbers. The
                 column heads are hidden from assistive tech, so the
                 label carries what they said. */
              const label = `${name}, ${d.toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
              })}, ${
                r.ethos_index === null ? "not scored" : `Ethos ${r.ethos_index}`
              }, ${r.stars} of 3 stars`;
              return (
                <Link
                  key={r.id}
                  href={`/rep/${r.id}`}
                  onClick={keepPlace}
                  aria-label={label}
                  className={`press-row ${RECORD_GRID} items-center border-t border-hairline py-3`}
                >
                  {/* D33: the day over its month, bare. The tile's fill
                      and its tone bar were a second grid of colour, and
                      its OCT the column's twelfth capital. */}
                  <span className="flex flex-col items-start leading-none">
                    <span className="font-display text-num-s tabular-nums">{d.getDate()}</span>
                    <span className="mt-1 text-caption font-medium text-stone-500">
                      {d.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                  </span>
                  <span className="min-w-0">
                    {/* One line at 390, two at most at 320, never an
                        ellipsis (#287): the number columns gave the
                        lesson its width (D33). */}
                    <span className="font-display line-clamp-2 text-row leading-snug">
                      {name}
                    </span>
                    <Stars n={r.stars} size={10} />
                  </span>
                  <span className="font-display text-right text-num-s tabular-nums">
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
                  <Cell className={HELD_CELL}>{held}</Cell>
                </Link>
              );
            })}

        {premium === false && hidden > 0 && (
          <button
            onClick={() =>
              setPaywall({
                reason: "Full history · premium",
                headline: "Your first recording is still here.",
              })
            }
            /* mt-2: air between the last tile and the plum chip, so a
               Variety tile's indigo never sits against Premium's plum. */
            className="press-row mt-2 flex w-full items-center justify-between gap-3 border-t border-hairline py-3 text-left"
          >
            <span className="text-caption text-stone-500">
              {hidden} older recording{hidden === 1 ? "" : "s"} held since{" "}
              {since}.
            </span>
            {/* Terracotta said "tap" on a row that was already a
                button, so the accent was carrying no information the
                row did not already carry. The mark carries the tier
                instead (#280), here as the door with its word (the
                mark for a row that is the door itself): its capitals
                chip made the free Log's fourth caps line in one
                viewport, over the three (D10). */}
            <PremiumDoor className="shrink-0 font-display text-link text-plum-700">Premium</PremiumDoor>
          </button>
        )}
      </section>

      {/* Day zero (#213): the dashes say what fills in, and the Go on
          each waiting row is the way in (notes1: Start went). Demos is
          on the stage above, so the line stands without him: one Demos
          per screen. */}
      {empty && (
        <p className="arrive mt-3 text-caption text-stone-500">
          One recording and every number here fills in.
        </p>
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

/**
 * One line of type at its role's own height, the words invisible and a
 * bar where they would be (the score card skeleton's trick), so the
 * head that replaces it is the same height to the pixel.
 */
function Line({ className, width }: { className: string; width: string }) {
  return (
    <div className={`relative ${className}`}>
      <span className="invisible">Ag</span>
      <Skeleton className={`absolute inset-y-[22%] left-0 ${width}`} />
    </div>
  );
}

function ColumnHead({
  children,
  right = false,
  className = "",
}: {
  children: string;
  right?: boolean;
  className?: string;
}) {
  return (
    <span className={`label-micro whitespace-nowrap ${right ? "flex justify-end text-right" : ""} ${className}`}>
      {children}
    </span>
  );
}

function Cell({ children, className = "" }: { children: number; className?: string }) {
  return (
    <span
      className={`font-display text-right text-caption font-extrabold text-stone-600 tabular-nums ${className}`}
    >
      {children}
    </span>
  );
}

/** "All fillers / min" with no-break thin spaces round the slash, so a
    narrow column breaks between words and never at the unit. */
const unitLabel = (label: string) => label.replace(/ \/ /g, "\u202F/\u202F");

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
  // The accent rule (the cohesion pass): a trait's row keeps its tone on
  // the 8px swatch and the trend's line, its label in ink. The Index row
  // is neutral, its swatch and line in stone: the score's colour was the
  // deep sage card's, and that card is the stage now.
  const index = row.key === "index";
  const tone =
    row.direction === "up"
      ? "text-sage-700"
      : row.direction === "down"
        ? "text-rust"
        : "text-stone-400";
  return (
    /* A span (log-21): the Fillers row sits inside a button, where only
       phrasing content is valid. The grid class makes it a block. */
    <span
      data-trait={trait ?? undefined}
      data-index={index || undefined}
      className={`log-metric ${MOVED_GRID} items-center border-t border-hairline py-3 ${
        dim ? "text-stone-400" : ""
      }`}
    >
      <span className="font-display flex min-w-0 items-center gap-1 text-row">
        {/* The trait's swatch, the key the recordings below are
            coloured by. A rectangle, like every mark that is not a
            chip. A row with no trait keeps the slot, blank, so every
            label in the column starts at the same x. */}
        <span
          aria-hidden
          className={`log-swatch ${trait || index ? "" : "log-swatch-blank"}`}
        />
        {/* Two lines at most, never an ellipsis: at 320px "Fillers /
            min" beside its chevron cut to "Fillers / ...". A unit's slash
            holds its words together (no-break thin spaces), so the label
            breaks between words and never at the slash, and the chevron
            follows the label's last word rather than the column's edge
            (the fix round). */}
        <span className="line-clamp-2 min-w-0 leading-tight">
          {open === undefined ? (
            unitLabel(row.label)
          ) : (
            <>
              {unitLabel(row.label)}
              <span
                aria-hidden
                data-open={open}
                className="disclosure-mark ml-0.5 align-[-2px] text-stone-400"
              >
                <IconChevron size={14} />
              </span>
            </>
          )}
        </span>
      </span>
      <span
        className={`font-display text-right text-caption font-extrabold tabular-nums ${
          dim ? "" : "text-stone-400"
        }`}
      >
        {row.then ?? DASH}
      </span>
      <span className="font-display text-right text-num-s tabular-nums">
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
        className={`font-display flex justify-end whitespace-nowrap text-right text-caption font-extrabold tabular-nums ${
          dim ? "" : tone
        }`}
      >
        {row.change ?? DASH}
      </span>
      {/* log-23: the track draws a trailing mean of three, so a noisy
          series reads as a direction; every point stays, so the line
          still starts at the Day 1 value, and the label reads the raw
          numbers. */}
      <span className={`block ${TREND_CELL}`}>
        <Sparkline
          values={rolling(row.series, 3)}
          labelValues={row.series}
          label={row.label}
          invert={row.invert}
          height={20}
          bare
          color={trait ? "var(--tone)" : index ? "var(--color-stone-500)" : undefined}
          wash={false}
        />
      </span>
    </span>
  );
}

/**
 * A waiting row's number as a small tile (#394, unchanged): the plain
 * surface and the ink, with the trait the lesson practises as a short
 * bar in its tone at the tile's foot. A logged recording's date is a
 * bare column since D33.
 */
function DateTile({
  trait,
  children,
}: {
  trait: TraitId | null;
  children: ReactNode;
}) {
  return (
    <span data-trait={trait ?? undefined} className="log-date">
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
      className="press-row flex w-full items-center justify-between gap-3 border-t border-hairline py-3 text-left"
    >
      <span className="font-display flex min-w-0 items-center gap-1 text-row">
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

/**
 * A Premium row while the plan is unknown: the teaser's own height, so
 * nothing moves when the plan lands, and never the PREMIUM chip over a
 * plan that may be paid (#353).
 */
function PlanRowSkeleton() {
  return (
    <div
      aria-hidden
      className="flex items-center justify-between border-t border-hairline py-3"
    >
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-[21px] w-20" rounded="rounded-full" />
    </div>
  );
}
