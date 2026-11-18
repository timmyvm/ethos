"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { LogRow, LogRowSkeleton } from "@/components/log/LogRow";
import {
  fetchGameRounds,
  fetchPracticeTakes,
  heldGameRounds,
  heldPracticeTakes,
} from "@/lib/client-data";
import { gamesLog, type GamesLog as GamesLogData, type GamesLogRow } from "@/lib/games-log";
import { readable, readFailure } from "@/lib/load";
import { dayWords } from "@/lib/log";
import { useRevalidate } from "@/lib/use-revalidate";
import { useStill, useWarm } from "@/lib/use-warm";

/** Both reads, as the Games side lists them, or null while either is out. */
function heldLog(): GamesLogRow[] | null {
  const games = heldGameRounds();
  const takes = heldPracticeTakes();
  return games && takes ? [...games, ...takes] : null;
}

/**
 * The Log's Games side (#486): the weekly boss, a row a week taken, and
 * every game and Hostile Q&A round, each a door to its recording, in the
 * Daily side's row since #506 (`LogRow`: the name, one quiet line with
 * the day and the round's one number in words, the Ethos number, the
 * chevron), so the switch never flips into a table of caps heads
 * (DATE / TOPIC / INDEX went). lib/games-log.ts assembles both lists.
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
          <div className="mt-1">
            {log.weeks.map((w, i) => (
              <Row
                key={w.id}
                id={w.id}
                at={w.at}
                name={w.topic}
                line={w.accuracy === null ? null : `Accuracy ${w.accuracy}`}
                index={w.index}
                first={i === 0}
              />
            ))}
          </div>
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
          <div className="mt-1">
            {log.rounds.map((r, i) => (
              <Row key={r.id} id={r.id} at={r.at} name={r.name} line={r.line} index={r.index} first={i === 0} />
            ))}
          </div>
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

/**
 * A row: the name, the day and the round's one number in words on the
 * quiet line under it, the Ethos number, the chevron (`LogRow`). A door
 * to the stored recording, named with every number it shows (#448).
 */
function Row({
  id,
  at,
  name,
  line,
  index,
  first,
}: {
  id: string;
  at: string;
  name: string;
  line: string | null;
  index: number | null;
  first: boolean;
}) {
  const day = dayWords(at);
  const label = `${name}, ${day}, ${line ? `${line}, ` : ""}${index === null ? "not scored" : `Ethos ${index}`}`;
  return (
    <LogRow
      href={`/rep/${id}`}
      title={name}
      meta={
        <>
          <span className="shrink-0">{day}</span>
          {line && (
            <>
              <span aria-hidden className="shrink-0 text-stone-400">
                ·
              </span>
              <span className="min-w-0 truncate tabular-nums">{line}</span>
            </>
          )}
        </>
      }
      index={index}
      label={label}
      first={first}
    />
  );
}

/** Both lists at their landed heights: a head and three one-line rows each. */
function GamesSkeleton() {
  return (
    <SkeletonRegion label="Loading your games">
      {[0, 1].map((s) => (
        <div key={s} className={s === 0 ? "mt-5" : "mt-7"}>
          <div className="section-head relative">
            <span className="invisible">Ag</span>
            <Skeleton className="absolute inset-y-[22%] left-0 w-32" />
          </div>
          <div className="mt-1">
            {["w-3/4", "w-2/3", "w-4/5"].map((w, i) => (
              <LogRowSkeleton key={w} first={i === 0} width={w} />
            ))}
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}
