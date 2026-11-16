/**
 * The wait after Stop, as the route reports it (#472).
 *
 * It used to step through five labels on a 1.5 second clock and then
 * hold on the last for as long as Demos took, so for most of the wait
 * the list said nothing the phone knew. Now each row is a stage the
 * route has reached (lib/analyze-stream.ts), and a row that has a
 * number shows it the moment it exists: how many words, the fillers
 * and the first one's time, the pace. Nothing here is estimated, nothing
 * counts a percentage, and a stage the phone has not heard of is never
 * drawn as done.
 */
import { clock } from "./glance";
import type { AnalyzeEvent, EarlyRead } from "./analyze-stream";

/** Where the take is, in the order it gets there. */
export type WaitStage = "sending" | "received" | "transcribing" | "reading" | "saving";

const ORDER: WaitStage[] = ["sending", "received", "transcribing", "reading", "saving"];
const rank = (s: WaitStage) => ORDER.indexOf(s);

export interface WaitState {
  stage: WaitStage;
  /** The words and their counts, once the route has them. */
  early: EarlyRead | null;
}

/** Stop, before the route has said anything. */
export const WAIT_START: WaitState = { stage: "sending", early: null };

/**
 * One line from the route, applied. Stages only go forward; the early
 * read, once in, stays (a resend is the same audio, so the same words).
 * The words being in means Demos reads next, or, on a take he does not
 * read (too short, or no read left), the save.
 */
export function nextWait(state: WaitState, event: AnalyzeEvent): WaitState {
  const early = event.stage === "measured" ? event.early : state.early;
  const stage: WaitStage =
    event.stage === "measured" ? (event.early.reads ? "reading" : "saving") : event.stage;
  return rank(stage) >= rank(state.stage) ? { stage, early } : { stage: state.stage, early };
}

/** A resend starts the stages again and keeps the words it already has. */
export function resendWait(state: WaitState): WaitState {
  return { stage: "sending", early: state.early };
}

export type RowState = "past" | "now" | "next" | "skip";

export interface WaitRow {
  key: "send" | "words" | "fillers" | "pace" | "read" | "claims" | "save";
  label: string;
  /** The measured number, once it exists; null before (never a zero). */
  value: string | null;
  state: RowState;
}

/** "4, first at 0:02"; "None". */
export function fillerValue(early: Pick<EarlyRead, "fillerCount" | "fillers">): string {
  const n = early.fillerCount;
  if (n === 0) return "None";
  const first = [...early.fillers].sort((a, b) => a.t - b.t)[0];
  return first ? `${n}, first at ${clock(first.t)}` : String(n);
}

/**
 * The rows, each a stage of the route and what it measured. The fillers
 * and the pace are counted off the word timestamps in the instant the
 * words land, so they are never "now" on their own: they go from next to
 * done with the transcript. The boss's claims are checked beside Demos's
 * read and finish with it.
 */
export function waitRows(state: WaitState, { boss = false }: { boss?: boolean } = {}): WaitRow[] {
  const at = rank(state.stage);
  const step = (reached: WaitStage, done: WaitStage): RowState =>
    at >= rank(done) ? "past" : at >= rank(reached) ? "now" : "next";
  const e = state.early;
  const sendState = step("sending", "received");
  // Once the whole recording is on the server, transcribing is what it does next.
  const wordsState = step("received", "reading");
  const measured: RowState = e ? "past" : "next";
  const readState: RowState = e && !e.reads ? "skip" : step("reading", "saving");
  /* A read that is not coming says why in words: the dash beside it is
     a shape, and a shape is never the whole message (DESIGN principle
     10). Too little speech to judge, or no read left: the Log's "Demos's
     full read is back tomorrow" (components/RepResult.tsx). */
  const skipped = readState === "skip";
  const readLabel = !skipped
    ? "Demos reads it"
    : e?.scorable
      ? "Demos's read is back tomorrow"
      : "Not enough for Demos to read";
  const rows: WaitRow[] = [
    { key: "send", label: sendState === "past" ? "Sent" : "Sending", value: null, state: sendState },
    {
      key: "words",
      label: e ? "Transcribed" : "Transcribing",
      value: e ? `${e.wordCount} word${e.wordCount === 1 ? "" : "s"}` : null,
      state: e ? "past" : wordsState,
    },
    { key: "fillers", label: "Fillers", value: e ? fillerValue(e) : null, state: measured },
    { key: "pace", label: "Pace", value: e ? `${Math.round(e.wpm)} words a minute` : null, state: measured },
    { key: "read", label: readLabel, value: null, state: readState },
  ];
  if (boss) {
    rows.push({
      key: "claims",
      label: skipped ? "Claims not checked" : "Checking your claims",
      value: null,
      state: readState,
    });
  }
  rows.push({ key: "save", label: "Saving", value: null, state: at >= rank("saving") ? "now" : "next" });
  return rows;
}
