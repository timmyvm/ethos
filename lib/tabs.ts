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
};

/** Which tab a path lights: its index in TAB_HREFS, or -1 for none. */
export function tabIndexFor(path: string): number {
  const under = (base: string) => path === base || path.startsWith(`${base}/`);
  const own = TAB_HREFS.findIndex((t) => (t === "/" ? path === "/" : path.startsWith(t)));
  if (own !== -1) return own;
  const parent = Object.entries(TAB_CHILDREN).find(([child]) => under(child))?.[1];
  return parent ? TAB_HREFS.indexOf(parent) : -1;
}
