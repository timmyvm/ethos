"use client";

import { ScreenHeader } from "@/components/ui/ScreenHeader";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PremiumDoor } from "@/components/PremiumMark";
import { Paywall } from "@/components/LazyPaywall";
import type { PaywallAsk } from "@/components/Paywall";
import { SkeletonLogStage, SkeletonRegion } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  fetchProfile,
  fetchRepSpine,
  fetchReps,
  heldPremium,
  heldReps,
  heldSpine,
  type RepRow,
  type RepSpine,
} from "@/lib/client-data";
import { useRevalidate } from "@/lib/use-revalidate";
import { useStill, useWarm } from "@/lib/use-warm";
import { limit } from "@/lib/entitlement";
import { readable, readFailure } from "@/lib/load";
import { bestRecording, dayWords, logList, recordingTopic } from "@/lib/log";
import { poolHere } from "@/lib/pool";
import { ACTION_CLASS } from "@/lib/ui";
import { usePaywallReturn } from "@/lib/use-paywall-return";
import { GamesLog } from "@/components/log/GamesLog";
import { LogSwitch, useLogView } from "@/components/log/LogSwitch";
import { LogRow, LogRowSkeleton } from "@/components/log/LogRow";
import { LogStage } from "@/components/log/LogStage";

const FREE_DAYS = 7; // mechanics.md: free tier sees the last 7 days
/** Rows whose number counts in as it lands: more than a first screen holds. */
const COUNTED_ROWS = 8;

/**
 * The Log (#17, #217; made simple in #506). Timothy, 18 Nov: "what am I
 * even looking at when I see the log? ... It's really, really tight ...
 * especially in the what moved, like, what am I even looking at? ... no
 * one's gonna really consume that. And even if they do, what are they
 * gonna do with that information".
 *
 * So the Daily side is one picture and one list, and every element
 * answers "what do I do with this?":
 *
 *  - The stage (`LogStage`): the Ethos number now, whether it is up or
 *    down since you started, and one line between the two. Keep going.
 *  - "Recordings 22": every recording, newest first, each named by what
 *    you talked about with its day under it and its Ethos number, the
 *    all-time best wearing the gold cup. Tap one to hear it again: it
 *    opens its stored results.
 *  - On the free plan, the recordings past seven days are counted, with
 *    how far back they go, and the Premium door to them.
 *
 * What moved (its three measures, Day 1, Now, Change and the trend
 * sparklines), the filler heatmap under it, the insight line, the
 * Premium "Every skill" and Presence trendlines, the column heads and
 * each row's stars went with #506. A recording's own numbers are on its
 * page; each trait's latest reading is on Lessons and You.
 */
