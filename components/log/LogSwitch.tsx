"use client";

import { useCallback, useEffect, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import {
  logViewSearch,
  readLogView,
  storedLogView,
  storeLogView,
  type LogView,
} from "@/lib/log-view";

/**
 * Which side of the Log shows (#486): the address's `?view=`, then what
 * this phone last chose, then Daily (lib/log-view.ts). Read during the
 * first render only on a warm mount (`warm`, lib/use-warm.ts), whose
 * page the server never drew; a hydrating page draws Daily, as the
 * server did, and turns to the remembered side on mount, before any
 * number has landed.
 *
 * Choosing a side keeps it on this phone and writes it into the address
 * in place (no new history entry), so a stored recording opened from it
 * comes back to it, and a reload keeps it.
 */
export function useLogView(warm: boolean): [LogView, (view: LogView) => void] {
  const [view, setView] = useState<LogView>(() =>
    warm ? readLogView(window.location.search, storedLogView()) : "daily"
  );
  useEffect(() => {
    const search = window.location.search;
    const next = readLogView(search, storedLogView());
    // A link that named a side (Practice's) is a choice too.
    if (new URLSearchParams(search).has("view")) storeLogView(next);
    setView(next);
  }, []);
  const choose = useCallback((next: LogView) => {
    setView(next);
    storeLogView(next);
    try {
      const { pathname, search, hash } = window.location;
      window.history.replaceState(window.history.state, "", `${pathname}${logViewSearch(search, next)}${hash}`);
    } catch {}
  }, []);
  return [view, choose];
}

/**
 * The switch under the Log's title: Daily and Games, Timothy's words.
 * The house's segmented control (`Segmented`, Today's Today / This
 * week), so its keys, its 44px segments and its sliding thumb are the
 * ones the app already has. Games holds the games and the weekly boss
 * (components/log/GamesLog.tsx).
 */
export function LogSwitch({ view, onChange }: { view: LogView; onChange: (view: LogView) => void }) {
  return (
    <div className="mt-5" data-look="log-switch">
      <Segmented
        label="Log"
        value={view}
        onChange={onChange}
        options={[
          { value: "daily", label: "Daily" },
          { value: "games", label: "Games" },
        ]}
      />
    </div>
  );
}
