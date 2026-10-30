"use client";

import Link from "next/link";
import { PAUSED_COPY } from "@/content/tester";

/**
 * Where a tester's questions would be, for a tester on an older consent
 * (lib/tester.ts pausedTester, review D1): nothing is asked or kept
 * until they agree to the consent this app shows, and the ask on the
 * way in comes once per device, so one reflex tap past it otherwise
 * left a paid tester answering nothing for the rest of the test with
 * no sign of it. One grey line and a grey text link, never terracotta:
 * the screen's one tap stays its own. Agreeing comes back to `back`
 * (lib/tester.ts askedFrom: a tab, Settings, or this recording's page).
 */
export function TesterPaused({ back, className = "" }: { back: string; className?: string }) {
  return (
    <section aria-label={PAUSED_COPY.line} className={`flex min-h-11 items-center justify-between gap-3 ${className}`}>
      <p className="text-body text-stone-500">{PAUSED_COPY.line}</p>
      <Link
        href={`/tester?from=open&back=${encodeURIComponent(back)}`}
        className="text-link press inline-flex min-h-11 shrink-0 items-center"
      >
        {PAUSED_COPY.action}
      </Link>
    </section>
  );
}
