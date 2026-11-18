"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { DemosArt } from "@/components/DemosArt";
import { BackLink } from "@/components/ui/ScreenHeader";
import { ErrorLine, ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { UndoToast } from "@/components/ui/Toast";
import { SayArt, SaySlots, SwapPair } from "@/components/say/parts";
import { SwapSheet } from "@/components/say/SwapSheet";
import { heldReps } from "@/lib/client-data";
import { todayHref } from "@/lib/home";
import { readable } from "@/lib/load";
import { poolHere } from "@/lib/pool";
import {
  addDays,
  backLine,
  dayOf,
  nextDue,
  nextTestLine,
  sayLists,
  testLabel,
  timesLine,
  timesUsed,
} from "@/lib/say";
import { fetchSay, heldSay, removeSwap, restoreSwap, type SayItem, type SayRead } from "@/lib/say-store";
import { useRevalidate } from "@/lib/use-revalidate";
import { useWarm } from "@/lib/use-warm";
import { ACTION_CLASS, DISABLED_CLASS } from "@/lib/ui";

/** Where back goes: You, or the stored recording whose sheet opened this. */
function backOf(from: string | string[] | undefined) {
  const path = typeof from === "string" ? from : null;
  return path && /^\/rep\/[\w-]{1,64}$/.test(path) ? { href: path, label: "Recording" } : { href: "/you", label: "You" };
}

/** A row's box: one height for the real rows and the skeleton. */
const ROW = "flex min-h-14 w-full items-center gap-3 py-3 text-left text-detail font-normal";

/**
 * Say it better (DECISIONS #507; Timothy, 18 Nov: "the lexicon's so great
 * ... that's how you actually improve"; the name all three readers got in
 * two seconds). The better ways to say the things you said in your own
 * recordings, and the one number that says whether they stuck.
 *
 * The lesson page's grammar (#367): a stage in Variety's tone (the
 * lexicon's colour since #344) with the glass boomerang standing on it,
 * the title, then ONE number, "4 of 11 you now say on your own", with a
 * slot for each swap filling in sage as a later real recording says it.
 * Under it the page's one tap, the test, and three plain lists on the
 * ground: to test today (the weak phrase only: the answer is never
 * spoiled), you now say ("6 times"), learning ("Back Fri"). A row opens
 * its sheet (components/say/SwapSheet.tsx); Remove acts at once and
 * offers Undo for six seconds (#435).
 *
 * The coach's "Say this instead" pairs and the word sheet's saves are one
 * list here (lib/say.ts mergeSwaps). Free: every swap is earned by
 * speaking, so nothing here is capped (#31's three-entry cap is gone).
 */
export default function SayItBetter({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const { from } = use(searchParams);
  const back = backOf(from);
  const warm = useWarm();
  const [read, setRead] = useState<SayRead | null>(() => (warm ? heldSay() : null));
  const drawn = useRef(read !== null);
  const [failed, setFailed] = useState(false);
  /** The swap whose sheet is up, held until its exit is done. */
  const [open, setOpen] = useState<SayItem | null>(null);
  /** The removal the toast offers to take back: the newest one only. */
  const [undo, setUndo] = useState<SayItem | null>(null);
  /** A removal or an undo that did not land: its row is as it was, and this says so. */
  const [stuck, setStuck] = useState<{ item: SayItem; undo: boolean } | null>(null);
  const [said, setSaid] = useState("");
  const leaving = useRef(new Map<string, Promise<boolean>>());
  /** Where the keyboard goes once a removed row's sheet has closed: the row after it, as #435's list did. */
  const refocus = useRef<string | null>(null);

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
  /** One swap shown as off the list, or back on it, on this screen at once. */
  const mark = (key: string, hidden: boolean) =>
    setRead((r) => (r ? { ...r, items: r.items.map((i) => (i.swap.key === key ? { ...i, state: { ...i.state, hidden } } : i)) } : r));

  const remove = async (item: SayItem) => {
    /* The opener the sheet would hand focus back to is the row going
       off: the next row on screen takes it (the one before, at the end). */
    const rows = read ? (({ nowSay, learning }) => [...nowSay, ...learning].map((v) => v.swap.key))(sayLists(read.items, today)) : [];
    const at = rows.indexOf(item.swap.key);
    refocus.current = at < 0 ? null : (rows[at + 1] ?? rows[at - 1] ?? "");
    setStuck(null);
    mark(item.swap.key, true);
    setSaid("");
    setUndo(item);
    const gone = removeSwap(item).then(
      () => true,
      () => false
    );
    leaving.current.set(item.swap.key, gone);
    if (await gone) return;
    leaving.current.delete(item.swap.key);
    setUndo((u) => (u?.swap.key === item.swap.key ? null : u));
    mark(item.swap.key, false);
    setStuck({ item, undo: false });
  };

  const putBack = async (item: SayItem) => {
    setUndo(null);
    setStuck(null);
    mark(item.swap.key, false);
    setSaid(`${item.swap.better} is back`);
    const gone = await (leaving.current.get(item.swap.key) ?? Promise.resolve(true));
    leaving.current.delete(item.swap.key);
    if (!gone) return;
    try {
      await restoreSwap(item);
    } catch {
      mark(item.swap.key, true);
      setStuck({ item, undo: true });
      setSaid("");
    }
  };

  const items = read?.items ?? [];
  const lists = sayLists(items, today);
  const empty = read !== null && lists.m === 0;
  /* The day a swap is next tested: today for one of today's three; one
     due but past the three waits a day; else the day it comes back. */
  const nextTestDay = (v: SayItem) =>
    lists.due.some((d) => d.swap.key === v.swap.key) ? today : v.state.due > today ? v.state.due : addDays(today, 1);
  const practice = () => todayHref(heldReps() ?? [], new Date(), poolHere());

  return (
    <main data-trait="range" className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-5 pb-[var(--nav-clear)]">
      {/*
       * The stage (#367's grammar): Variety's ground from the top edge,
       * under the back row, down to a shallow arc of the page's ground,
       * and the boomerang standing on it. On a new account the stage
       * takes the free height and Demos stands there instead, once.
       */}
      <div className={`relative -mx-5 flex flex-col px-5 pt-[env(safe-area-inset-top)] ${empty ? "min-h-[232px] flex-1" : "h-[220px] shrink-0"}`}>
        <div aria-hidden className="say-stage absolute inset-x-0 bottom-0 -top-96">
          <div className="absolute inset-x-0 -bottom-px h-6 rounded-[50%_50%_0_0/100%_100%_0_0] bg-ground" />
        </div>
        <BackLink href={back.href} label={back.label} className="relative z-[1] self-start" />
        <div className="relative min-h-0 flex-1">
          {empty ? (
            <div className="absolute inset-0 flex items-end justify-center pb-6">
              <div className="demos-fit h-full w-full flex-1">
                <div className="demos-fit-room">
                  <DemosArt pose="speaking" size={300} fit grounded />
                </div>
              </div>
            </div>
          ) : (
            <div aria-hidden className="absolute inset-0 flex items-center justify-center pb-6">
              <SayArt className="size-[132px]" />
            </div>
          )}
        </div>
      </div>

      <h1 tabIndex={-1} className="font-display mt-4 text-center text-title outline-none">Say it better</h1>
      <p role="status" className="sr-only">
        {said}
      </p>

      {failed ? (
        <ErrorState
          className="mt-5"
          title="Say it better didn't load"
          body="Everything is still saved. Check your connection and try again."
          onRetry={() => void load()}
        />
      ) : read === null ? (
        <div aria-busy="true" aria-label="Loading Say it better">
          <div className="mt-3 flex flex-col items-center">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="mt-2 h-4 w-44" />
            <Skeleton className="mt-3 h-1 w-full max-w-[280px]" rounded="rounded-none" />
          </div>
          <button type="button" disabled aria-busy="true" className={`${ACTION_CLASS} ${DISABLED_CLASS} mt-5`}>
            <span className="sr-only">Loading</span>
            <Skeleton className="mx-auto h-3 w-20" rounded="rounded-none" />
          </button>
          {[0, 1, 2].map((i) => (
            <div key={i} className={ROW}>
              <Skeleton className="h-6 w-48" />
            </div>
          ))}
        </div>
      ) : empty ? (
        /* A new account (or a list taken all off): Demos once, on the
           stage, the one line and the one tap to where the first one
           comes from. */
        <div className="arrive flex flex-col">
          <p className="mx-auto mt-2 max-w-[30ch] text-center text-read text-pretty text-stone-600">
            Your first one comes from today&apos;s recording.
          </p>
          <Link href={practice()} className={`${ACTION_CLASS} mt-5`}>
            Today&apos;s practice
          </Link>
        </div>
      ) : (
        <>
          {/* The one number. N in sage (earned), "of M" beside it, the
              line that says what it counts, and a slot for each swap. */}
          <section aria-label="You now say" className="mt-2 flex flex-col items-center">
            <p className="flex items-baseline gap-1.5" data-say-count>
              <span className="font-display text-num-l tabular-nums text-sage-700">{lists.n}</span>
              <span className="font-display text-detail tabular-nums text-stone-500">of {lists.m}</span>
            </p>
            <p className="text-body text-stone-500">you now say on your own</p>
            <SaySlots n={lists.n} m={lists.m} className="mt-3 max-w-[280px]" />
          </section>

          {lists.due.length > 0 ? (
            <Link href="/say/test" data-say-test className={`${ACTION_CLASS} mt-5`}>
              {testLabel(lists.due.length)}
            </Link>
          ) : (
            /* Nothing due today: when the next test is, and the one way
               to move the number today, which is to speak. */
            <div className="mt-5" data-say-dry>
              <p className="text-center text-body text-stone-500">
                {(() => {
                  const next = nextDue(items, today);
                  return next ? `${nextTestLine(next, today)}. Say one in today's practice.` : "Say one in today's practice.";
                })()}
              </p>
              <Link href={practice()} className={`${ACTION_CLASS} mt-3`}>
                Today&apos;s practice
              </Link>
            </div>
          )}

          {stuck && (
            <ErrorLine
              className="mt-3"
              onRetry={() => void (stuck.undo ? putBack(stuck.item) : remove(stuck.item))}
            >
              {stuck.item.swap.better} {stuck.undo ? "didn't come back." : "didn't come off the list."}
            </ErrorLine>
          )}

          {lists.due.length > 0 && (
            <section className="mt-7" data-say-list="due">
              <h2 className="section-head">
                To test today
                <span className="section-head-count">{lists.due.length}</span>
              </h2>
              {/* What you said, and nothing more: the answer is the test's. */}
              <ul className="mt-1">
                {lists.due.map((v) => (
                  <li key={v.swap.key} className={ROW}>
                    <span className="say-weak say-weak-quiet">{v.swap.said}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {lists.nowSay.length > 0 && (
            <section className="mt-7" data-say-list="now">
              <h2 className="section-head">
                You now say
                <span className="section-head-count">{lists.nowSay.length}</span>
              </h2>
              <ul className="mt-1">
                {lists.nowSay.map((v) => {
                  const n = timesUsed(v.uses);
                  const count = n > 0 ? timesLine(n) : "Said";
                  return (
                    <li key={v.swap.key}>
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        aria-label={`Instead of ${v.swap.said}, ${v.swap.better}. You now say it, ${count}.`}
                        onClick={() => setOpen(v)}
                        data-say-row={v.swap.key}
                        className={`press-row ${ROW}`}
                      >
                        <SwapPair
                          said={v.swap.said}
                          better={v.swap.better}
                          aside={<span className="font-display text-row font-semibold tabular-nums text-sage-700">{count}</span>}
                          className="flex-1"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {lists.learning.length > 0 && (
            <section className="mt-7" data-say-list="learning">
              <h2 className="section-head">
                Learning
                <span className="section-head-count">{lists.learning.length}</span>
              </h2>
              <ul className="mt-1">
                {lists.learning.map((v) => {
                  const when = backLine(nextTestDay(v), today);
                  return (
                    <li key={v.swap.key}>
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        aria-label={`Instead of ${v.swap.said}, ${v.swap.better}. ${when}.`}
                        onClick={() => setOpen(v)}
                        data-say-row={v.swap.key}
                        className={`press-row ${ROW}`}
                      >
                        <SwapPair
                          said={v.swap.said}
                          better={v.swap.better}
                          aside={<span className="font-display text-row font-semibold text-stone-500">{when}</span>}
                          className="flex-1"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      {open && (
        <SwapSheet
          key={open.swap.key}
          item={open}
          today={today}
          next={nextTestDay(open)}
          onClose={() => {
            setOpen(null);
            const key = refocus.current;
            refocus.current = null;
            if (key === null) return;
            /* After the sheet has unmounted and handed focus to its opener, which has gone. */
            setTimeout(() => {
              const to = key ? document.querySelector<HTMLElement>(`[data-say-row="${CSS.escape(key)}"]`) : null;
              (to ?? document.querySelector<HTMLElement>("main h1"))?.focus({ preventScroll: true });
            }, 0);
          }}
          onRemove={() => void remove(open)}
        />
      )}
      {undo && (
        <UndoToast
          key={undo.swap.key}
          message={`${undo.swap.better} removed`}
          onUndo={() => void putBack(undo)}
          onDone={() => setUndo((u) => (u?.swap.key === undo.swap.key ? null : u))}
        />
      )}
    </main>
  );
}
