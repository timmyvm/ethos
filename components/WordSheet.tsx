"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { prefersReducedMotion } from "@/lib/prefs";
import { SPRING, springEasing, springMs } from "@/lib/spring";
import { fillerWhy } from "@/lib/thesaurus";
import { clockOf, type TranscriptUnit } from "@/lib/transcript-words";
import { replacesPhrase, type WordAnswer } from "@/lib/words";
import { WordsUnavailable, answerFor, askFor, heldAnswer } from "@/lib/words-client";

/** Rows the list holds its place for while it loads, and on a failure: a typical swap. */
const HELD_ROWS = 3;

type Answer =
  | { state: "none" }
  | { state: "loading" }
  | { state: "ready"; answer: WordAnswer }
  | { state: "failed"; offline: boolean };

/** A swap's save: the row id once it landed, or in flight either way. */
type Saved = { id: string | null; busy: boolean };

/**
 * The word sheet (#411): a tapped word, large, rising on the app's sheet
 * (components/ui/Overlay.tsx), with when it was said and what to say
 * instead. Kiku's card, Ethos's grammar: the raised sheet, the grabber,
 * Outfit at the large title's 34/800, and the information sheets' one
 * Done (D15) on the word's row.
 *
 *  - A filler offers no synonyms: "Pause instead." and one sentence on
 *    why, then its share of the recording's fillers, counted.
 *  - A small word ("the") has nothing to swap, and says so.
 *  - Any other word is read in its sentence by the server (#428) and
 *    answered one of two ways. Swap: "Try instead" and one to three
 *    rows, each with Save; when the better phrasing replaces more than
 *    the word ("switch things up"), the sentence sets the whole phrase
 *    apart and one caption says "In place of" it, and Save keeps the
 *    phrase as the word said. Keep: "Keep it." and one line on why
 *    ("A currency says it exactly."), with nothing to save. While the
 *    server reads, the head and three rows are skeletons, since nothing
 *    promises a list before the verdict; a failure says so in the same
 *    place with its retry ("You're offline" when the phone knows), and
 *    the region glides to the answer's height on the base spring.
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
  const ask = useMemo(() => askFor(unit.display, unit.sentence, unit.inSentence), [unit.display, unit.sentence, unit.inSentence]);
  const [alts, setAlts] = useState<Answer>(() => {
    if (!offers) return { state: "none" };
    const held = heldAnswer(ask);
    return held ? { state: "ready", answer: held } : { state: "loading" };
  });
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState<Record<string, Saved>>({});
  /** What the door under the list says: nothing yet, a save landed, or one failed. */
  const [door, setDoor] = useState<"idle" | "saved" | "failed">("idle");
  const [said, setSaid] = useState("");

  // The server's answer, for a word the phone does not hold.
  useEffect(() => {
    if (alts.state !== "loading") return;
    const controller = new AbortController();
    abort.current = controller;
    answerFor(ask, controller.signal)
      .then((answer) => {
        if (!controller.signal.aborted) setAlts({ state: "ready", answer });
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setAlts({ state: "failed", offline: e instanceof WordsUnavailable && e.offline });
      });
    return () => controller.abort();
    // `ask` is the unit's; the attempt is what re-asks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alts.state, attempt]);

  const answer = alts.state === "ready" ? alts.answer : null;
  const swap = answer?.verdict === "swap" ? answer : null;
  /** What a save keeps as the word said: the phrase a swap replaces, which is often the word itself. */
  const savedAs = swap ? swap.replaces : null;
  const phrase = swap && replacesPhrase(swap, unit.display) ? swap.replaces : null;

  // The swaps already saved for what this answer replaces, marked as saved once it lands.
  useEffect(() => {
    if (!savedAs) return;
    let live = true;
    const word = savedAs.trim().toLowerCase();
    void knownSaved().then((known) => {
      if (!live || !known) return;
      setSaved((now) => {
        const next = { ...now };
        for (const [key, id] of known) {
          const [w, instead] = key.split("|");
          if (w === word && !next[instead]) next[instead] = { id, busy: false };
        }
        return next;
      });
    });
    return () => {
      live = false;
    };
  }, [savedAs]);

  /* The answer region moves from the held rows' height to the answer's
     on the base spring, so the sheet's top glides when a keep lands
     about 100px shorter (DESIGN.md: nothing teleports). Reduced motion
     and lite take the new height at once. */
  const region = useRef<HTMLElement>(null);
  const lastHeight = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = region.current;
    if (!el) return;
    const to = el.getBoundingClientRect().height;
    const from = lastHeight.current;
    lastHeight.current = to;
    if (from === null || Math.abs(from - to) < 1 || prefersReducedMotion() || typeof el.animate !== "function") return;
    el.style.overflow = "hidden";
    const run = el.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: springMs(SPRING.base),
      easing: springEasing(SPRING.base),
    });
    const settle = () => {
      el.style.overflow = "";
    };
    run.onfinish = settle;
    run.oncancel = settle;
  }, [alts]);

  const toggle = async (instead: string) => {
    if (!savedAs) return;
    const key = instead.toLowerCase();
    const was = saved[key];
    if (was?.busy) return;
    if (was) {
      // Off the list, at once; back if the removal fails.
      setSaved(({ [key]: _gone, ...rest }) => rest);
      setSaid(`${instead} removed from Your words`);
      noteRemoved(savedAs, instead);
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
      const row = await saveWord({ word: savedAs, instead, sentence: unit.sentence, repId });
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
  const context = around(unit, answer?.replaces ?? null);
  const sameFiller = unit.filler ? fillers.filter((f) => f.word === unit.filler).length : 0;

  return (
    <div
      data-trait={trait}
      className="word-sheet elev-3 rounded-t-sheet bg-raised px-6 pt-3"
    >
      <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-300" />
      {/* The line over the word holds its height with or without a kind. */}
      <div className="eyebrow flex min-h-[18px] items-center gap-1.5">
        {eyebrow && (
          <>
            <span aria-hidden className="trait-dot" />
            {eyebrow}
          </>
        )}
      </div>
      {/* The word lifted out of the paragraph, its mark with it, and Done
          on its row at the right: the one Done every information sheet
          wears (D15), Outfit 17/600 in ink, beside the sheet's title as
          "Every number" has it, so the two never stack in two styles (the
          #427 review). */}
      <div className="mt-1 flex items-start justify-between gap-4">
        <h2 className="word-sheet-word min-w-0 break-words" data-word-mark={unit.mark ?? undefined}>
          {unit.display}
        </h2>
        <button
          type="button"
          onClick={close}
          data-look="sheet-done"
          className="press font-display -mr-3 min-h-11 min-w-11 shrink-0 rounded-control px-3 text-detail font-semibold text-ink"
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
          <span
            key={context.word}
            className="word-in-sentence"
            data-word-mark={unit.mark ?? undefined}
            data-widened={context.word.length > unit.text.length || undefined}
          >
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
        <section ref={region} className="mt-6" aria-busy={alts.state === "loading" || undefined}>
          {alts.state === "loading" ? (
            /* Nothing promises a list before the verdict: the head is a
               skeleton too. */
            <div aria-hidden className="flex h-[22px] items-center">
              <Skeleton className="h-5 w-28" />
            </div>
          ) : answer?.verdict === "keep" ? (
            <h3 className="detail-head">Keep it.</h3>
          ) : (
            <h3 className="detail-head">Try instead</h3>
          )}
          {answer?.verdict === "keep" ? (
            <p className="mt-1.5 text-read text-stone-600">{answer.note}</p>
          ) : (
            <>
              {phrase && (
                <p className="mt-1 text-body text-stone-500">
                  In place of <span className="text-ink">“{phrase}”</span>
                </p>
              )}
              <div className="word-sheet-list mt-1" data-held={alts.state === "loading" || alts.state === "failed" || undefined}>
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
                    <p className="text-body text-stone-500">
                      {alts.offline ? "You're offline, so the alternatives didn't load." : "The alternatives didn't load."}
                    </p>
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
                ) : swap ? (
                  <ul className="stagger">
                    {swap.alternatives.map((alt) => {
                      const s = saved[alt.toLowerCase()];
                      return (
                        <li key={alt} className="word-row border-b border-hairline last:border-b-0">
                          <span className="font-display min-w-0 text-detail break-words">{alt}</span>
                          <button
                            type="button"
                            onClick={() => void toggle(alt)}
                            aria-pressed={!!s}
                            aria-label={s ? `Saved: ${alt} instead of ${swap.replaces}` : `Save ${alt} instead of ${swap.replaces}`}
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
                ) : null}
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
            </>
          )}
        </section>
      )}
      <p role="status" className="sr-only">
        {said || (answer?.verdict === "keep" ? `Keep it. ${answer.note}` : "")}
      </p>
    </div>
  );
}

/** Characters of the sentence kept either side of the word, so a long one still shows it. */
const CONTEXT = 70;

/**
 * Where `phrase` stands in the sentence over the tapped word, by the
 * unit's own place: whole words, any case, any run of spaces between
 * them. Null when it is not there.
 */
function phraseAt(unit: TranscriptUnit, phrase: string): { from: number; to: number } | null {
  const words = phrase
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['’]/g, "['’]"));
  if (words.length === 0) return null;
  // No lookbehind: older iPhones' Safari cannot compile one.
  const re = new RegExp(words.join("\\s+"), "giu");
  const inWord = (c: string | undefined) => !!c && /[\p{L}\p{N}'’]/u.test(c);
  const s = unit.sentence;
  const wordEnd = unit.inSentence + unit.text.length;
  for (const m of s.matchAll(re)) {
    const from = m.index ?? 0;
    const to = from + m[0].length;
    if (inWord(s[from - 1]) || inWord(s[to])) continue;
    if (from <= unit.inSentence && to >= wordEnd) return { from, to };
  }
  return null;
}

/**
 * The sentence around the word, or around the phrase an answer
 * replaces: whole when short, cut at word breaks either side when long.
 */
function around(unit: TranscriptUnit, replaces: string | null): { before: string; word: string; after: string } | null {
  const s = unit.sentence;
  if (!s) return null;
  const span = (replaces && phraseAt(unit, replaces)) || { from: unit.inSentence, to: unit.inSentence + unit.text.length };
  const at = span.from;
  const end = span.to;
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
