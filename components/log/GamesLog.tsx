"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CountUp } from "@/components/CountUp";
import { Disclosure } from "@/components/ui/Disclosure";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import {
  fetchGameRounds,
  fetchPracticeTakes,
  heldGameRounds,
  heldPracticeTakes,
} from "@/lib/client-data";
import { gamesLog, type GamesLog as GamesLogData, type GamesLogRow } from "@/lib/games-log";
import { readable, readFailure } from "@/lib/load";
import { DURATION } from "@/lib/motion";
import { useRevalidate } from "@/lib/use-revalidate";
import { useStill, useWarm } from "@/lib/use-warm";

const DASH = "—";

/* The Daily table's row (app/history/page.tsx RECORD_GRID): the day over
   its month in a bare 40px column, the name with one line under it, the
   Index, the row's chevron. One number column, so the name keeps the
   width. */
const GRID = "grid grid-cols-[40px_minmax(0,1fr)_40px_8px] gap-x-1.5";

/** Both reads, as the Games side lists them, or null while either is out. */
function heldLog(): GamesLogRow[] | null {
  const games = heldGameRounds();
  const takes = heldPracticeTakes();
  return games && takes ? [...games, ...takes] : null;
}

/**
 * The Log's Games side (#486): the weekly boss, a row a week taken, and
 * every game and Hostile Q&A round, each a door to its recording, in the
 * Daily table's grammar (lib/games-log.ts assembles both lists).
 *
 * The boss's weeks were six squares under /boss's stage ("Last six
 * weeks"), which told someone who had never taken one nothing, and
 * someone who had little more than an Index with no topic. Here a week
 * is its topic, its Index, its date and its fact-check, newest first;
 * with none, one line says what lands here and where to take one.
 *
 * Not cut to the free plan's seven days: the boss's weeks never were
 * (the lobby showed six to everyone), and a game's rounds are its
 * ladder, which Practice reads whole.
 */
export function GamesLog() {
  const warm = useWarm();
  const [rows, setRows] = useState<GamesLogRow[] | null>(() => (warm ? heldLog() : null));
  const [failed, setFailed] = useState(false);
  /** Rows are on screen: a later read is quiet, and its failure leaves them. */
  const drawn = useRef(rows !== null);
  useStill(drawn.current);

  const load = useCallback(async () => {
    setFailed(false);
    const read = await readable(() => Promise.all([fetchGameRounds(), fetchPracticeTakes()]));
    if (read.ok) {
      drawn.current = true;
      setRows([...read.data[0], ...read.data[1]]);
    } else if (!drawn.current) setFailed(true);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // Looked at again after a while, or back on the network: read again, quietly.
  useRevalidate(() => void load());

  if (failed) {
    return <ErrorState className="mt-5" {...readFailure("Your games")} onRetry={() => void load()} />;
  }
  if (rows === null) return <GamesSkeleton />;

  const log: GamesLogData = gamesLog(rows);
  return (
    <div className="arrive">
      <section aria-labelledby="games-boss" className="stagger mt-5">
        <h2 id="games-boss" className="section-head">
          Weekly boss
        </h2>
        {log.weeks.length === 0 ? (
          <Empty>
            Take the weekly boss on <PracticeLink /> and its score lands here.
          </Empty>
        ) : (
          <>
            <Heads name="topic" />
            {log.weeks.map((w) => (
              <Row
                key={w.id}
                id={w.id}
                at={w.at}
                name={w.topic}
                line={w.accuracy === null ? null : `Accuracy ${w.accuracy}`}
                index={w.index}
              />
            ))}
          </>
        )}
      </section>

      <section aria-labelledby="games-rounds" className="stagger mt-7">
        <h2 id="games-rounds" className="section-head">
          Every round
        </h2>
        {log.rounds.length === 0 ? (
          <Empty>
            Play a game on <PracticeLink /> and every round lands here.
          </Empty>
        ) : (
          <>
            <Heads name="round" />
            {log.rounds.map((r) => (
              <Row key={r.id} id={r.id} at={r.at} name={r.name} line={r.line} index={r.index} />
            ))}
          </>
        )}
      </section>
    </div>
  );
}

/** The one door an empty list needs: Practice, where both are taken. */
function PracticeLink() {
  return (
    <Link href="/games" className="text-link text-terracotta-700">
      Practice
    </Link>
  );
}

/** One line under the head, at the rows' first line, saying what lands there. */
function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-3 border-t border-hairline pt-3 text-caption text-stone-500 text-pretty">{children}</p>;
}

/** The column heads, as the Daily table writes them (data heads, tracked caps). */
function Heads({ name }: { name: string }) {
  return (
    <div aria-hidden className={`${GRID} mt-3 pb-1.5`}>
      <span className="label-micro whitespace-nowrap">date</span>
      <span className="label-micro whitespace-nowrap">{name}</span>
      <span className="label-micro flex justify-end whitespace-nowrap text-right">index</span>
      <span />
    </div>
  );
}

/**
 * A row: the day over its month, the name with its one number line under
 * it, the Index, the chevron. A door to the stored recording, named with
 * every number it shows (#448), since the heads are hidden from a
 * screen reader.
 */
function Row({
  id,
  at,
  name,
  line,
  index,
}: {
  id: string;
  at: string;
  name: string;
  line: string | null;
  index: number | null;
}) {
  const d = new Date(at);
  const label = `${name}, ${d.toLocaleDateString(undefined, { day: "numeric", month: "long" })}, ${
    index === null ? "not scored" : `Ethos ${index}`
  }${line ? `, ${line}` : ""}`;
  return (
    <Link
      href={`/rep/${id}`}
      aria-label={label}
      className={`press-row ${GRID} items-center border-t border-hairline py-3`}
    >
      <span className="flex flex-col items-start leading-none">
        <span className="font-display text-num-s tabular-nums">{d.getDate()}</span>
        <span className="mt-1 text-caption font-medium text-stone-500">
          {d.toLocaleDateString(undefined, { month: "short" })}
        </span>
      </span>
      <span className="min-w-0">
        <span className="font-display line-clamp-2 text-row leading-snug">{name}</span>
        {line && <span className="mt-0.5 block truncate text-caption tabular-nums text-stone-500">{line}</span>}
      </span>
      <span className="font-display text-right text-num-s tabular-nums">
        {index === null ? DASH : <CountUp value={index} durationMs={DURATION.max} />}
      </span>
      <Disclosure className="justify-self-end text-stone-400" />
    </Link>
  );
}

/** Both lists at their landed heights: a head, the column heads, three 61px rows each. */
function GamesSkeleton() {
  return (
    <SkeletonRegion label="Loading your games">
      {[0, 1].map((s) => (
        <div key={s} className={s === 0 ? "mt-5" : "mt-7"}>
          <div className="section-head relative">
            <span className="invisible">Ag</span>
            <Skeleton className="absolute inset-y-[22%] left-0 w-32" />
          </div>
          <div className="label-micro invisible mt-3 pb-1.5">Ag</div>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${GRID} items-center border-t border-hairline py-3`}>
              <Skeleton className="h-9 w-7" />
              <span className="min-w-0">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="mt-2 h-2.5 w-24" />
              </span>
              <Skeleton className="ml-auto h-4 w-9" />
              <span />
            </div>
          ))}
        </div>
      ))}
    </SkeletonRegion>
  );
}
