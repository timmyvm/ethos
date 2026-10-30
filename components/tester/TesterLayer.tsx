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
      return;
    }
    fetchTester()
      .then(async (t) => {
        if (!live) return;
        row.current = t;
        if (!collects(t)) {
          stop();
          ask(window.location.pathname);
          return;
        }
        if (running.current) return;
        const { startCollecting } = await import("@/lib/tester-collect");
        if (!live || running.current || !collects(row.current)) return;
        running.current = startCollecting({ token: sessionToken });
      })
      .catch(() => {});
    return () => {
      live = false;
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
