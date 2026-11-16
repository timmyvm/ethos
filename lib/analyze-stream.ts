/**
 * The engine's answer in parts (#472).
 *
 * From Stop to the scored recording took a median 76 seconds in the
 * tester cohort, and the people who left did so in the first 30. Most of
 * that is Whisper and then Demos's read, one after the other, and the
 * phone saw nothing until both were done. The transcript and every
 * number counted off its word timestamps exist the moment Whisper
 * answers, a long while before the read does.
 *
 * So the recorder asks for its answer as lines (`Accept: STREAM_TYPE`),
 * one request, one function, the same save: each stage the route
 * reaches is a line, the early read is a line as soon as the words are
 * in, and the last line is the answer the route would have sent whole,
 * its status and its body, unchanged. Everything else that calls
 * /api/analyze (Upload, Hostile, the outbox's background send, every
 * check script's stand-in) asks for nothing and gets one JSON body, as
 * before, and `readAnalyze` reads either.
 *
 * Nothing here scores. The early read is what the route had already
 * measured, cut down to what the wait shows; the Index and the judged
 * dimensions are only ever in the last line.
 */
import type { FillerHit, RepMetrics, Word } from "./metrics";

/** What the recorder asks for, and the route answers with, to read the answer in parts. */
export const STREAM_TYPE = "application/x-ndjson";

/** True when a request's Accept header asks for the answer in parts. */
export function wantsStream(accept: string | null | undefined): boolean {
  return typeof accept === "string" && accept.toLowerCase().includes(STREAM_TYPE);
}

/**
 * What the wait can show before Demos's read: the person's own words and
 * the numbers counted off their timestamps. Nothing in it waits on the
 * coach, and nothing in it changes when the coach answers.
 */
export interface EarlyRead {
  /** The take's length as Whisper heard it, in seconds. */
  durationS: number;
  transcript: string;
  words: Word[];
  wordCount: number;
  wpm: number;
  fillerCount: number;
  /** Every filler and when it was said, in order. */
  fillers: FillerHit[];
  /** Enough real speech to score. */
  scorable: boolean;
  /** Demos reads this take: the coach is called (a scorable take with a read left). */
  reads: boolean;
}

/** A stage the route reached, in the order it reaches them. */
export type AnalyzeEvent =
  /** The whole recording is on the server. */
  | { stage: "received" }
  /** Past the checks, sent to Whisper. */
  | { stage: "transcribing" }
  /** The words are in and measured; Demos reads next, when `early.reads`. */
  | { stage: "measured"; early: EarlyRead }
  /** Read (or not read), being stored. */
  | { stage: "saving" };

/** The last line: the answer, exactly as the route sends it whole. */
export interface AnalyzeDone {
  stage: "done";
  status: number;
  body: unknown;
}

export type AnalyzeLine = AnalyzeEvent | AnalyzeDone;

/** The early read, cut from what the route measured. */
export function earlyRead(input: {
  transcript: string;
  words: Word[];
  metrics: Pick<RepMetrics, "durationS" | "wordCount" | "wpm" | "fillerCount" | "fillers">;
  scorable: boolean;
  reads: boolean;
}): EarlyRead {
  const { metrics: m } = input;
  return {
    durationS: m.durationS,
    transcript: input.transcript,
    words: input.words.map((w) => ({ word: w.word, start: w.start, end: w.end })),
    wordCount: m.wordCount,
    wpm: m.wpm,
    fillerCount: m.fillerCount,
    fillers: m.fillers.map((f) => ({ word: f.word, t: f.t })),
    scorable: input.scorable,
    reads: input.scorable && input.reads,
  };
}

/** One line on the wire. */
export function encodeLine(line: AnalyzeLine): string {
  return `${JSON.stringify(line)}\n`;
}

const STAGES = new Set(["received", "transcribing", "measured", "saving", "done"]);

/** A line read back, or null for anything that is not one of ours. */
export function parseLine(text: string): AnalyzeLine | null {
  const t = text.trim();
  if (!t) return null;
  let v: unknown;
  try {
    v = JSON.parse(t);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.stage !== "string" || !STAGES.has(o.stage)) return null;
  if (o.stage === "done") {
    return typeof o.status === "number" ? { stage: "done", status: o.status, body: o.body ?? null } : null;
  }
  if (o.stage === "measured") {
    return isEarly(o.early) ? { stage: "measured", early: o.early } : null;
  }
  return { stage: o.stage } as AnalyzeEvent;
}

function isEarly(v: unknown): v is EarlyRead {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.transcript === "string" &&
    Array.isArray(e.words) &&
    Array.isArray(e.fillers) &&
    typeof e.durationS === "number" &&
    typeof e.wpm === "number" &&
    typeof e.fillerCount === "number" &&
    typeof e.scorable === "boolean" &&
    typeof e.reads === "boolean"
  );
}

/** What one send came to: the answer's status and its body, however it travelled. */
export interface ReadOutcome {
  status: number;
  data: unknown;
}

/** Thrown when a stream of lines stops before its last one: a dropped connection, read as one. */
export class StreamCut extends Error {
  constructor() {
    super("The answer stopped part way.");
    this.name = "StreamCut";
  }
}

/**
 * Reads /api/analyze's answer, whichever way it came. A stream of lines
 * hands each stage to `onEvent` as it lands and resolves with the last
 * line's status and body; one JSON body (any caller that did not ask, a
 * server from before #472, every check script's stand-in) resolves with
 * the response's own status and its parsed body, or null for a body that
 * is not JSON (a gateway's HTML). A stream that ends without its last
 * line throws `StreamCut`, which the retry ladder treats as a network
 * failure. `onEvent` throwing never stops the read.
 */
export async function readAnalyze(
  res: Response,
  onEvent?: (event: AnalyzeEvent) => void
): Promise<ReadOutcome> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes(STREAM_TYPE) || !res.body) {
    return { status: res.status, data: await res.json().catch(() => null) };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let held = "";
  const take = (text: string): ReadOutcome | null => {
    const line = parseLine(text);
    if (!line) return null;
    if (line.stage === "done") return { status: line.status, data: line.body };
    try {
      onEvent?.(line);
    } catch {
      // The wait failing to draw a stage never costs the answer.
    }
    return null;
  };
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch {
      throw new StreamCut();
    }
    if (chunk.done) {
      const last = take(held + decoder.decode());
      if (last) return last;
      throw new StreamCut();
    }
    held += decoder.decode(chunk.value, { stream: true });
    let at: number;
    while ((at = held.indexOf("\n")) >= 0) {
      const text = held.slice(0, at);
      held = held.slice(at + 1);
      // The answer is in; what follows is the server closing up.
      const outcome = take(text);
      if (outcome) return outcome;
    }
  }
}
