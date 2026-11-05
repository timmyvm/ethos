"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconCheck, IconPlay, IconPlus } from "@/components/Icon";
import { Disclosure } from "@/components/ui/Disclosure";
import { Overlay, useOverlayClose } from "@/components/ui/Overlay";
import { Skeleton } from "@/components/ui/Skeleton";
import type { FillerHit } from "@/lib/metrics";
import {
  knownSaved,
  noteRemoved,
  noteSaved,
  pairKey,
  removeSavedWord,
  saveWord,
} from "@/lib/saved-words";
import { fillerWhy } from "@/lib/thesaurus";
import { clockOf, type TranscriptUnit } from "@/lib/transcript-words";
import { alternativesFor, askFor, heldAlternatives } from "@/lib/words-client";

/** Rows the list holds its place for while it loads, and on a failure. */
const HELD_ROWS = 4;

type Alternatives =
  | { state: "loading" }
  | { state: "ready"; list: string[] }
  | { state: "failed" };

/** A swap's save: the row id once it landed, or in flight either way. */
type Saved = { id: string | null; busy: boolean };

/**
 * The word sheet (#411): a tapped word, large, rising on the app's sheet
 * (components/ui/Overlay.tsx), with when it was said and what to say
 * instead. Kiku's card, Ethos's grammar: the raised sheet, the grabber,
 * Outfit at the large title's 34/800, one quiet Done.
 *
 *  - A filler offers no synonyms: "Pause instead." and one sentence on
 *    why, then its share of the recording's fillers, counted.
 *  - A small word ("the") has nothing to swap, and says so.
 *  - Any other word lists three to six alternatives, each with Save.
 *    The curated map and the phone's kept answers land at once; a word
 *    the server has to read shows its rows' skeleton, and a failure
 *    says so in the same place with its retry.
 *
 * "Said at 0:14" plays the recording from there when the screen has a
 * player; without one it is the time alone.
 */
export function WordSheet({
  unit,
  fillers,
  onPlay,
  repId,
  doorToWords,
  onClose,
}: {
  unit: TranscriptUnit;
  fillers: FillerHit[];
  onPlay?: (t: number) => void;
  repId: string | null;
  doorToWords: boolean;
  onClose: () => void;
}) {
  const abort = useRef<AbortController | null>(null);
  return (
    <Overlay
      label={unit.display}
      onClose={onClose}
      onLeave={() => abort.current?.abort()}
      className="w-full max-w-[430px]"
    >
      <Body unit={unit} fillers={fillers} onPlay={onPlay} repId={repId} doorToWords={doorToWords} onClose={onClose} abort={abort} />
    </Overlay>
  );
}

