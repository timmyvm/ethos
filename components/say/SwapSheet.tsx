"use client";

import { useEffect, useState } from "react";
import { Overlay, useOverlayClose } from "@/components/ui/Overlay";
import { SheetHead } from "@/components/ui/SheetHead";
import { MarkedSentence } from "@/components/say/parts";
import { SayChip, useMoments } from "@/components/say/useMoments";
import { fetchTakeWords, type SayItem } from "@/lib/say-store";
import { chipDay, clock, nextTestLine, nowSays, phraseAt, saidOn, timesLine, timesUsed, type TimedWord } from "@/lib/say";

/** How many later recordings a sheet lists with their moments. */
const SHOWN_USES = 4;

/**
 * One swap, opened from its row (#507; the in-the-loop design's sheet,
 * grafted): what you said in your own sentence with its moment, the
 * sentence said better, a dated chip for each later recording that used
 * it, and Remove. Remove acts at once and the page offers Undo (#435).
 *
 * The moments need Whisper's timed words, which the page does not read
 * for every recording: they are read here, for this swap's recordings
 * only, and a chip stands once its time is known.
 */
export function SwapSheet({
  item,
  today,
  next,
  onClose,
  onRemove,
}: {
  item: SayItem;
  today: string;
  /** The day of its next test: today when it is one of today's three, else the day it comes back. */
  next: string;
  onClose: () => void;
  onRemove: () => void;
}) {
  const { swap, state, uses } = item;
  const player = useMoments();
  const [words, setWords] = useState<Map<string, TimedWord[] | null> | null>(null);
  useEffect(() => {
    let live = true;
    const ids = [swap.repId, ...uses.slice(0, SHOWN_USES).map((u) => u.repId)].filter((x): x is string => !!x);
    fetchTakeWords(ids)
      .then((w) => live && setWords(w))
      .catch(() => live && setWords(new Map()));
    return () => {
      live = false;
    };
  }, [swap.repId, uses]);

  const source = swap.repId && words ? phraseAt(words.get(swap.repId), swap.said) : null;
  const says = nowSays(item);
  const n = timesUsed(uses);

  return (
    <Overlay label={swap.better} onClose={onClose} className="w-full max-w-[430px]">
      <div data-trait="range" data-say-sheet className="elev-3 w-full rounded-t-sheet bg-raised px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
        <SheetHead onClose={onClose} />
        {player.element}
        <p className="text-body text-stone-400 line-through">
          <span className="sr-only">Instead of </span>
          {swap.said}
        </p>
        <h2 className="font-display mt-0.5 text-title font-extrabold text-balance">{swap.better}</h2>

        <section className="mt-5">
          <h3 className="detail-head">You said</h3>
          <p className="mt-1.5 text-read leading-relaxed text-pretty text-stone-800">
            “{swap.sentence ? <MarkedSentence sentence={swap.sentence} said={swap.said} better={swap.better} mode="weak" /> : <span className="say-weak">{swap.said}</span>}”
          </p>
          <p className="mt-2 flex min-h-6 items-center gap-2 text-caption text-stone-500">
            {source && swap.repId && (
              <SayChip
                moment={{ repId: swap.repId, from: Math.max(0, source.start - 1), until: source.end + 1.5 }}
                clock={clock(source.start)}
                label={`${clock(source.start)}, play where you said it`}
                player={player}
              />
            )}
            <span>{capital(saidOn(item.saidOn))}</span>
          </p>
        </section>

        <section className="mt-5">
          <h3 className="detail-head">Say it like this</h3>
          <p className="mt-1.5 text-read leading-relaxed text-pretty text-stone-800">
            “{swap.sentence ? <MarkedSentence sentence={swap.sentence} said={swap.said} better={swap.better} mode={says ? "said" : "answer"} /> : <span className={says ? "say-said" : "say-answer"}>{swap.better}</span>}”
          </p>
        </section>

        <section className="mt-5">
          <h3 className="detail-head">In your recordings</h3>
          {says ? (
            <>
              <p data-say-times className="font-display mt-1 text-row font-semibold text-sage-700">
                {n > 0 ? timesLine(n) : "Said on your own"}
              </p>
              {uses.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-3">
                  {uses.slice(0, SHOWN_USES).map((u) => {
                    const hit = words ? phraseAt(words.get(u.repId), swap.better) : null;
                    const day = chipDay(u.createdAt);
                    return (
                      <li key={u.repId} className="flex min-h-6 items-center">
                        {hit ? (
                          <SayChip
                            moment={{ repId: u.repId, from: Math.max(0, hit.start - 1), until: hit.end + 1.5 }}
                            day={day}
                            clock={clock(hit.start)}
                            label={`${day} ${clock(hit.start)}, play where you said it`}
                            player={player}
                          />
                        ) : (
                          <span className="font-display text-link text-stone-500">{day}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <p className="mt-1 text-body text-stone-500">
              Not yet. {next <= today ? "It's in today's test." : `${nextTestLine(next, today)}.`}
            </p>
          )}
        </section>

        <RemoveButton onRemove={onRemove} onClose={onClose} />
      </div>
    </Overlay>
  );
}

/**
 * Remove: the page takes the swap off at once and offers Undo (#435),
 * and the sheet plays its own exit, the one Escape and the scrim play.
 * The page keeps the sheet's swap until the exit is done.
 */
function RemoveButton({ onRemove, onClose }: { onRemove: () => void; onClose: () => void }) {
  const close = useOverlayClose(onClose);
  return (
    <div className="mt-5 flex justify-center">
      <button
        type="button"
        data-say-remove
        onClick={() => {
          onRemove();
          close();
        }}
        className="press min-h-11 rounded-tap px-4 text-link text-stone-500"
      >
        Remove
      </button>
    </div>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
