"use client";

import { useState } from "react";

/**
 * A number that rolls only the glyphs that change (Halide's readout,
 * docs/ladder-spec.md): 10.99 to 9.99 turns two places and holds ".99"
 * perfectly still. Places count from the right, so a price that loses
 * its leading digit keeps every other key; that digit narrows to nothing
 * as it leaves, and one that arrives grows in, so the figures beside it
 * slide instead of jumping. The glyph leaving rolls out as its successor
 * rolls in, both inside the glyph's own clip: new from above when the
 * value goes down, an odometer running down.
 *
 * The previous value lives in state and is updated during render
 * (React's "storing information from previous renders"), so the
 * development double render computes the same roll twice. `instant`
 * swaps with no roll. Under reduced motion the CSS turns the roll into
 * a 200ms fade on the changed glyphs (globals.css, the price ladder).
 *
 * Screen readers get the text once, whole; the glyphs are hidden.
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
  const [shown, setShown] = useState({ text, value, prev: text, dir: "" as "" | "up" | "down", n: 0 });
  if (shown.text !== text) {
    setShown({
      text,
      value,
      prev: shown.text,
      dir: instant || value === shown.value ? "" : value < shown.value ? "down" : "up",
      n: shown.n + 1,
    });
  }

  const now = [...text];
  const was = [...shown.prev];
  const rolling = shown.dir !== "";
  // Leading glyphs the old text had and the new one does not.
  const leaving = rolling ? was.slice(0, Math.max(0, was.length - now.length)) : [];

  return (
    <span className={`roll-num ${className}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="roll-glyphs">
        {leaving.map((ch, i) => {
          const place = was.length - i;
          return (
            <span key={`${place}:out:${shown.n}`} className="roll-glyph" data-dir={shown.dir} data-edge="leave">
              <span className="roll-out roll-solo">{ch}</span>
            </span>
          );
        })}
        {now.map((ch, i) => {
          const place = now.length - i;
          const old = was[was.length - place];
          const turned = rolling && old !== ch;
          return (
            <span
              // A turned glyph remounts per change, so its entrance replays.
              key={turned ? `${place}:${shown.n}` : `${place}`}
              className="roll-glyph"
              data-dir={turned ? shown.dir : undefined}
              data-edge={turned && old === undefined ? "enter" : undefined}
            >
              <span className="roll-in">{ch}</span>
              {turned && old !== undefined && <span className="roll-out">{old}</span>}
            </span>
          );
        })}
      </span>
    </span>
  );
}
