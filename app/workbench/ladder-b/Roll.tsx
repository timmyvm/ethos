"use client";

import { useState } from "react";

/**
 * A price that turns over only the glyphs that changed (Halide's
 * readout): 10.99 to 9.99 turns two places and holds ".99" perfectly
 * still. Places are counted from the right, so a number that loses its
 * leading digit keeps every other key. The glyph that leaves rolls out
 * as its successor rolls in, both inside the glyph's own clip, new from
 * above when the price goes down. `instant` swaps without a roll, for a
 * finger scrubbing: the readout follows the finger 1:1.
 *
 * The previous value is kept in state and updated during render (React's
 * "storing information from previous renders"), so the development
 * double render computes the same roll twice.
 */
export function Roll({
  text,
  value,
  instant = false,
}: {
  text: string;
  value: number;
  instant?: boolean;
}) {
  const [shown, setShown] = useState({ text, value, prev: text, dir: "" as "" | "up" | "down", n: 0 });
  if (shown.text !== text) {
    setShown({
      text,
      value,
      prev: shown.text,
      dir: instant ? "" : value < shown.value ? "down" : "up",
      n: shown.n + 1,
    });
  }

  const now = [...text];
  const was = [...shown.prev];
  return (
    <span className="lb-roll">
      {now.map((ch, i) => {
        const place = now.length - i;
        const old = was[was.length - place];
        const turned = shown.dir !== "" && old !== ch;
        return (
          <span
            // A turned glyph remounts per change, so its entrance replays.
            key={turned ? `${place}:${shown.n}` : `${place}`}
            className="lb-glyph"
            data-dir={turned ? shown.dir : undefined}
          >
            <span className="lb-new">{ch}</span>
            {turned && old !== undefined && (
              <span aria-hidden className="lb-old">
                {old}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
