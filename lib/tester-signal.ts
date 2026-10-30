/**
 * Where the recording screen and the error boundary tell tester
 * collection what happened (lib/tester-collect.ts). Tiny on purpose:
 * every page imports it, and until a tester on consent version 3 is
 * known on this device (components/tester/TesterLayer.tsx) nothing is
 * listening, so each call is a no-op and nothing is kept anywhere.
 *
 * One exception, for what breaks first (review F1): the collector starts
 * only after the account's row is read and its file is loaded, so a
 * crash on the first screen of an open came before it and was never
 * reported. On a device that last saw a tester (the hint
 * lib/tester-client.ts keeps), the few errors before the collector
 * listens are held here, in memory and never in storage, five at most,
 * each with the screen and time it happened on. The collector takes them
 * once it starts; the layer lets them go when the row says this phone
 * does not collect. Anywhere else nothing is held at all.
 */

export type RecordSignal = "record_start" | "record_stop";

/** The localStorage key that says this device last saw its account as a tester. */
export const TESTER_HINT_KEY = "ethos.tester";

export interface TesterSink {
  record(name: RecordSignal, data?: Record<string, unknown>): void;
  /** `screen` is the path as the boundary caught it: the crash's own screen. */
  boundary(error: unknown, digest?: string, screen?: string): void;
}

/** An error from before the collector listened. */
export interface EarlyError {
  name: "window" | "rejection" | "boundary";
  error: unknown;
  digest?: string;
  /** A window error's file, line and column, as the browser gave them. */
  file?: string;
  line?: number;
  col?: number;
  message?: string;
  screen: string;
  at: number;
}

/** Errors held before the collector listens. */
const HELD = 5;

let sink: TesterSink | null = null;
let early: EarlyError[] = [];

function hinted(): boolean {
  try {
    return localStorage.getItem(TESTER_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function here(): string {
  try {
    return window.location.pathname;
  } catch {
    return "/";
  }
}

function hold(e: Omit<EarlyError, "screen" | "at">): void {
  if (!hinted()) return;
  early = [...early, { ...e, screen: here(), at: Date.now() }].slice(-HELD);
}

/** The collector, once it runs; null again when it stops. */
export function setTesterSink(next: TesterSink | null): void {
  sink = next;
}

/** A recording started or stopped (app/rep/page.tsx). */
export function testerRecord(name: RecordSignal, data?: Record<string, unknown>): void {
  sink?.record(name, data);
}

/**
 * An error boundary caught something (app/error.tsx). Its screen is the
 * URL as it is now: on a navigation the boundary runs before the layer
 * hears the new path, and the crash belongs to the screen it broke.
 */
export function testerBoundary(error: unknown, digest?: string): void {
  if (sink) sink.boundary(error, digest, here());
  else hold({ name: "boundary", error, digest });
}

/** A window error or an unhandled rejection before the collector listens (TesterLayer). */
export function testerEarly(
  name: "window" | "rejection",
  error: unknown,
  where?: { file?: string; line?: number; col?: number; message?: string }
): void {
  if (sink) return;
  hold({ name, error, ...where });
}

/** What happened before the collector listened, handed over once. */
export function takeEarly(): EarlyError[] {
  const out = early;
  early = [];
  return out;
}

/** This phone does not collect after all: what was held goes. */
export function dropEarly(): void {
  early = [];
}

/** Whether anything is listening: false for everyone but a tester on version 3. */
export function testerListening(): boolean {
  return sink !== null;
}
