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
