/**
 * A line arriving the way an AI chat streams it (#475, Timothy, 16 Nov:
 * "make it like streamline like AI text, and then every stream is like
 * pop, like that stream text sound"): a word at a time, now and then
 * two, every 120 to 180 ms with a little give, a longer beat at a comma
 * and a longer one at a full stop, and a pop on every chunk
 * (lib/room-sound.ts). Slow enough that each pop is heard as its own
 * (faster, they ran together into a buzz and a short line landed whole),
 * fast enough that it reads as streaming, not as typing.
 *
 * Pure: the plan is worked out from the text and a random source, and
 * played against a clock that is passed in, so a test can hold the
 * clock and watch each chunk land at its millisecond.
 *
 * Once a line has finished arriving it is held long enough to read
 * (about 0.3 s a word, never under 1.4 s) before the scene moves on.
 */

export type Rng = () => number;

export const STREAM = {
  /** Between two chunks, before any beat: 120 to 180 ms. */
  minGapMs: 120,
  maxGapMs: 180,
  /** Added after a chunk that ends on a comma, a colon or a semicolon. */
  commaBeatMs: 200,
  /** Added after a chunk that ends a sentence, when more follows. */
  stopBeatMs: 340,
  /** Two short words travel together, up to this many letters between them. */
  pairLetters: 9,
  /** How often two short words go as one chunk. */
  pairChance: 0.35,
  /** Reading time once the line is whole. */
  holdPerWordMs: 300,
  holdMinMs: 1400,
} as const;

export type StreamChunk = {
  /** What lands, with the space before it (none on the first). */
  text: string;
  /** Milliseconds after the line starts. */
  at: number;
};

export type StreamPlan = {
  text: string;
  chunks: StreamChunk[];
  /** When the last chunk lands. */
  doneAt: number;
  /** How long it stays whole before the scene moves on. */
  holdMs: number;
};

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);
const BEAT_COMMA = /[,;:]$/;
const BEAT_STOP = /[.!?]["')\]]?$/;

/** A line cut into chunks of one or two words. Never two across a beat. */
export function chunkWords(text: string, rng: Rng = Math.random): string[] {
  const w = words(text);
  const out: string[] = [];
  for (let i = 0; i < w.length; i++) {
    const next = w[i + 1];
    const pairs =
      next !== undefined &&
      !BEAT_COMMA.test(w[i]) &&
      !BEAT_STOP.test(w[i]) &&
      w[i].length + next.length <= STREAM.pairLetters &&
      rng() < STREAM.pairChance;
    if (pairs) {
      out.push(`${w[i]} ${next}`);
      i += 1;
    } else {
      out.push(w[i]);
    }
  }
  return out;
}

/** How long a whole line is held to be read. */
export function holdFor(text: string): number {
  return Math.max(STREAM.holdMinMs, STREAM.holdPerWordMs * words(text).length);
}

/** The pause a chunk leaves after itself, beyond the ordinary gap. */
export function beatAfter(chunk: string): number {
  if (BEAT_STOP.test(chunk)) return STREAM.stopBeatMs;
  if (BEAT_COMMA.test(chunk)) return STREAM.commaBeatMs;
  return 0;
}

/**
 * When each chunk of a line lands. Under reduced motion the line is one
 * chunk at `lead`: it appears whole, with one pop.
 */
export function planStream(
  text: string,
  { rng = Math.random, reduced = false, lead = 0 }: { rng?: Rng; reduced?: boolean; lead?: number } = {}
): StreamPlan {
  const holdMs = holdFor(text);
  if (reduced) {
    const whole = text.trim();
    return { text: whole, chunks: whole ? [{ text: whole, at: lead }] : [], doneAt: lead, holdMs };
  }
  const parts = chunkWords(text, rng);
  let at = lead;
  const chunks = parts.map((p, i) => {
    if (i > 0) {
      const gap = STREAM.minGapMs + rng() * (STREAM.maxGapMs - STREAM.minGapMs);
      at += Math.round(gap) + beatAfter(parts[i - 1]);
    }
    return { text: i === 0 ? p : ` ${p}`, at };
  });
  return { text: text.trim(), chunks, doneAt: at, holdMs };
}

/** How many chunks have landed `elapsed` ms into the line. */
export function shownAt(plan: StreamPlan, elapsed: number): number {
  let n = 0;
  for (const c of plan.chunks) if (c.at <= elapsed) n += 1;
  return n;
}

/** The text on screen `elapsed` ms into the line. */
export function textAt(plan: StreamPlan, elapsed: number): string {
  return plan.chunks
    .slice(0, shownAt(plan, elapsed))
    .map((c) => c.text)
    .join("");
}

/** A clock and its timers: the browser's in the app, a held one in a test. */
export type Clock = {
  now: () => number;
  set: (fn: () => void, ms: number) => unknown;
  clear: (id: unknown) => void;
};

export const realClock: Clock = {
  now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/**
 * Plays a plan: `onChunk` for each chunk as it lands (its index and the
 * text so far), then `onDone` once the last has landed. Each timer is
 * set against the line's own start, so a late frame never pushes the
 * rest of the line later. Returns a stop.
 */
export function playStream(
  plan: StreamPlan,
  onChunk: (index: number, text: string) => void,
  onDone: () => void,
  clock: Clock = realClock
): () => void {
  const start = clock.now();
  let i = 0;
  let timer: unknown = null;
  let stopped = false;
  const step = () => {
    timer = null;
    if (stopped) return;
    const elapsed = clock.now() - start;
    while (i < plan.chunks.length && plan.chunks[i].at <= elapsed) {
      i += 1;
      onChunk(i - 1, plan.chunks.slice(0, i).map((c) => c.text).join(""));
      if (stopped) return;
    }
    if (i >= plan.chunks.length) {
      onDone();
      return;
    }
    timer = clock.set(step, Math.max(0, plan.chunks[i].at - elapsed));
  };
  if (plan.chunks.length === 0) {
    timer = clock.set(() => {
      timer = null;
      if (!stopped) onDone();
    }, 0);
  } else {
    timer = clock.set(step, Math.max(0, plan.chunks[0].at));
  }
  return () => {
    stopped = true;
    if (timer !== null) clock.clear(timer);
  };
}
