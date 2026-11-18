/**
 * The first-session pathway (DECISIONS #133–#134).
 *
 * Two questions live here, both answered from localStorage because both
 * describe this browser, not the account:
 *
 *  - Is this a first visit? A fresh browser gets routed to /welcome; a
 *    returning one never does. "Fresh" is decided by two keys: our own
 *    welcomed flag, and any Supabase session in storage: an existing
 *    device that predates the flag must not be bounced into an intro it
 *    has outgrown.
 *
 *  - Has the save-progress soft wall fired? It shows exactly twice per
 *    browser: after the first recording, and once more when the streak reaches 3,
 *    and the flags are what make that "exactly" true across remounts.
 */

export const WELCOMED_KEY = "ethos.welcomed";

/*
 * The three introduction screens (docs/voice.md Part 3, #209: "Hey. I
 * know why you're here.", "Sixty seconds a day.", "That's the whole
 * ask.") went with #475. They were the pitch, said; the room
 * (lib/room-script.ts, components/room/Room.tsx) is the pitch, felt, in
 * their place. The walk now opens on the room for a first run and on
 * the name for everyone else.
 */

export type QuestionId =
  | "name"
  | "ageBand"
  | "goal"
  | "pains"
  | "level"
  | "context"
  | "time";

/**
 * The questions after the room (DECISIONS #232, #249, #288, #501), one
 * per screen, said by Demos from his bubble. Same template, same budget
 * (lib/copy.test.ts reads these). The answers and what they do live in
 * lib/answers.ts and content/portfolio.ts.
 *
 * Five since #501 (Timothy, 18 Nov, with Jonathan, a tester: "we don't
 * even know what we're doing here. We just want to do it, and we just
 * want to get better at it"). Three screens went because they did not
 * help that person reach their first recording:
 *
 *  - the goal ("What do you want this for?"): Jonathan's own words are
 *    its answer. It named the plan's headline and its boss; it stays in
 *    Settings, Profile, Goal, for anyone who wants one.
 *  - the place ("Where does it matter most?"): once the age is known it
 *    only ever moved the topic pool for an adult who said Class, three
 *    prompts of 365 (lib/pool.ts).
 *  - the beat before the hour: no question, one more Next. Its line is
 *    now the hour's own second line, where the time is chosen.
 *
 * `QuestionId` keeps all seven: the answers still hold the goal and the
 * place, Settings still sets the goal, and a deep link to a question that
 * went (`?step=goal`) opens where the walk stands instead.
 *
 * The second line is the guide (#501): Demos saying, in plain words,
 * what happens next or what to tap, where the rows do not already say
 * it. The name says the shape of the whole walk; what you notice says
 * that not knowing is an answer too (Skip), so nobody is asked to
 * diagnose themselves; the hour says what the minute is. The age and how
 * much you have practised need nothing: the rows are the answer.
 *
 * Next waits for an answer on every one and Skip is the way past
 * (#288). The NAME goes first, the only typed answer, spent on every
 * screen after it; the TIME goes last and asks for no permission
 * (content/portfolio.ts, TIMES).
 */
export const QUESTIONS: readonly {
  id: QuestionId;
  title: string;
  line?: string;
}[] = [
  { id: "name", title: "What do I call you?", line: "I'm Demos. A few questions, then you speak for 60 seconds." },
  { id: "ageBand", title: "How old are you?" },
  { id: "pains", title: "What do you notice when you talk?", line: "Pick up to three, or Skip if you're not sure." },
  { id: "level", title: "How much have you practised?" },
  { id: "time", title: "When do you want your minute?", line: "It takes 60 seconds a day. Pick an hour you'd keep." },
];

/** The name field's own furniture: it is the one answer you type. */
export const NAME_FIELD = {
  placeholder: "First name",
  label: "Your name",
} as const;

/**
 * The plan's own words. `action` is the tap that goes to the floor, so
 * it says Start (#317); `toAccount` is the same button when it opens the
 * account ask instead, which is a step in the walk and not a start
 * (intro-b-10), so it says what every other step's button says.
 */
export const PLAN_COPY = {
  label: "Your first month",
  action: "Start",
  toAccount: "Next",
  done: "Done",
  /**
   * The plan's guide (#501): what Next does and what comes after it.
   * Said under his line to them while the walk is being walked; editing
   * from You has nowhere next to name.
   */
  next: "Save it next, then you speak for 60 seconds.",
  /** The same guide where there is nothing to save: an account is in. */
  start: "Tap Start, then speak for 60 seconds.",
} as const;

