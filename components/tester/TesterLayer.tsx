"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { asksAgain, collects, type TesterRow } from "@/lib/tester";
import {
  markAsked,
  readAsked,
  readTesterHint,
  TESTER_CHANGED,
  testerOnce,
} from "@/lib/tester-client";
import { sessionToken } from "@/lib/supabase-browser";
import type { Collecting } from "@/lib/tester-collect";
import { readAgainWhenBack } from "@/lib/tester-retry";
import { dropEarly, testerEarly } from "@/lib/tester-signal";

/**
 * Tester mode on every screen, for the testers alone (consent version 3,
 * docs/testers.md). Renders nothing.
 *
 * On a device that last saw its account as a tester (the hint
 * lib/tester-client.ts keeps), the open reads the account's own testers
 * row, once, shared with Today's test tile (testerOnce). Nobody else's open reads anything, and nothing below happens
 * for them:
 *
 *   - a tester on version 3 starts collection (lib/tester-collect.ts,
 *     imported only then), and each screen change is told to it;
 *   - a tester on an older consent is shown the new one once, over the
 *     first tab or Settings they open (/tester?from=open), and goes back
 *     there whichever way they answer;
 *   - signing out, agreeing, or the server answering stop changes the
 *     hint or says so (TESTER_CHANGED), and the row is read again.
 *
 * While the row is read and the collector's file loads, a window error
 * or an unhandled rejection on a hinted device is held in memory
 * (lib/tester-signal.ts, five at most, as the error boundary's are), so
 * a crash on the first screen of an open is reported once collection
 * starts (review F1). The row saying no lets them go.
 *
 * A read that could not be answered (an open with no connection, or no
 * session to read with) is read again once the phone is back
 * (lib/tester-retry.ts), holding what breaks meanwhile: the read was
 * never tried again, and a tester who opened the app offline was not
 * collected for the rest of that page life.
 */
export function TesterLayer() {
  const pathname = usePathname();
  const router = useRouter();
  const running = useRef<Collecting | null>(null);
  const row = useRef<TesterRow | null>(null);
  const [check, setCheck] = useState(0);
  /** Reads in a row that could not be answered, for the wait before the next. */
  const misses = useRef(0);

  useEffect(() => {
    const again = () => setCheck((n) => n + 1);
    window.addEventListener(TESTER_CHANGED, again);
    return () => {
      window.removeEventListener(TESTER_CHANGED, again);
      running.current?.stop();
      running.current = null;
    };
  }, []);

  /* The ask, once, over a screen it may open over. */
  const ask = (path: string) => {
    if (!asksAgain({ tester: row.current, asked: readAsked(), pathname: path })) return;
    markAsked();
    router.push(`/tester?from=open&back=${encodeURIComponent(path)}`);
  };

  useEffect(() => {
    let live = true;
    const stop = () => {
      running.current?.stop();
      running.current = null;
    };
    if (!readTesterHint()) {
      row.current = null;
      stop();
      dropEarly();
      return;
    }
    /* Until the collector listens: what breaks is held, not lost. */
    const onError = (ev: ErrorEvent) =>
      testerEarly("window", ev.error ?? ev.message, {
        file: ev.filename,
        line: ev.lineno,
        col: ev.colno,
        message: ev.message,
      });
    const onRejection = (ev: PromiseRejectionEvent) => testerEarly("rejection", ev.reason);
    const unwatch = () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
    if (!running.current) {
      window.addEventListener("error", onError);
      window.addEventListener("unhandledrejection", onRejection);
    }
    let cancelAgain = () => {};
    /* No answer, or the collector's file did not load: read again once the phone is back. */
    const unknown = () => {
      if (!live) return;
      if (running.current) return unwatch();
      misses.current += 1;
      cancelAgain = readAgainWhenBack(misses.current, () => setCheck((n) => n + 1));
    };
    testerOnce()
      .then(async (t) => {
        if (!live) return;
        // No row while the hint stands: no session could be read, not a no.
        if (t === null && readTesterHint()) return unknown();
        misses.current = 0;
        row.current = t;
        if (!collects(t)) {
          unwatch();
          dropEarly();
          stop();
          ask(window.location.pathname);
          return;
        }
        if (running.current) return unwatch();
        const { startCollecting } = await import("@/lib/tester-collect");
        unwatch();
        if (!live || running.current || !collects(row.current)) return;
        running.current = startCollecting({ token: sessionToken });
      })
      .catch(unknown);
    return () => {
      live = false;
      cancelAgain();
      unwatch();
    };
    // `ask` reads refs and the router only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check]);

  useEffect(() => {
    running.current?.route(pathname);
    if (row.current && !collects(row.current)) ask(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
