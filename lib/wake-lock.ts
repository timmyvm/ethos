/**
 * The screen stays awake while a take is being spoken (#440).
 *
 * A take runs 60 to 90 seconds with the phone left alone, and an iPhone
 * locks its screen after 30 by default. A locked phone hides the page,
 * a hidden page loses the microphone, and the take ended there with its
 * end missing (#412 scores what was heard; this stops it happening).
 * Apple's guidance is that a recording is a task the app protects from
 * interruption, and a native recorder holds the screen awake for it.
 *
 * `holdAwake()` asks for a screen wake lock and hands back the call that
 * lets it go. The browser drops a lock whenever the page is hidden, so
 * it is asked for again each time the page is shown while still held.
 * Where the browser has no wake lock, or refuses one (Low Power Mode on
 * some phones), nothing happens and the take goes on as it always did.
 */

type Sentinel = { release: () => Promise<void> };
type Locker = { request: (type: "screen") => Promise<Sentinel> };

export interface AwakeEnv {
  /** `navigator.wakeLock`, when the browser has one. */
  locker: Locker | null | undefined;
  visible: () => boolean;
  onVisibility: (fn: () => void) => () => void;
}

function browserEnv(): AwakeEnv | null {
  if (typeof document === "undefined" || typeof navigator === "undefined") return null;
  return {
    locker: (navigator as Navigator & { wakeLock?: Locker }).wakeLock,
    visible: () => document.visibilityState === "visible",
    onVisibility: (fn) => {
      document.addEventListener("visibilitychange", fn);
      return () => document.removeEventListener("visibilitychange", fn);
    },
  };
}

/** Keep the screen on until the returned call is made. Safe to call anywhere; safe to release twice. */
export function holdAwake(env: AwakeEnv | null = browserEnv()): () => void {
  if (!env?.locker) return () => {};
  const { locker } = env;
  let held = true;
  let sentinel: Sentinel | null = null;
  let asking = false;

  const ask = async () => {
    if (!held || asking || sentinel || !env.visible()) return;
    asking = true;
    try {
      const lock = await locker.request("screen");
      // Let go while the answer was on its way: this lock is nobody's.
      if (!held) void lock.release().catch(() => {});
      else sentinel = lock;
    } catch {
      /* Refused: the take goes on without it. */
    } finally {
      asking = false;
    }
  };

  const off = env.onVisibility(() => {
    // Hidden: the browser has already taken the lock back. Shown: ask again.
    if (!env.visible()) sentinel = null;
    else void ask();
  });
  void ask();

  return () => {
    if (!held) return;
    held = false;
    off();
    const lock = sentinel;
    sentinel = null;
    void lock?.release().catch(() => {});
  };
}