function Body({
  unit,
  fillers,
  onPlay,
  repId,
  doorToWords,
  onClose,
  abort,
}: {
  unit: TranscriptUnit;
  fillers: FillerHit[];
  onPlay?: (t: number) => void;
  repId: string | null;
  doorToWords: boolean;
  onClose: () => void;
  abort: React.RefObject<AbortController | null>;
}) {
  const close = useOverlayClose(onClose);
  const offers = unit.mark !== "filler" && !unit.small;
  const ask = askFor(unit.display, unit.sentence);
  const [alts, setAlts] = useState<Alternatives>(() => {
    if (!offers) return { state: "ready", list: [] };
    const held = heldAlternatives(ask);
    return held ? { state: "ready", list: held } : { state: "loading" };
  });
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState<Record<string, Saved>>({});
  /** What the door under the list says: nothing yet, a save landed, or one failed. */
  const [door, setDoor] = useState<"idle" | "saved" | "failed">("idle");
  const [said, setSaid] = useState("");

  // The server's alternatives, for a word the phone does not hold.
  useEffect(() => {
    if (alts.state !== "loading") return;
    const controller = new AbortController();
    abort.current = controller;
    alternativesFor(ask, controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) setAlts({ state: "ready", list });
      })
      .catch(() => {
        if (!controller.signal.aborted) setAlts({ state: "failed" });
      });
    return () => controller.abort();
    // `ask` is rebuilt each render from the unit; the attempt is what re-asks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alts.state, attempt]);

  // The swaps already saved from this word, marked as saved when the sheet opens.
  useEffect(() => {
    if (!offers) return;
    let live = true;
    void knownSaved().then((known) => {
      if (!live || !known) return;
      setSaved((now) => {
        const next = { ...now };
        for (const [key, id] of known) {
          const [word, instead] = key.split("|");
          if (word === unit.display.toLowerCase() && !next[instead]) next[instead] = { id, busy: false };
        }
        return next;
      });
    });
    return () => {
      live = false;
    };
  }, [offers, unit.display]);

  const toggle = async (instead: string) => {
    const key = instead.toLowerCase();
    const was = saved[key];
    if (was?.busy) return;
    if (was) {
      // Off the list, at once; back if the removal fails.
      setSaved(({ [key]: _gone, ...rest }) => rest);
      setSaid(`${instead} removed from Your words`);
      noteRemoved(unit.display, instead);
      if (!was.id) return;
      try {
        await removeSavedWord(was.id);
      } catch {
        setSaved((now) => ({ ...now, [key]: was }));
        setDoor("failed");
        setSaid("That didn't save.");
      }
      return;
    }
    setSaved((now) => ({ ...now, [key]: { id: null, busy: true } }));
    setDoor("saved");
    setSaid(`${instead} saved to Your words`);
    try {
      const row = await saveWord({ word: unit.display, instead, sentence: unit.sentence, repId });
      noteSaved(row);
      setSaved((now) => (now[key] ? { ...now, [key]: { id: row.id, busy: false } } : now));
    } catch {
      setSaved(({ [key]: _gone, ...rest }) => rest);
      setDoor("failed");
      setSaid("That didn't save.");
    }
  };

  const eyebrow =
    unit.mark === "filler"
      ? "Filler"
      : unit.mark === "vague"
        ? "Vague word"
        : unit.mark === "repeat"
          ? `Said ${unit.times} times`
          : null;
  const trait = unit.mark === "filler" ? "fillers" : unit.mark ? "range" : undefined;
  const context = around(unit);
  const sameFiller = unit.filler ? fillers.filter((f) => f.word === unit.filler).length : 0;

  return (
    <div
      data-trait={trait}
      className="word-sheet elev-3 rounded-t-sheet bg-raised px-6 pt-3"
    >
      <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-300" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {/* The line over the word holds its height with or without a kind. */}
          <div className="eyebrow flex min-h-[18px] items-center gap-1.5">
            {eyebrow && (
              <>
                <span aria-hidden className="trait-dot" />
                {eyebrow}
              </>
            )}
          </div>
          {/* The word lifted out of the paragraph, its mark with it. */}
          <h2 className="word-sheet-word mt-1 break-words" data-word-mark={unit.mark ?? undefined}>
            {unit.display}
          </h2>
        </div>
        <button
          type="button"
          onClick={close}
          className="press -mr-2 -mt-1 inline-flex min-h-11 shrink-0 items-center px-2 text-link text-stone-500"
        >
          Done
        </button>
      </div>

      {/* The sentence it was said in, the word set apart where it stands:
          the scrim hides the paragraph, and a swap is chosen for a
          sentence, not a word. */}
      {context && (
        <p className="mt-3 line-clamp-3 text-body text-stone-500">
          {context.before}
          <span className="word-in-sentence" data-word-mark={unit.mark ?? undefined}>
            {context.word}
          </span>
          {context.after}
        </p>
      )}

      {unit.start !== null &&
        (onPlay ? (
          <button
            type="button"
            onClick={() => onPlay(Math.max(0, unit.start! - 0.3))}
            aria-label={`Play from ${clockOf(unit.start)}`}
            className="press mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-edge bg-surface py-1 pl-3 pr-4 text-link text-ink"
          >
            <span className="text-terracotta-500">
              <IconPlay size={14} />
            </span>
            Said at <span className="tabular-nums">{clockOf(unit.start)}</span>
          </button>
        ) : (
          <p className="mt-3 flex min-h-11 items-center text-link text-stone-500">
            Said at <span className="ml-1 tabular-nums">{clockOf(unit.start)}</span>
          </p>
        ))}

      {unit.mark === "filler" ? (
        <section className="mt-6">
          <h3 className="detail-head">Pause instead.</h3>
          <p className="mt-1.5 text-read text-stone-600">{fillerWhy(unit.filler ?? unit.key)}</p>
          {fillers.length > 0 && sameFiller > 0 && (
            <p className="mt-3 text-caption text-stone-500">
              “{unit.filler}”, {sameFiller} of {fillers.length} filler{fillers.length === 1 ? "" : "s"} in this recording.
            </p>
          )}
        </section>
      ) : unit.small ? (
        <p className="mt-6 text-read text-stone-500">Nothing to swap in a word this small.</p>
      ) : (
        <section className="mt-6" aria-busy={alts.state === "loading" || undefined}>
          <h3 className="detail-head">Try instead</h3>
          <div className="word-sheet-list mt-1">
            {alts.state === "loading" ? (
              <ul aria-hidden>
                {Array.from({ length: HELD_ROWS }, (_, i) => (
                  <li key={i} className="word-row border-b border-hairline last:border-b-0">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-11 w-[86px]" />
                  </li>
                ))}
              </ul>
            ) : alts.state === "failed" ? (
              /* In the rows' place: what failed, and the retry as a key a
                 thumb can hit. Never an empty list. */
              <div role="alert" className="pt-3">
                <p className="text-body text-stone-500">The alternatives didn&apos;t load.</p>
                <button
                  type="button"
                  onClick={() => {
                    setAlts({ state: "loading" });
                    setAttempt((n) => n + 1);
                  }}
                  className="press font-display mt-3 inline-flex min-h-11 items-center rounded-control border border-edge bg-surface px-4 text-row"
                >
                  Try again
                </button>
              </div>
            ) : (
              <ul className="stagger">
                {alts.list.map((alt) => {
                  const s = saved[alt.toLowerCase()];
                  return (
                    <li key={alt} className="word-row border-b border-hairline last:border-b-0">
                      <span className="font-display min-w-0 text-detail break-words">{alt}</span>
                      <button
                        type="button"
                        onClick={() => void toggle(alt)}
                        aria-pressed={!!s}
                        aria-label={s ? `Saved: ${alt} instead of ${unit.display}` : `Save ${alt} instead of ${unit.display}`}
                        className={`press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control border px-3.5 text-link ${
                          s ? "border-transparent bg-surface text-ink" : "border-edge bg-raised text-ink"
                        }`}
                      >
                        {s ? <IconCheck size={15} /> : <IconPlus size={15} />}
                        {s ? "Saved" : "Save"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* The door to the list, always in its place: after a save it
              says where the swap went, and a failed save says so here. */}
          {door === "failed" ? (
            <p role="alert" className="mt-2 flex min-h-11 items-center text-link text-stone-500">
              That didn&apos;t save. Tap Save to try again.
            </p>
          ) : !doorToWords ? (
            /* The live walk: where the swap went, and no way off the debrief. */
            <p className="mt-2 flex min-h-11 items-center text-link text-stone-500">
              {door === "saved" ? "Saved to Your words, on You." : ""}
            </p>
          ) : (
            <Link
              href={repId ? `/words?from=${encodeURIComponent(`/rep/${repId}`)}` : "/words"}
              className="press-row -mx-2 mt-2 flex min-h-11 items-center justify-between gap-3 rounded-control px-2 text-link text-ink"
            >
              <span>{door === "saved" ? "Saved to Your words" : "Your words"}</span>
              <Disclosure />
            </Link>
          )}
        </section>
      )}
      <p role="status" className="sr-only">
        {said}
      </p>
    </div>
  );
}

/** Characters of the sentence kept either side of the word, so a long one still shows it. */
const CONTEXT = 70;

/** The sentence around the word: whole when short, cut at word breaks either side when long. */
function around(unit: TranscriptUnit): { before: string; word: string; after: string } | null {
  const s = unit.sentence;
  if (!s) return null;
  const at = unit.inSentence;
  const end = at + unit.text.length;
  let before = s.slice(0, at);
  let after = s.slice(end);
  if (before.length > CONTEXT) {
    const cut = before.slice(-CONTEXT);
    before = `\u2026${cut.slice(Math.max(0, cut.indexOf(" ") + 1))}`;
  }
  if (after.length > CONTEXT) {
    const cut = after.slice(0, CONTEXT);
    after = `${cut.slice(0, Math.max(1, cut.lastIndexOf(" ")))}\u2026`;
  }
  return { before, word: s.slice(at, end), after };
}
