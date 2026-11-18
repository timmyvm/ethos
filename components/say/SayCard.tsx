"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Disclosure } from "@/components/ui/Disclosure";
import { ErrorLine } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SayArt, SaySlots } from "@/components/say/parts";
import { heldReps } from "@/lib/client-data";
import { todayHref } from "@/lib/home";
import { readable } from "@/lib/load";
import { poolHere } from "@/lib/pool";
import { dayOf, emptyLine, nextDue, nextTestLine, sayLists, testLabel } from "@/lib/say";
import { fetchSay, heldSay, type SayRead } from "@/lib/say-store";
import { useRevalidate } from "@/lib/use-revalidate";
import { useWarm } from "@/lib/use-warm";
import { ACTION_CLASS } from "@/lib/ui";

/**
 * You's first card (DECISIONS #507): Say it better, above the identity
 * card, which breaks #485's order on purpose: Timothy, 18 Nov, "make it a
 * focus ... that's how you actually improve". The screen's one lifted
 * thing (`elev-2`), holding its one tap: the day's test. Then the door to
 * the whole page.
 *
 * The number is the page's: "4 of 11 you now say on your own", a slot
 * for each swap filling in sage. On a day with nothing due the tap goes
 * and the card says when the next test is; on a new account it says
 * where the first one comes from, with the tap to today's practice.
 *
 * `quiet` puts the tap on the surface while the account gate below holds
 * the screen's one filled tap (DESIGN rule 2).
 */
export function SayCard({ quiet = false }: { quiet?: boolean }) {
  const warm = useWarm();
  const [read, setRead] = useState<SayRead | null>(() => (warm ? heldSay() : null));
  const drawn = useRef(read !== null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setFailed(false);
    const got = await readable(() => fetchSay());
    if (got.ok) {
      drawn.current = true;
      setRead(got.data);
    } else if (!drawn.current) setFailed(true);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useRevalidate(() => void load());

  const today = dayOf(new Date());
  const lists = read ? sayLists(read.items, today) : null;
  const tap = quiet
    ? "press font-display flex min-h-12 w-full items-center justify-center rounded-tap bg-surface px-6 py-3.5 text-body font-bold"
    : ACTION_CLASS;

  return (
    <section aria-labelledby="say-card-title" data-look="say-card" className="card elev-2 relative mt-5 overflow-hidden p-5">
      {/* The boomerang, standing in the card's corner, as Today's card stands its object. */}
      <SayArt className="pointer-events-none absolute -top-1 right-2 size-[92px]" />
      <h2 id="say-card-title" className="section-head pr-24">
        Say it better
      </h2>

      {failed ? (
        <ErrorLine className="mt-3" onRetry={() => void load()}>
          Say it better didn&apos;t load.
        </ErrorLine>
      ) : !lists ? (
        <div aria-busy="true" aria-label="Loading Say it better">
          <Skeleton className="mt-3 h-9 w-24" />
          <Skeleton className="mt-2 h-4 w-44" />
          <Skeleton className="mt-3 h-1 w-full" rounded="rounded-none" />
          <Skeleton className="mt-5 h-12 w-full" rounded="rounded-tap" />
        </div>
      ) : lists.m === 0 ? (
        <div className="arrive">
          <p className="mt-1.5 max-w-[24ch] text-body text-pretty text-stone-500">{emptyLine(read!.items.length > 0)}</p>
          <Link href={todayHref(heldReps() ?? [], new Date(), poolHere())} className={`${tap} mt-5`}>
            Today&apos;s practice
          </Link>
        </div>
      ) : (
        <div className="arrive">
          <p className="mt-2 flex items-baseline gap-1.5" data-say-count>
            <span className="font-display text-num-l tabular-nums text-sage-700">{lists.n}</span>
            <span className="font-display text-detail tabular-nums text-stone-500">of {lists.m}</span>
          </p>
          <p className="text-body text-stone-500">you now say on your own</p>
          <SaySlots n={lists.n} m={lists.m} className="mt-3" />
          {lists.due.length > 0 ? (
            <Link href="/say/test" data-say-test className={`${tap} mt-5`}>
              {testLabel(lists.due.length)}
            </Link>
          ) : (
            (() => {
              const next = nextDue(read!.items, today);
              return next ? <p className="mt-4 text-body text-stone-500">{nextTestLine(next, today)}</p> : null;
            })()
          )}
        </div>
      )}

      {/* The door to the whole page: its own row at the card's foot. A
          new account has nothing there yet, so its card ends on its tap. */}
      {!(lists && lists.m === 0) && (
        <Link
          href="/say"
          data-say-door
          className="press-row -mx-5 -mb-5 mt-4 flex min-h-12 items-center justify-between gap-3 border-t border-hairline px-5 py-3 text-row"
        >
          <span className="font-display">
            See all{lists ? <span className="tabular-nums"> {lists.m}</span> : null}
          </span>
          <Disclosure />
        </Link>
      )}
    </section>
  );
}
