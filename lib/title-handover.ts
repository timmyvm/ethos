/**
 * When a screen's large title hands over to the small one in its bar
 * (components/ui/ScreenHeader.tsx, the apple-design pass, #321): once
 * the large title's line has gone 6px under the bar's foot, the bar
 * carries the small title.
 *
 * The line, not the heading's box. Today's greeting keeps 6px of clip
 * room over and under its line (`.home .large-title`: padding, pulled
 * back by as much negative margin, so an ellipsis on a long name never
 * cuts an accent or a descender and nothing moves), which makes its box
 * reach 6px under the line. Read on the box, the hand-over came 6px of
 * scroll late at 390x844 (scrollY 81, not 75), and for those 6px the
 * greeting had faded under the frost with nothing in the bar.
 */
export const HANDOVER_DEPTH = 6;

/**
 * The foot of the heading's line: its box's bottom, less its bottom
 * padding (a computed `padding-bottom`, "6px", or a number of px).
 */
export function lineFoot(boxBottom: number, paddingBottom: string | number): number {
  const pad = typeof paddingBottom === "number" ? paddingBottom : parseFloat(paddingBottom);
  return boxBottom - (Number.isFinite(pad) ? pad : 0);
}

/** Whether the bar carries the small title: the line's foot 6px under the bar's foot. */
export function titleHandedOver(boxBottom: number, paddingBottom: string | number, barBottom: number): boolean {
  return lineFoot(boxBottom, paddingBottom) - HANDOVER_DEPTH < barBottom;
}
