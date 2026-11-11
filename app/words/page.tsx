"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { DemosArt } from "@/components/DemosArt";
import { ErrorLine, ErrorState } from "@/components/ui/ErrorState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { UndoToast } from "@/components/ui/Toast";
import { readable } from "@/lib/load";
import {
  fetchSavedWords,
  noteRemoved,
  noteSaved,
  removeSavedWord,
  restoreSavedWord,
  withRow,
  type SavedWord,
} from "@/lib/saved-words";
import { ACTION_CLASS } from "@/lib/ui";

/** Where back goes: You, or the recording whose sheet opened this. */
function backOf(from: string | string[] | undefined) {
  const path = typeof from === "string" ? from : null;
  return path && /^\/rep\/[\w-]{1,64}$/.test(path)
    ? { href: path, label: "Recording" }
    : { href: "/you", label: "You" };
}

/**
 * Your words (#411; Timothy: "a separate thesaurus page where saved words
 * to use instead, like the lexicon feature"). Every swap saved from a
 * recording's word sheet: the word you said, then what to say instead,
 * the sentence it came from under them, and a way to take it off.
 *
 * The lexicon's grammar (You, #317): rows on the ground split by
 * hairlines at reading size, the new word as a neutral label in ink, an
 * example drawn the way a real row will be when there is none. A removal
 * is off the list at once, with no "are you sure", and for a few seconds
 * a toast offers Undo (#435), which puts the same row back in its place;
 * a removal or an undo that fails says so in a line with its retry. A
 * failed read is a retry, never an empty list (#147).
 */
