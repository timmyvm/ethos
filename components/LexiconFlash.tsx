"use client";

import { useMemo, useState } from "react";
import type { LexiconRow } from "@/lib/client-data";

/**
 * Lexicon flash: three of your own upgrades, recalled cold.
 *
 * The supply layer (DECISIONS #12) collects a word swap from every
 * recording and then never asks about them again, which is how a
 * vocabulary list dies. This is the retrieval half: you see the weak
 * phrase you actually said and try to remember the upgrade before
 * flipping it.
 *
 * Retrieval practice rather than re-reading is the one study technique
 * with strong evidence behind it (Dunlosky et al. 2013, top tier: the
 * same review that put highlighting and re-reading in the bottom tier).
 *
 * It sits inside You's lexicon section, so the upgrade wears the same
 * Variety label as the list above it (`.you-word` under `data-trait`).
 */
export function LexiconFlash({
  lexicon,
  onDone,
}: {
  lexicon: LexiconRow[];
  onDone: () => void;
}) {
  // Newest three, fixed for the session so flipping doesn't reshuffle.
  const cards = useMemo(() => lexicon.slice(0, 3), [lexicon]);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);

  if (cards.length === 0) return null;
  const card = cards[i];
  const last = i === cards.length - 1;
  const step =
    "press font-display mt-4 min-h-11 w-full rounded-control bg-surface px-4 py-3 text-row";

  return (
    /* The card is produced by a tap (the button above it is replaced),
       so it arrives from 6px below rather than appearing (#221). */
    <div className="arrive card p-4">
      <div className="flex items-baseline justify-between">
        <div className="eyebrow">Lexicon flash</div>
        <div className="label-micro">
          {i + 1}/{cards.length}
        </div>
      </div>

      {/*
       * Advancing is a step of a walk, so the next card comes in from
       * the direction of travel (`.arrive-x`, the pattern LessonScreen
       * uses). Card one is already arriving with the card itself: two
       * entrances on the same pixels is neither, so the class waits for
       * the first Next.
       */}
      <div key={i} className={i > 0 ? "arrive-x" : undefined}>
        <p className="mt-3 text-caption text-stone-500">
          You said this. What did you swap it for?
        </p>
        <div className="font-display mt-1 text-title font-bold">
          &ldquo;{card.original}&rdquo;
        </div>

        {shown ? (
          <>
            {/* The answer drops out of the row that revealed it. */}
            <div className="reveal mt-3 border-t border-hairline pt-3">
              <div className="eyebrow">The upgrade</div>
              <div className="mt-1 text-lead">
                <span className="you-word">{card.upgrade}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (last) {
                  onDone();
                  return;
                }
                setI(i + 1);
                setShown(false);
              }}
              className={step}
            >
              {last ? "Done" : "Next"}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setShown(true)} className={step}>
            Show it
          </button>
        )}
      </div>
    </div>
  );
}
