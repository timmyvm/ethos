/**
 * The first-session pathway (DECISIONS #133–#134).
 *
 * Two questions live here, both answered from localStorage because both
 * describe this browser, not the account:
 *
 *  - Is this a first visit? A fresh browser gets routed to /welcome; a
 *    returning one never does. "Fresh" is decided by two keys: our own
 *    welcomed flag, and any Supabase session in storage — an existing
 *    device that predates the flag must not be bounced into an intro it
 *    has outgrown.
 *
 *  - Has the save-progress soft wall fired? It shows exactly twice per
 *    browser — after rep 1, and once more when the streak reaches 3 —
 *    and the flags are what make that "exactly" true across remounts.
 */

export const WELCOMED_KEY = "ethos.welcomed";

/**
 * The three introduction screens, docs/voice.md Part 3, verbatim
 * (DECISIONS #209).
 *
 * The warmth is on screen 1, the positioning on screen 2, the promise
 * on screen 3, and not one of them explains anything. Screen 1 opens on
 * an acknowledgement rather than a claim about the reader: "I know why
 * you're here" says something about us, where "you already know the
 * gap" told the reader something about themselves, which is a
 * horoscope. The promise stays deliberately small, because a small
 * specific claim outsells a grand one.
 *
 * Here rather than in the page so the budget test can read it.
 */
export const WELCOME_STEPS = [
  {
    art: "/demos-onboard-listening.webp",
    title: "Hey. I know why you're here.",
    line: "You can already talk. You just want to be better at it.",
  },
  {
    art: "/demos-onboard-speaking.webp",
    title: "A coach costs $5,000.",
    line: "This is sixty seconds a day.",
  },
  {
    art: "/demos-onboard-celebrate.webp",
    title: "That's the whole ask.",
    line: "You won't notice it working. Other people will.",
  },
] as const;

/**
 * The seven questions after the introduction (DECISIONS #232, #249),
 * one per screen, Skip on every one. Same template, same budget
 * (lib/copy.test.ts reads these). The answers and what they do live in
 * lib/answers.ts and content/portfolio.ts.
 *
 * The NAME goes first, and it is the walk's only typed answer. First
 * rather than last because a name given at the start is spent on six
 * screens and one given at the end is spent on one, and because this
 * is the only place in the whole app where the mascot is introduced by
 * name: the ask is reciprocal rather than a form field. Skip keeps
 * every no-name line working.
 *
 * The TIME goes last, after the answers and before the plan, and it
 * asks for no permission (content/portfolio.ts, TIMES).
 */
export const QUESTIONS = [
  {
    id: "name",
    title: "What do I call you?",
    line: "I'm Demos, by the way.",
    essential: false,
  },
  {
    id: "ageBand",
    title: "How old are you?",
    line: "It changes the prompts you get, nothing else.",
    essential: true,
  },
  {
    id: "goal",
    title: "What do you want this for?",
    line: "Pick the closest.",
    essential: true,
  },
  {
    id: "pains",
    title: "What do you notice when you talk?",
    line: "Up to three.",
    essential: true,
  },
  {
    id: "level",
    title: "How much have you practised?",
    line: "Roughly.",
    essential: true,
  },
  {
    id: "context",
    title: "Where does it matter most?",
    line: "Optional.",
    essential: false,
  },
  {
    id: "time",
    title: "When do you want your minute?",
    line: "Pick when you'd actually do it.",
    essential: false,
  },
] as const;

/** The name field's own furniture: it is the one answer you type. */
export const NAME_FIELD = {
  placeholder: "First name",
  label: "Your name",
} as const;

export type QuestionId = (typeof QUESTIONS)[number]["id"];

export const PLAN_COPY = {
  label: "Your first month",
  action: "Take the floor",
  done: "Done",
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
 * jump in retention", decaying until ~7 — day 3 is where the stake is
 * big enough to name and the habit is still the thing being decided.
 */
export const GATE_STREAK = 3;

/** Pure core of the first-run check, decided over a key snapshot. */
export function isFirstRun(keys: string[]): boolean {
  if (keys.includes(WELCOMED_KEY)) return false;
  return !keys.some((k) => SB_SESSION.test(k));
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

export function markWelcomed(): void {
  try {
    localStorage.setItem(WELCOMED_KEY, new Date().toISOString());
  } catch {}
}

/**
 * Which showing of the save-progress wall this moment has earned, if
 * any. Pure — the callers own reading the session and the flags.
 *
 * `repCountBefore` is the count captured on mount, BEFORE this rep —
 * null means the fetch never landed, and an unknown count never gets
 * the rep-1 wall (a wall shown twice to the wrong person is worse than
 * one shown late). The streak showing keys off the real post-rep
 * streak, so it self-corrects: someone who declined at rep 1 and kept
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