export default function YourWords({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = use(searchParams);
  const back = backOf(from);
  const [rows, setRows] = useState<SavedWord[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** A removal that did not land: its row is back, and this says so. */
  const [unremoved, setUnremoved] = useState<string | null>(null);
  /** An undo that did not land: its row is off again, and this says so. */
  const [unrestored, setUnrestored] = useState<SavedWord | null>(null);
  /** The removal the toast offers to take back: the newest one only. */
  const [undo, setUndo] = useState<SavedWord | null>(null);
  /** Each removal's own request, so an undo never overtakes the removal it undoes. */
  const leaving = useRef(new Map<string, Promise<boolean>>());
  const [said, setSaid] = useState("");

  const load = useCallback(async () => {
    setFailed(false);
    setRows(null);
    const read = await readable(() => fetchSavedWords());
    if (read.ok) setRows(read.data);
    else setFailed(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (row: SavedWord, from?: HTMLElement | null) => {
    setUnremoved(null);
    setUnrestored(null);
    /* The keyboard stays in the list: the next row's own button (or the
       one before the last), since the one pressed leaves with its row. */
    const li = from?.closest("li");
    const next = (li?.nextElementSibling ?? li?.previousElementSibling)?.querySelector("button");
    setRows((now) => now?.filter((r) => r.id !== row.id) ?? now);
    // The toast is the status: it says the removal and offers it back.
    setSaid("");
    setUndo(row);
    noteRemoved(row.word, row.instead);
    if (next instanceof HTMLElement) next.focus({ preventScroll: true });
    const gone = removeSavedWord(row.id).then(
      () => true,
      () => false
    );
    leaving.current.set(row.id, gone);
    if (await gone) return;
    leaving.current.delete(row.id);
    setUndo((now) => (now?.id === row.id ? null : now));
    setRows((now) => (now ? withRow(now, row) : now));
    noteSaved(row);
    setUnremoved(row.instead);
  };

  /** Undo: the same row, back in its place, once its removal has answered. */
  const putBack = async (row: SavedWord) => {
    setUndo(null);
    setUnrestored(null);
    setRows((now) => (now ? withRow(now, row) : now));
    setSaid(`${row.instead} is back`);
    const gone = await (leaving.current.get(row.id) ?? Promise.resolve(true));
    leaving.current.delete(row.id);
    // The removal never landed: the row is still saved, and already back on screen.
    if (!gone) return;
    try {
      noteSaved(await restoreSavedWord(row));
    } catch {
      setRows((now) => now?.filter((r) => r.id !== row.id) ?? now);
      setUnrestored(row);
      setSaid("");
    }
  };

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-[var(--nav-clear)] pt-7">
      <ScreenHeader
        title="Your words"
        back={back}
        subtitle={
          rows === null ? (
            failed ? (
              " "
            ) : (
              <span className="inline-block py-0.5 align-middle">
                <Skeleton className="h-3.5 w-20" />
              </span>
            )
          ) : rows.length === 0 ? (
            "\u00a0"
          ) : (
            `${rows.length} saved`
          )
        }
      />
      <p role="status" className="sr-only">
        {said}
      </p>
      {/* Over whatever the list now is, the empty page included: an undo
          that did not land. */}
      {unrestored && rows !== null && (
        <ErrorLine className="mt-3" onRetry={() => void putBack(unrestored)}>
          {unrestored.instead} didn&apos;t come back.
        </ErrorLine>
      )}

      {failed ? (
        <ErrorState
          className="mt-5"
          title="Your words didn't load."
          body="They're still saved. Check your connection and try again."
          onRetry={() => void load()}
        />
      ) : rows === null ? (
        <SkeletonRegion label="Loading your words" className="mt-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-b border-hairline py-3">
              <div className="flex min-h-11 items-center gap-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="ml-auto size-11" rounded="rounded-full" />
              </div>
              <Skeleton className="mt-1 h-3.5 w-56" />
            </div>
          ))}
        </SkeletonRegion>
      ) : rows.length === 0 ? (
        /* The example (You's lexicon, #317): one swap drawn the way a real
           one will be, so the empty page shows what arrives here, with
           Demos listening over it and the one way to fill it. */
        /* A one-thing screen gives its free height to the card (#368):
           Demos and the example centred in it, the one tap at its foot. */
        <section className="card arrive mt-5 flex flex-1 flex-col p-5 text-center">
          {/* He takes the card's free height (150 to 280px), standing on
              the example, the pair centred in what is left, so a tall
              phone gets more of him rather than ground. */}
          <div className="flex flex-1 flex-col justify-center">
            <div className="demos-fit w-full flex-1">
              <div className="demos-fit-room">
                <DemosArt pose="listening" size={280} fit />
              </div>
            </div>
            <div aria-hidden className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-detail font-normal">
              <span>very cold</span>
              <span className="text-body text-stone-500">instead:</span>
              <span className="you-word">freezing</span>
            </div>
            <p className="mx-auto mt-3 max-w-[30ch] text-body text-pretty text-stone-500">
              Tap any word in a recording to find a better one.
            </p>
          </div>
          <Link href="/history" className={`${ACTION_CLASS} mt-4`}>
            Open the Log
          </Link>
        </section>
      ) : (
        <>
          {unremoved && (
            <ErrorLine className="mt-3" onRetry={() => {
              const row = rows.find((r) => r.instead === unremoved);
              if (row) void remove(row);
            }}>
              {unremoved} didn&apos;t come off the list.
            </ErrorLine>
          )}

          {/* No margin: each row's 12px top padding is the header's mt-3
              (system-7), as the lexicon's rows are. */}
          <ul className="stagger mt-2">
            {rows.map((r) => (
              <li key={r.id} className="border-b border-hairline py-3">
                <div className="flex min-h-11 items-center gap-3">
                  <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-detail font-normal">
                    <span className="break-words">{r.word}</span>
                    <span className="text-body text-stone-500">instead:</span>
                    <span className="you-word break-words">{r.instead}</span>
                  </p>
                  <button
                    type="button"
                    onClick={(e) => void remove(r, e.currentTarget)}
                    aria-label={`Remove ${r.instead} instead of ${r.word}`}
                    className="press -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-stone-400"
                  >
                    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" />
                    </svg>
                  </button>
                </div>
                {r.sentence && (
                  <p className="mt-0.5 line-clamp-2 pr-10 text-caption text-stone-500">
                    “<Said sentence={r.sentence} word={r.word} />”
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {undo && (
        <UndoToast
          key={undo.id}
          message={`${undo.instead} removed`}
          onUndo={() => void putBack(undo)}
          onDone={() => setUndo((now) => (now?.id === undo.id ? null : now))}
        />
      )}
    </main>
  );
}

/** The sentence with the word it came from in ink, where it was said. */
function Said({ sentence, word }: { sentence: string; word: string }) {
  const at = sentence.toLowerCase().search(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`));
  if (at < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, at)}
      <span className="font-semibold text-ink">{sentence.slice(at, at + word.length)}</span>
      {sentence.slice(at + word.length)}
    </>
  );
}
