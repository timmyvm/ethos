"use client";

import { useState } from "react";

/**
 * A price that rolls only the digits that changed (Halide's readout,
 * the research's technique 3). Tabular figures hold every glyph at one
 * width, so the decimal point never moves while 12.99 becomes 11.99:
 * two glyphs turn over, three stay exactly still.
 *
 * Each glyph is keyed by its place and its character. A glyph that did
 * not change keeps its key and is not touched; a glyph that did is a new
 * element that enters from 0.5em above (the price went down) or below
 * (up) on --spring-snappy. `instant` skips the roll: while a finger is
 * scrubbing, the readout follows it 1:1 with no easing at all.
 *
 * The last value lives in state and is updated during render (React's
 * "storing information from previous renders"), not in a ref, so the
 * development double render computes the same roll twice.
 *
 * Under reduced motion the CSS turns the roll into a 200ms fade on the
 * changed glyphs only.
 */
export function RollNumber({
  text,
  value,
  instant = false,
  className = "",
}: {
  /** What is drawn, already formatted ("12.99"). */
  text: string;
  /** The number behind it, for the direction of the roll. */
  value: number;
  instant?: boolean;
  className?: string;
}) {
  const [shown, setShown] = useState({ text, value, enter: "" });
  if (shown.text !== text) {
    setShown({
      text,
      value,
      enter: instant ? "" : value < shown.value ? "la-roll-down" : "la-roll-up",
    });
  }

  // Places counted from the right, so "12.99" and "6.99" share their
  // last four keys and only the leading digit comes or goes.
  const glyphs = [...text];
  return (
    <span className={`la-roll ${className}`}>
      {glyphs.map((ch, i) => (
        <Glyph key={`${glyphs.length - i}:${ch}`} ch={ch} enter={shown.enter} />
      ))}
    </span>
  );
}

/** The class is read once, at mount: a glyph never replays its entrance. */
function Glyph({ ch, enter }: { ch: string; enter: string }) {
  const [cls] = useState(enter);
  return <span className={`la-glyph ${cls}`}>{ch}</span>;
}