/** "4 Oct": a date as the free plan's foot row says it. */
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
  /* What this visit last read (#433, lib/held.ts): the Log opens on its
     rows in the first frame and reads them again behind that. Never
     while the server's page hydrates (`warm`). */
  const warm = useWarm();
  const [reps, setReps] = useState<RepRow[] | null>(() => (warm && heldSpine() ? heldReps() : null));
  /** Every recording, a few columns each: the counts and Day 1. */
  const [spine, setSpine] = useState<RepSpine[]>(() => (warm ? heldSpine() : null) ?? []);
  /** Rows are on screen: a later read is quiet, and its failure leaves them. */
  const drawn = useRef(reps !== null);
  useStill(drawn.current);
  /* What the visit held was drawn in the first frame: its line is
     already there, and drawing it again would replay a value (#433). */
  const [heldAtMount] = useState(() => drawn.current);
  /* The clock the free window is cut against, read when the data
     lands rather than on every render. */
  const [readAt, setReadAt] = useState(() => (drawn.current ? Date.now() : 0));
  const [failed, setFailed] = useState(false);
  const [paywall, setPaywall] = useState<PaywallAsk | null>(null);
  // Back from the paywall's account doors or Checkout's back arrow
  // (paywall=1): the sheet opens again where it was.
  usePaywallReturn(() => setPaywall({ reason: "Premium" }));
  /** The plan: null until the profile answers, and on a failed read.
   *  Unknown is never free (#353): no cut, no teaser, until it says so. */
  const [premium, setPremium] = useState<boolean | null>(() => (warm ? heldPremium() : null));
  /* Daily or Games (#486): Daily is everything below; Games is
     components/log/GamesLog.tsx, in the same row (#506). */
  const [view, setView] = useLogView(warm);

  const load = useCallback(async () => {
    setFailed(false);
    // Rows on screen stay there while they are read again (#433).
    if (!drawn.current) setReps(null);
    // The newest 90 whole rows for the tables, and every recording's
    // date, stars and Index for the counts and Day 1, which the newest 90
    // stopped holding past 90 recordings.
    const read = await readable(() => Promise.all([fetchReps(), fetchRepSpine()]));
    if (read.ok) {
      drawn.current = true;
      setReadAt(Date.now());
      setSpine(read.data[1]);
      setReps(read.data[0]);
    } else if (!drawn.current) setFailed(true);
  }, []);
  // Looked at again after a while, or back on the network: read again, quietly.
  useRevalidate(() => void load());

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
      // A failed read leaves the plan unknown, and unknown is never free
      // (#353): no window is cut and no door is drawn.
      .catch(() => {});
  }, [load]);

  /*
   * The failure and the empty state have to be different screens. They
   * were the same one: a dead connection rendered "Nothing logged yet"
   * over a sleeping Demos, which tells someone with sixty recordings
   * that they have none.
   */
  if (view === "games") {
    return (
      <main className="px-5 pb-[var(--nav-clear)] pt-7">
        <ScreenHeader title="Log" />
        <LogSwitch view={view} onChange={setView} />
        <GamesLog />
      </main>
    );
  }

  if (failed) {
    return (
      <main className="px-5 pb-[var(--nav-clear)] pt-7">
        <ScreenHeader title="Log" />
        <LogSwitch view={view} onChange={setView} />
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
        <LogSwitch view={view} onChange={setView} />
        <SkeletonRegion label="Loading your log">
          {/* The landed page's own heights (PRINCIPLES 8): the stage, the
              list's head, three one-line rows. */}
          <div className="mt-5">
            <SkeletonLogStage />
          </div>
          <div className="mt-7 flex items-baseline">
            <span className="section-head relative">
              <span className="invisible">Recordings</span>
              <span aria-hidden className="skeleton absolute inset-y-[22%] left-0 block w-full rounded-control" />
            </span>
          </div>
          <div className="mt-1">
            {["w-3/4", "w-2/3", "w-4/5"].map((w, i) => (
              <LogRowSkeleton key={w} first={i === 0} width={w} />
            ))}
          </div>
        </SkeletonRegion>
      </main>
    );
  }

  /* Every recording the account holds, from the spine (#506 review): the
     whole reads stop at the newest 90 (`logList`). */
  const every: RepSpine[] = spine.length > 0 ? spine : reps;
  const empty = every.length === 0;
  const scored = every.filter((r) => r.ethos_index !== null);
  const series = scored.map((r) => r.ethos_index as number);
  const firstScored = scored[0] ?? null;
  const lastScored = scored[scored.length - 1] ?? null;
  /* The all-time best over every recording, not the seven days shown:
     the row that holds it wears the cup, if it is in the list. */
  const best = bestRecording(every);
  const isBest = (r: { id: string }) => best !== null && r.id === best.id;

  // The 7-day window used to apply to everyone, premium included: the
  // limit was a constant rather than a gate. It reads the entitlement now.
  const days = premium === false ? limit(FREE_DAYS, false) : null;
  const cutoff = days === null ? -Infinity : readAt - days * 86_400_000;
  // Held back by the free window, counted over every recording.
  const { rows: newestFirst, hidden, total } = logList<RepSpine>(spine, reps, cutoff);
  /* The topic a lesson's practice spoke on is this phone's pool's (#492),
     as the recorder resolved it. Read once per draw. */
  const pool = newestFirst.length > 0 ? poolHere() : undefined;
  const now = new Date(readAt || Date.now());

  return (
    <main className="px-5 pb-[var(--nav-clear)] pt-7">
      {/* Outside the arrival on purpose: the loading state draws this
          exact h1, so fading it in with the read would take a title
          that is already on the screen down to nothing and back. */}
      <ScreenHeader title="Log" />
      <LogSwitch view={view} onChange={setView} />
      <div className="arrive mt-5">
        <LogStage
          index={lastScored?.ethos_index ?? null}
          first={firstScored?.ethos_index ?? null}
          series={series}
          recordings={every.length}
          from={firstScored ? shortDate(firstScored.created_at) : undefined}
          to={lastScored ? shortDate(lastScored.created_at) : undefined}
          draw={!heldAtMount}
        />
      </div>

      {empty ? (
        /* Day zero (#213): the stage says the first recording starts the
           line, and the one way in is Today's practice, where day one's
           lesson waits (lib/home.ts todayHref: Today, with nothing yet).
           It replaces the three "Waiting to be logged" rows. */
        <Link href="/" className={`${ACTION_CLASS} arrive mt-3`}>
          Today&apos;s practice
        </Link>
      ) : (
        <section aria-labelledby="log-recordings" className="stagger mt-7">
          <h2 id="log-recordings" className="section-head">
            Recordings
            <span className="section-head-count">{total}</span>
          </h2>
          <div className="mt-1">
            {newestFirst.map((r, i) => {
              const topic = recordingTopic(r, pool);
              const day = dayWords(r.created_at, now);
              const top = isBest(r);
              /* The row's name says what it shows, the topic first (#448). */
              const label = `${topic}, ${day}, ${
                r.ethos_index === null ? "not scored" : `Ethos ${r.ethos_index}`
              }${top ? ", your best" : ""}`;
              return (
                <LogRow
                  key={r.id}
                  href={`/rep/${r.id}`}
                  onOpen={keepPlace}
                  title={topic}
                  meta={day}
                  index={r.ethos_index}
                  best={top}
                  label={label}
                  first={i === 0}
                  /* The first screen's numbers count in; a long
                     history's hundredth row has nothing to arrive into. */
                  count={i < COUNTED_ROWS}
                />
              );
            })}

            {premium === false && hidden > 0 && (
              <button
                onClick={() =>
                  setPaywall({
                    reason: "Full history · premium",
                    headline: "Your first recording is still here",
                  })
                }
                className="press-row flex min-h-13 w-full items-center justify-between gap-3 border-t border-hairline py-3 text-left"
              >
                <span className="text-caption text-stone-500">
                  {hidden} older recording{hidden === 1 ? "" : "s"},{" "}
                  {/* The date holds together: at 320 "5" ended a line
                      over a lone "Oct". */}
                  <span className="whitespace-nowrap">back to {shortDate(every[0].created_at)}</span>
                </span>
                {/* The mark carries the tier (#280), as the door with its
                    word: the row is the door itself. */}
                <PremiumDoor className="shrink-0 font-display text-link text-plum-700">Premium</PremiumDoor>
              </button>
            )}
          </div>
        </section>
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