/** Supabase-js persists its session under `sb-<project-ref>-auth-token`. */
const SB_SESSION = /^sb-.+-auth-token$/;

export type GateMoment = "rep1" | "streak";

const GATE_KEYS: Record<GateMoment, string> = {
  rep1: "ethos.gate.rep1",
  streak: "ethos.gate.streak",
};

/**
 * The streak at which the wall fires its second (and last) time.
 * Duolingo's retention team: "going from a 1 to 2-day streak is a huge
 * jump in retention", decaying until ~7; day 3 is where the stake is
 * big enough to name and the habit is still the thing being decided.
 */
export const GATE_STREAK = 3;

/** Pure core of the first-run check, decided over a key snapshot. */
export function isFirstRun(keys: string[]): boolean {
  if (keys.includes(WELCOMED_KEY)) return false;
  return !keys.some((k) => SB_SESSION.test(k));
}

/** Every key this browser holds, or none where storage cannot be read. */
export function storageKeys(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null) keys.push(k);
    }
    return keys;
  } catch {
    return [];
  }
}

export function firstRun(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null) keys.push(k);
    }
    return isFirstRun(keys);
  } catch {
    return false;
  }
}

/**
 * Whether the walk opens on the room (#475, #497): for anyone whose
 * introduction is not finished, and nobody else. Not a deep link into
 * the walk (`?step=`, You's plan row), not a walk already finished or
 * already past the room (a refresh on the name lands on the name).
 *
 * A session no longer rules it out (#497, Timothy: "if u sign into an
 * account that somehow hasnt done the onboarding make them onboard"):
 * `done` is this device's walk, which every sign-in has already merged
 * with the account's onboarding row before it lands here
 * (lib/auth-landing.ts `landAfterAuth`, lib/answers-sync.ts
 * `introFinished`), so an account that finished elsewhere arrives done.
 */
export function roomDue(a: {
  /** The `?step=` the walk was opened with, or null. */
  asked: string | null;
  /** The introduction finished, for this device and the account it holds. */
  done: boolean;
  /** The stored step; the room is step 0. */
  step: number;
}): boolean {
  if (a.asked !== null) return false;
  if (a.done) return false;
  return a.step === 0;
}

/**
 * Whether this browser holds an account's session, not a guest's and not
 * none (#497): the room's door offers Sign in and Tester code only to
 * someone without one. Read from the stored session itself, before
 * paint, so the door never draws a link and then takes it away.
 */
export function accountIn(entries: readonly (readonly [string, string | null])[]): boolean {
  return entries.some(([k, v]) => {
    if (!SB_SESSION.test(k) || !v) return false;
    try {
      const s = JSON.parse(v) as { access_token?: unknown; user?: { is_anonymous?: unknown } | null };
      return typeof s.access_token === "string" && !!s.user && s.user.is_anonymous !== true;
    } catch {
      return false;
    }
  });
}

export function storedAccount(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return accountIn(storageKeys().map((k) => [k, localStorage.getItem(k)] as const));
  } catch {
    return false;
  }
}

export function markWelcomed(): void {
  try {
    localStorage.setItem(WELCOMED_KEY, new Date().toISOString());
  } catch {}
}

/**
 * Which showing of the save-progress wall this moment has earned, if
 * any. Pure: the callers own reading the session and the flags.
 *
 * `repCountBefore` is the count captured on mount, BEFORE this recording:
 * null means the fetch never landed, and an unknown count never gets
 * the first-recording wall (a wall shown twice to the wrong person is worse than
 * one shown late). The streak showing keys off the real post-recording
 * streak, so it self-corrects: someone who declined after the first recording and kept
 * going gets the second ask when the stake is three days tall.
 */
export function gateMoment(args: {
  anonymous: boolean;
  repCountBefore: number | null;
  streakNow: number;
  shown: Record<GateMoment, boolean>;
}): GateMoment | null {
  if (!args.anonymous) return null;
  if (args.repCountBefore === 0 && !args.shown.rep1) return "rep1";
  if (args.streakNow >= GATE_STREAK && !args.shown.streak) return "streak";
  return null;
}

export function gatesShown(): Record<GateMoment, boolean> {
  if (typeof localStorage === "undefined") return { rep1: true, streak: true };
  try {
    return {
      rep1: localStorage.getItem(GATE_KEYS.rep1) !== null,
      streak: localStorage.getItem(GATE_KEYS.streak) !== null,
    };
  } catch {
    return { rep1: true, streak: true };
  }
}

export function markGateShown(moment: GateMoment): void {
  try {
    localStorage.setItem(GATE_KEYS[moment], new Date().toISOString());
  } catch {}
}
