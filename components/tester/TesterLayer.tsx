"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { asksAgain, collects, type TesterRow } from "@/lib/tester";
import {
  fetchTester,
  markAsked,
  readAsked,
  readTesterHint,
  TESTER_CHANGED,
} from "@/lib/tester-client";
import { sessionToken } from "@/lib/supabase-browser";
import type { Collecting } from "@/lib/tester-collect";
import { dropEarly, testerEarly } from "@/lib/tester-signal";

/**
 * Tester mode on every screen, for the testers alone (consent version 3,
 * docs/testers.md). Renders nothing.
 *
 * On a device that last saw its account as a tester (the hint
 * lib/tester-client.ts keeps), the open reads the account's own testers
 * row. Nobody else's open reads anything, and nothing below happens
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
 */
export function TesterLayer() {
  const pathname = usePathname();
  const router = useRouter();
  const running = useRef<Collecting | null>(null);
  const row = useRef<TesterRow | null>(null);
  const [check, setCheck] = useState(0);

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
    fetchTester()
      .then(async (t) => {
        if (!live) return;
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
      .catch(unwatch);
    return () => {
      live = false;
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
