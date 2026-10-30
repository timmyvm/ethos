"use client";

import { useEffect, useRef, useState } from "react";
import { ErrorLine } from "@/components/ui/ErrorState";
import { Segmented } from "@/components/ui/Segmented";
import { MATCH_COPY } from "@/content/tester";
import { fetchMatch, saveMatch } from "@/lib/tester-client";
import {
  asksForNote,
  cleanNote,
  feedbackRow,
  NOTE_MAX,
  sameSave,
  type MatchAnswer,
  type ScoreSnapshot,
} from "@/lib/tester";
import { DISABLED_CLASS, INPUT_CLASS } from "@/lib/ui";

type Status = "idle" | "saving" | "saved" | "failed";

/**
 * The match check (migration 0020, docs/testers.md): a tester's one
 * question about the score they were just shown. Testers only; the
 * results screen decides that (`showsMatchCheck`) and a non-tester's
 * screen never mounts this.
 *
 * It is the screen's quiet second thing, never its tap: the neutral
 * segmented control (no terracotta, no lift), one tap to answer, and the
 * answer can change. Roughly and No open a note, optional, saved with
 * its own secondary button or when the field is left. Every save is the
 * whole row upserted on the recording's outbox key, so the last answer
 * wins and a retry sends exactly what is on screen; a save that has not
 * landed waits on the phone and goes again from the next recording
 * screen (lib/tester-client.ts).
 *
 * It asks on the debrief's last step, after the score and the numbers,
 * and again at the foot of the recording's page in the Log, where an
 * answer already given opens as it was left and the numbers it was
 * given about stay the ones stored with it.
 */
export function MatchCheck({
  clientId,
  repId,
  scores,
  className = "",
}: {
  clientId: string;
  repId: string | null;
  scores: ScoreSnapshot;
  className?: string;
}) {
  const [answer, setAnswer] = useState<MatchAnswer | null>(null);
  const [note, setNote] = useState("");
  /** The note as the last save that landed carried it. */
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  /* Saves run one after another, and only the newest one's outcome is
     said: an older answer landing late never reads as the current one. */
  const queue = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(0);
  const last = useRef<{ answer: MatchAnswer; note: string } | null>(null);
  /** The numbers this answer is about: the ones on screen, or the ones
      an earlier answer about this recording was given with. */
  const shown = useRef(scores);

  /* An answer already given about this recording opens as it was left,
     unless the tester has already picked. A failed read asks afresh. */
  useEffect(() => {
    let live = true;
    fetchMatch(clientId)
      .then((given) => {
        if (!live || !given || last.current) return;
        if (given.scores) shown.current = given.scores;
        const n = given.note ?? "";
        last.current = { answer: given.answer, note: n };
        setAnswer(given.answer);
        setNote(n);
        setSavedNote(given.note);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [clientId]);

  function save(a: MatchAnswer, n: string) {
    // Leaving the note's field saved it; the Save note tap that left it
    // is the same save (T6). A failed one always goes again.
    if (status !== "failed" && sameSave(last.current, { answer: a, note: n })) return;
    const mine = ++latest.current;
    last.current = { answer: a, note: n };
    setStatus("saving");
    queue.current = queue.current.then(async () => {
      const row = feedbackRow({ clientId, repId, answer: a, note: n, scores: shown.current });
      const ok = await saveMatch(row);
      if (mine !== latest.current) return;
      setStatus(ok ? "saved" : "failed");
      if (ok) setSavedNote(row.note);
    });
  }

  const retry = () => {
    const l = last.current;
    if (!l) return;
    last.current = null;
    save(l.answer, l.note);
  };

  const pick = (a: MatchAnswer) => {
    setAnswer(a);
    save(a, note);
  };
  const noteOpen = asksForNote(answer);
  const noteDirty = noteOpen && cleanNote(note) !== savedNote;
  const saveNote = () => {
    if (answer && noteDirty) save(answer, note);
  };

  return (
    <section aria-labelledby="match-question" className={`text-left ${className}`}>
      <h2 id="match-question" className="font-display text-row text-ink">
        {MATCH_COPY.question}
      </h2>
      <Segmented
        label={MATCH_COPY.question}
        options={MATCH_COPY.options}
        value={answer}
        onChange={(v) => pick(v as MatchAnswer)}
        className="mt-3"
      />

      {noteOpen && (
        <div className="reveal mt-4">
          <label htmlFor="match-note" className="eyebrow block">
            {MATCH_COPY.notePrompt}
          </label>
          <textarea
            id="match-note"
            rows={2}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            /* The key says done, so it is done: the field lets go and
               leaving it saves. Shift+Enter still breaks a line. */
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            placeholder={MATCH_COPY.notePlaceholder}
            enterKeyHint="done"
            /* While it has focus a sticky shelf steps back into the flow
               (app/globals.css, #match-note), so a keyboard that shrinks
               the page never leaves the shelf over the field. */
            className={`${INPUT_CLASS} mt-1.5 block resize-none py-2.5 leading-snug`}
          />
        </div>
      )}

      {/* One line says how the last save went, beside the note's own
          button when there is a note. Its height is held from the first
          answer on, so the line changing never moves the screen. */}
      {answer !== null && (
        <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
          {status === "failed" ? (
            <ErrorLine onRetry={retry}>
              {MATCH_COPY.failed}
            </ErrorLine>
          ) : (
            <p role="status" className="text-caption text-stone-500">
              {status === "saving"
                ? MATCH_COPY.saving
                : status === "saved"
                  ? noteOpen
                    ? savedNote && !noteDirty
                      ? MATCH_COPY.noteSaved
                      : MATCH_COPY.answerSaved
                    : MATCH_COPY.saved
                  : ""}
            </p>
          )}
          {/* The note's own save, once there is a note to save: an empty
              field needs nothing, and a dead button beside a failed line
              was one control too many. */}
          {noteOpen && (cleanNote(note) !== null || savedNote !== null) && (
            <button
              type="button"
              onClick={saveNote}
              disabled={!noteDirty}
              className={`press font-display min-h-11 shrink-0 rounded-control border border-edge bg-surface px-4 text-row ${DISABLED_CLASS}`}
            >
              {MATCH_COPY.saveNote}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
