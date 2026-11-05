"use client";

import { Fragment, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { WordSheet } from "@/components/WordSheet";
import type { FillerHit, Word } from "@/lib/metrics";
import { transcriptPieces, type TranscriptUnit, type WordMark } from "@/lib/transcript-words";

/**
 * What you said, as words you can tap (#411; Timothy, after a tester
 * showed him Kiku: "make it interactive ... instead of the definition of
 * the word I'd like a thesaurus").
 *
 * The transcript sets in Outfit at 20/600 on 1.7, and every word is a
 * control: a tap (or Enter) opens the word sheet, with when it was said
 * and what to say instead. Underlines say what a word is, in the colour
 * that already means it: a filler in the Fillers tone (the Hear it back
 * key's mark), a vague word in Variety's tone, a word said three times
 * or more in Variety's tone dotted, every other word a hairline so the
 * paragraph reads as tappable. The marks come from lib/transcript-words.ts,
 * whose fillers are the engine's own, so an underline is a counted
 * filler and nothing else is.
 *
 * One tab stop for the whole paragraph: Tab lands on a word, the arrow
 * keys (and Home, End) walk the words, Tab leaves. 150 tab stops between
 * the player and the screen's one tap would bury the tap.
 */
export function InteractiveTranscript({
  transcript,
  words,
  fillers,
  onPlay,
  repId = null,
  doorToWords = true,
}: {
  transcript: string;
  /** Whisper's word list with times; a stored row may not have one. */
  words?: Word[] | null;
  /** The fillers the engine counted, for their times and the count. */
  fillers: FillerHit[];
  /** Plays the recording from a second; absent when nothing on the screen can play it. */
  onPlay?: (t: number) => void;
  /** The stored recording, filed with a saved swap. */
  repId?: string | null;
  /**
   * The sheet's row to Your words is a link. Off in the live results
   * walk, where leaving would end the debrief before its last step: there
   * it says where the swap went and stays put.
   */
  doorToWords?: boolean;
}) {
  const pieces = useMemo(() => transcriptPieces(transcript, words, fillers), [transcript, words, fillers]);
  const units = useMemo(() => pieces.filter((p): p is TranscriptUnit => p.kind === "word"), [pieces]);
  const [open, setOpen] = useState<TranscriptUnit | null>(null);
  /** The word that holds the paragraph's one tab stop: the last one used. */
  const [current, setCurrent] = useState(0);
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const marks = useMemo(() => new Set(units.map((u) => u.mark).filter(Boolean)), [units]);

  const move = (to: number) => {
    const n = Math.max(0, Math.min(units.length - 1, to));
    setCurrent(n);
    refs.current[n]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLSpanElement>, u: TranscriptUnit) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setCurrent(u.n);
      setOpen(u);
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(u.n + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(u.n - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(units.length - 1);
    }
  };

  if (units.length === 0) {
    return <p className="mt-3 text-read text-stone-800">{transcript || "Nothing was picked up."}</p>;
  }

  return (
    <>
      {marks.size > 0 && (
        <div aria-hidden className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-stone-500">
          {marks.has("filler") && <Key mark="filler">filler</Key>}
          {marks.has("vague") && <Key mark="vague">vague</Key>}
          {marks.has("repeat") && <Key mark="repeat">said 3+ times</Key>}
        </div>
      )}
      <div role="group" aria-label="Transcript. Every word opens what to say instead." className="transcript mt-3">
        {pieces.map((p, i) =>
          p.kind === "gap" ? (
            <Fragment key={`g${i}`}>{p.text}</Fragment>
          ) : (
            <span
              key={`w${p.n}`}
              ref={(el) => {
                refs.current[p.n] = el;
              }}
              role="button"
              tabIndex={p.n === current ? 0 : -1}
              aria-haspopup="dialog"
              aria-expanded={open?.n === p.n}
              data-word-mark={p.mark ?? undefined}
              data-word-key={p.key}
              data-open={open?.n === p.n || undefined}
              {...markTrait(p.mark)}
              className="tw"
              onClick={() => {
                setCurrent(p.n);
                setOpen(p);
              }}
              onKeyDown={(e) => onKey(e, p)}
            >
              {p.text}
              {p.mark && <span className="sr-only">{SPOKEN[p.mark]}</span>}
            </span>
          )
        )}
      </div>
      {open && (
        <WordSheet
          unit={open}
          fillers={fillers}
          onPlay={onPlay}
          repId={repId}
          doorToWords={doorToWords}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

/** What a screen reader hears after a marked word. */
const SPOKEN: Record<Exclude<WordMark, null>, string> = {
  filler: ", filler",
  vague: ", vague",
  repeat: ", said 3 or more times",
};

/** The trait whose tone a mark wears: Fillers for a filler, Variety for the rest. */
function markTrait(mark: WordMark): { "data-trait"?: string } {
  if (mark === "filler") return { "data-trait": "fillers" };
  if (mark === "vague" || mark === "repeat") return { "data-trait": "range" };
  return {};
}

/** A key entry: a scrap of the underline itself, then its word. */
function Key({ mark, children }: { mark: Exclude<WordMark, null>; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5" {...markTrait(mark)}>
      <span className="tw-key" data-word-mark={mark} />
      {children}
    </span>
  );
}
