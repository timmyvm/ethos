/**
 * The tab bar, in the order it is drawn, and in ONE place (#275).
 *
 * It was in two: `components/Nav.tsx` drew it, and
 * `components/PageTransition.tsx` kept its own copy to decide which way
 * a page slides in. Nothing connected them, so a tab added to the first
 * and forgotten in the second gets `depth() === 1` instead of 0 and
 * animates as "deeper, from the right" rather than sliding along the
 * bar, with the way back reversed to match. The failure is invisible in
 * review and obvious in the hand.
 *
 * Only the hrefs live here. The labels and the marks stay in `Nav.tsx`
 * beside the markup that draws them, and a test asserts the two lists
 * agree in order.
 */
export const TAB_HREFS = [
  "/",
  "/lessons",
  "/games",
  "/history",
  "/you",
] as const;

/**
 * Screens off the bar's own routes that still belong to a tab (D16):
 * the Shop and Settings open from You, so You's well and filled mark
 * stay lit on both and the bar always says where you are.
 */
export const TAB_CHILDREN: Readonly<Record<string, (typeof TAB_HREFS)[number]>> = {
  "/shop": "/you",
  "/settings": "/you",
  /* #442: both drew the bar with nothing lit. Your words opens from
     You's lexicon, Upload from Practice's tiles. */
  "/words": "/you",
  "/upload": "/games",
};

/**
 * A stored recording, opened from the Log: a page to read, one step in
 * from its tab (#442). It keeps the bar, with Log lit, as an iPhone keeps
 * its tab bar on a screen pushed inside a tab; the recorder at `/rep`
 * itself is a task and hides it.
 */
export const STORED_RECORDING = /^\/rep\/[\w-]+$/;

/** Which tab a path lights: its index in TAB_HREFS, or -1 for none. */
export function tabIndexFor(path: string): number {
  const under = (base: string) => path === base || path.startsWith(`${base}/`);
  const own = TAB_HREFS.findIndex((t) => (t === "/" ? path === "/" : path.startsWith(t)));
  if (own !== -1) return own;
  if (STORED_RECORDING.test(path)) return TAB_HREFS.indexOf("/history");
  const parent = Object.entries(TAB_CHILDREN).find(([child]) => under(child))?.[1];
  return parent ? TAB_HREFS.indexOf(parent) : -1;
}
