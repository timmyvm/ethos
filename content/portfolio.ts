/**
 * The personalisation table (DECISIONS #232).
 *
 * Every answer in the introduction maps to something here, and this is
 * the ONLY place that mapping lives: edit a line and the plan, the
 * floor's day-one note and the prompt pool change; no component reads
 * anything else. The ids are closed sets, and migration 0009 checks the
 * same sets on the server.
 *
 * Copy rules apply to every string (COPY-RULES.md): fifteen words, no
 * em dash, one negation. `lib/portfolio.test.ts` holds the file to that
 * and to the road: every `unit` must exist in `lib/path.ts`.
 *
 * What an answer may do: name the first number, name the unit and its
 * gate, pick the boss, set two defaults (the frame step, the unit
 * intros) and narrow the prompt pool. What it never does: score,
 * reorder the road, or award a star (#10, #46).
 */

/** Which prompts fit. `school` drops the job prompts; the rest keep all. */
export type Pool = "all" | "school" | "work" | "social" | "online";

export const AGE_BANDS = [
  { id: "u18", label: "Under 18", pool: "school" },
  { id: "18_24", label: "18 to 24", pool: "all" },
  { id: "25_34", label: "25 to 34", pool: "all" },
  { id: "35_plus", label: "35 and up", pool: "all" },
] as const satisfies readonly { id: string; label: string; pool: Pool }[];

export const BOSSES = {
  "cold-topic": { name: "Cold Topic", href: "/boss" },
  hostile: { name: "Hostile Q&A", href: "/hostile" },
} as const;

export const GOALS = [
  { id: "sharper", label: "Sharper at work or class", headline: "Sharper in the room.", boss: "cold-topic" },
  { id: "present", label: "Hold a room when I present", headline: "Hold the room.", boss: "cold-topic" },
  { id: "feet", label: "Think on my feet when asked", headline: "Think on your feet.", boss: "hostile" },
  { id: "anyone", label: "Talk to anyone without rehearsing", headline: "Talk to anyone.", boss: "hostile" },
] as const satisfies readonly { id: string; label: string; headline: string; boss: keyof typeof BOSSES }[];

/**
 * What you notice. `unit` is the road's unit that trains it, `metric`
 * the measured dimension the first number comes from, `line` how the
 * plan names that number, `said` how the app repeats the answer back.
 */
export const PAINS = [
  { id: "fillers", label: "Um, like, you know", said: "fillers", unit: "filler", metric: "fillers", line: "fillers per minute, counted with timestamps." },
  { id: "rushing", label: "I rush", said: "rushing", unit: "pace", metric: "wpm", line: "words per minute against the 130 to 160 zone." },
  { id: "trailing", label: "I trail off", said: "trailing off", unit: "structure", metric: "structure", line: "whether the ending lands, cited from your words." },
  { id: "freezing", label: "I freeze on the spot", said: "freezing", unit: "fire", metric: "pause", line: "silences that land a point, and silences that search." },
  { id: "flat", label: "I sound flat", said: "sounding flat", unit: "pace", metric: "range", line: "pace that moves, and words you repeat." },
  { id: "rambling", label: "I ramble", said: "rambling", unit: "compression", metric: "structure", line: "one claim, one example, an ending." },
] as const satisfies readonly { id: string; label: string; said: string; unit: string; metric: string; line: string }[];

export const LEVELS = [
  { id: "never", label: "Never practised", frameStep: true, intros: true },
  { id: "some", label: "A bit, a class or a few talks", frameStep: false, intros: true },
  { id: "often", label: "Often, I present most weeks", frameStep: false, intros: false },
] as const satisfies readonly { id: string; label: string; frameStep: boolean; intros: boolean }[];

export const CONTEXTS = [
  { id: "class", label: "Class", pool: "school" },
  { id: "work", label: "Work", pool: "work" },
  { id: "social", label: "Dates and friends", pool: "social" },
  { id: "online", label: "Online", pool: "online" },
] as const satisfies readonly { id: string; label: string; pool: Pool }[];

/** The plan's own lines. The third comes from the unit the pain maps to. */
export const PLAN_LINES = {
  dayOne: "Day 1: The baseline. Sixty seconds, measured.",
  firstNumber: (line: string) => `First number: ${line}`,
  firstNumberDefault: "First number: your Ethos Index, out of 1000.",
  firstUnit: (unit: string, said: string) => `${unit} first. Every lesson in it targets ${said}.`,
  laterUnit: (unit: string, said: string, stars: number) => `Then ${unit}, the unit for ${said}. Opens at ${stars} stars.`,
  road: "Then the road, one unit at a time.",
  headlineDefault: "Your first month.",
  line: "Built from what you told me.",
  boss: (name: string) => `Your boss, when you're ready: ${name}.`,
  dayOneNote: (said: string) => `You said: ${said}. The baseline sets the number to beat.`,
} as const;

/** Bump when the mapping changes shape, so stored portfolios can be rebuilt. */
export const PORTFOLIO_RULES_VERSION = 1;
