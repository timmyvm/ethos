/**
 * Reads that are allowed to fail out loud.
 *
 * Checkpoint 1 booted the app against an unreachable backend and watched
 * `/you` shimmer forever: the skeletons were correct (never show a number
 * that isn't true) and the fetches simply never came back, so the honest
 * placeholder became a permanent one. A skeleton is a promise that
 * something is coming; when nothing is, it has to end.
 *
 * So every page-level read goes through `readable()`, which does two
 * things and nothing else: it puts a ceiling on the wait, and it turns a
 * rejection into a value the render can branch on. What the user sees
 * after that is `<ErrorState>`'s job.
 */

/**
 * Eight seconds. Long enough for a slow phone on hotel wifi, short enough
 * that nobody decides the app is broken and closes it — past ~10s the
 * question stops being "is it loading" and becomes "is it dead".
 */
export const READ_TIMEOUT_MS = 8_000;

export class ReadTimeout extends Error {
  constructor() {
    super("read timed out");
    this.name = "ReadTimeout";
  }
}

/** Rejects with `ReadTimeout` if the work hasn't answered in time. */
export function withTimeout<T>(
  work: Promise<T>,
  ms: number = READ_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const bell = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ReadTimeout()), ms);
  });
  return Promise.race([work, bell]).finally(() => clearTimeout(timer));
}

/** What a read settles to: the value, or the fact that it didn't arrive. */
export type Read<T> = { ok: true; data: T } | { ok: false };

/**
 * Run a read and never throw. `ok: false` is the caller's cue to render
 * the failure — which is the whole point, since the alternative was
 * `.catch(() => {})` and a screen that quietly lied about being empty.
 */
export async function readable<T>(
  work: () => Promise<T>,
  ms: number = READ_TIMEOUT_MS
): Promise<Read<T>> {
  try {
    return { ok: true, data: await withTimeout(work(), ms) };
  } catch {
    return { ok: false };
  }
}

/**
 * The one line every failed read says, tuned by whether the device
 * thinks it has a connection at all. Kept here so five screens can't
 * drift into five different apologies.
 */
export function readFailure(subject: string): { title: string; body: string } {
  const offline =
    typeof navigator !== "undefined" && navigator.onLine === false;
  return offline
    ? {
        title: `${subject} needs a connection.`,
        body: "You're offline. Nothing is lost — it loads when you're back.",
      }
    : {
        title: `${subject} didn't load.`,
        body: "The server didn't answer. Your reps are safe where they are.",
      };
}
