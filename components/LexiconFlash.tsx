"use client";

import { useMemo, useState } from "react";
import type { LexiconRow } from "@/lib/client-data";

/**
 * Lexicon flash — three of your own upgrades, recalled cold.
 *
 * The supply layer (DECISIONS #12) collects a word swap from every rep
 * and then never asks about them again, which is how a vocabulary list
 * dies. This is the retrieval half: you see the weak phrase you actually
 * said and try to remember the upgrade before flipping it.
 *
 * Retrieval practice rather than re-reading is the one study technique
 * with strong evidence behind it (Dunlosky et al. 2013, top tier — the
 * same review that put highlighting and re-reading in the bottom tier).
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

  return (
    <div className="rounded-[18px] border border-hairline bg-surface lift p-5">
      <div className="flex items-baseline justify-between">
        <div className="label-data">Lexicon flash</div>
        <div className="label-data">
          {i + 1}/{cards.length}
        </div>
      </div>

      <p className="mt-3 text-[12.5px] text-stone-500">
        You said this. What did you swap it for?
      </p>
      <div className="font-display mt-1 text-[24px] font-bold leading-tight">
        &ldquo;{card.original}&rdquo;
      </div>

      {shown ? (
        <>
          <div className="mt-3 border-t border-sand pt-3">
            <div className="label-data">The upgrade</div>
            <div className="font-display mt-0.5 text-[20px] font-bold text-amber-600">
              {card.upgrade}
            </div>
          </div>
          <button
            onClick={() => {
              if (last) {
                onDone();
                return;
              }
              setI(i + 1);
              setShown(false);
            }}
            className="press mt-4 w-full rounded-[14px] border border-black/10 bg-surface px-4 py-3 text-[14px] font-semibold"
          >
            {last ? "Done" : "Next"}
          </button>
        </>
      ) : (
        <button
          onClick={() => setShown(true)}
          className="press mt-4 w-full rounded-[14px] bg-sand px-4 py-3 text-[14px] font-semibold"
        >
          Show it
        </button>
      )}
    </div>
  );
}
