/**
 * Up or down, for a change in a number (#448).
 *
 * The triangle is for the eye. A screen reader said the shape's own
 * name ("black up-pointing triangle 3 since last time"), so the shape
 * is hidden from it and the word stands in: "Up 3 since last time".
 */
export function TrendMark({ up }: { up: boolean }) {
  return (
    <>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      <span className="sr-only">{up ? "Up" : "Down"}</span>
    </>
  );
}

/**
 * A change, written one way (#493): the triangle and the size, with no
 * sign, then what it is against. The morning tour found four ways ("▲ 3
 * since last time", "▲ +51 since day one", "▲ +1", "▼ 6.5"); the arrow
 * is the sign, so a "+" after it said the same thing twice.
 */
export function Trend({ delta, against }: { delta: number; against?: string }) {
  return (
    <>
      <TrendMark up={delta > 0} /> {Math.abs(delta)}
      {against ? ` ${against}` : ""}
    </>
  );
}

/**
 * The two halves of a swap, said: "Instead of" before the words that
 * were struck through, "say" before the words that replace them. A
 * strike-through and an arrow are both silent, so the pair read as one
 * run of words with nothing to say which half was which (#448).
 */
export const SwapFrom = () => <span className="sr-only">Instead of </span>;
export const SwapTo = () => <span className="sr-only">say </span>;
