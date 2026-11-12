/**
 * What slides in beside a tab while a finger pulls it aside
 * (components/TabSwipe.tsx).
 *
 * Never the neighbour's own code. A tab page reads the address, opens
 * sheets and marks things seen as it mounts (the price drop, a paywall
 * return, a tester's screen count), and a screen that is only being
 * peeked at must do none of that: a swipe let go early would have spent
 * a moment the person never saw. So the stand-in is a picture made of
 * DOM, and nothing in it runs:
 *
 *  - the tab as it was last left: the very nodes React let go of when
 *    the app moved on, kept instead of collected, so no copy is made,
 *    and shown at the place the tab was left (#443: the pane is
 *    scrolled there, components/TabSwipe.tsx); or
 *  - for a tab not opened yet, its first paint. Every tab is
 *    prerendered, so its address answers with the screen exactly as a
 *    visit first draws it, title and placeholders in place; or
 *  - nothing, and the pane is bare ground.
 *
 * Browser only. The rules a finger's travel follows are in
 * lib/tab-swipe.ts, where they can be tested without a page.
 */

/** The attribute PageTransition puts on each page's wrapper, with its path. */
export const PAGE_ATTR = "data-page";

/** Tabs as they were last left: the nodes themselves. */
const seen = new Map<string, HTMLElement>();
/** Tabs not opened yet, as their address first draws them. */
const first = new Map<string, HTMLElement>();
const asked = new Set<string>();

export type StandIn = {
  el: HTMLElement;
  /** `seen`: as it was last left. `first`: as a visit first draws it. */
  kind: "seen" | "first";
};

/**
 * A kept or fetched page made fit to show: at rest, silent and shut.
 * Whatever a swipe left on it goes (a transform, the push it arrived
 * with), so does anything that plays or runs, and so does a sheet that
 * was open over it when the app moved on.
 */
function still(el: HTMLElement): HTMLElement {
  el.removeAttribute("style");
  el.classList.remove("push-right", "push-left");
  el.querySelectorAll("script, video, audio, iframe, [role='dialog'], .sheet-scrim").forEach((n) =>
    n.remove()
  );
  return el;
}

/** Keep a tab's page as the app leaves it. Costs nothing: a reference. */
export function keepPage(path: string, el: HTMLElement | null): void {
  if (el) seen.set(path, el);
}

/**
 * The picture for a tab, or null. A kept page counts only once React
 * has let go of it: one still on screen is the app's, and moving it
 * would take it out from under React.
 */
export function standInFor(path: string): StandIn | null {
  const kept = seen.get(path);
  if (kept && !kept.isConnected) return { el: still(kept), kind: "seen" };
  const drawn = first.get(path);
  return drawn && !drawn.isConnected ? { el: drawn, kind: "first" } : null;
}

/**
 * Ask a tab's address for its first paint, once, for a tab not opened
 * yet. The answer is the prerendered page; only the wrapper marked with
 * its path is taken, parsed in a document where nothing runs.
 */
export function wantFirstPaint(path: string): void {
  if (typeof window === "undefined") return;
  /* A deployed build only. Under `next dev` the address is drawn on
     demand, and asking for two more routes while the page settles sets
     the dev server compiling them under whatever the camera does next
     (it answered a walk with a half-written manifest, three times in
     one evening). There a tab not opened yet slides in as bare ground;
     `scripts/look-swipe.mjs` runs against a build for that reason. */
  if (process.env.NODE_ENV !== "production") return;
  if (seen.has(path) || first.has(path) || asked.has(path)) return;
  asked.add(path);
  void (async () => {
    try {
      const res = await fetch(path, { headers: { Accept: "text/html" } });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.includes("text/html")) return;
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const found = Array.from(doc.querySelectorAll<HTMLElement>(`[${PAGE_ATTR}]`)).find(
        (n) => n.getAttribute(PAGE_ATTR) === path
      );
      if (found) first.set(path, still(document.importNode(found, true)));
    } catch {
      // Offline, or the address did not answer: ask again another time.
      asked.delete(path);
    }
  })();
}
