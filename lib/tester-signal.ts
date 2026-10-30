/**
 * Where the recording screen and the error boundary tell tester
 * collection what happened (lib/tester-collect.ts). Tiny on purpose:
 * every page imports it, and until a tester on consent version 3 is
 * known on this device (components/tester/TesterLayer.tsx) nothing is
 * listening, so each call is a no-op and nothing is kept anywhere.
 */

export type RecordSignal = "record_start" | "record_stop";

export interface TesterSink {
  record(name: RecordSignal, data?: Record<string, unknown>): void;
  boundary(error: unknown, digest?: string): void;
}

let sink: TesterSink | null = null;

/** The collector, once it runs; null again when it stops. */
export function setTesterSink(next: TesterSink | null): void {
  sink = next;
}

/** A recording started or stopped (app/rep/page.tsx). */
export function testerRecord(name: RecordSignal, data?: Record<string, unknown>): void {
  sink?.record(name, data);
}

/** An error boundary caught something (app/error.tsx). */
export function testerBoundary(error: unknown, digest?: string): void {
  sink?.boundary(error, digest);
}

/** Whether anything is listening: false for everyone but a tester on version 3. */
export function testerListening(): boolean {
  return sink !== null;
}
