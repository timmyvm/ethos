/**
 * The Log's switch (#486): Daily, the Log as it was, and Games, the
 * games and the weekly boss (components/log/GamesLog.tsx).
 *
 * Which side shows: the address first (`?view=games`, so Practice can
 * link there), then what this phone last chose (`ethos.log.view`), then
 * Daily. The choice is kept per phone, never on the account.
 */

export type LogView = "daily" | "games";

export const LOG_VIEWS: readonly LogView[] = ["daily", "games"];

/** Where this phone keeps the last side chosen. */
export const LOG_VIEW_KEY = "ethos.log.view";

const isView = (v: unknown): v is LogView => v === "daily" || v === "games";

/** The side to show, from the address's query and the phone's memory. */
export function readLogView(search: string, stored: string | null): LogView {
  const asked = new URLSearchParams(search).get("view");
  if (isView(asked)) return asked;
  return isView(stored) ? stored : "daily";
}

/**
 * The address for a side, keeping every other part of the query: Daily
 * is the Log's own address with no `view`, Games adds `view=games`.
 */
export function logViewSearch(search: string, view: LogView): string {
  const q = new URLSearchParams(search);
  if (view === "daily") q.delete("view");
  else q.set("view", view);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** The Log's Games side, for a link from elsewhere (Practice). */
export const GAMES_LOG_HREF = "/history?view=games";

/** The phone's memory, read safely: storage can be missing or refuse. */
export function storedLogView(): string | null {
  try {
    return localStorage.getItem(LOG_VIEW_KEY);
  } catch {
    return null;
  }
}

/** Keep the side chosen on this phone; a refused write is no error. */
export function storeLogView(view: LogView): void {
  try {
    localStorage.setItem(LOG_VIEW_KEY, view);
  } catch {}
}
