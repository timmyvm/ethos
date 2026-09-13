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
 * gate, pick the boss, set three defaults (the frame step, the unit
 * intros, the reminder hour), narrow the prompt pool, and put one line
 * in Demos's mouth. What it never does: score, reorder the road, or
 * award a star (#10, #46).
 *
 * DEMOS REPLIES WHERE AN ANSWER CHANGES SOMETHING, AND NODS WHERE IT
 * DOES NOT (#249). That is why `reply` is on ten options and not on
 * twenty-three: a mascot who says something after every tap is a
 * chatterbox, and one who speaks only when the answer moved a lever is
 * evidence the app was listening. A reply names the number it will
 * measure or the setting it just changed, and never praises the choice.
 */

/** Which prompts fit. `school` drops the job prompts; the rest keep all. */
export type Pool = "all" | "school" | "work" | "social" | "online";

/**
 * Only the first band changes anything, so only the first band gets a
 * line. The other three carry an explicit `undefined` rather than no
 * field at all: silence is a value here, and a table where the property
 * is simply missing reads as an oversight (and types as a union the
 * caller has to widen by hand).
 */
export const AGE_BANDS = [
  { id: "u18", label: "Under 18", pool: "school", reply: "School and life prompts, then. No job interviews." },
  { id: "18_24", label: "18 to 24", pool: "all", reply: undefined },
  { id: "25_34", label: "25 to 34", pool: "all", reply: undefined },
  { id: "35_plus", label: "35 and up", pool: "all", reply: undefined },
] as const satisfies readonly { id: string; label: string; pool: Pool; reply?: string }[];

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
  { id: "fillers", label: "Um, like, you know", said: "fillers", unit: "filler", metric: "fillers", line: "fillers per minute, counted with timestamps.", reply: "Fillers. I count them, with timestamps." },
  { id: "rushing", label: "I rush", said: "rushing", unit: "pace", metric: "wpm", line: "words per minute against the 130 to 160 zone.", reply: "Rushing. You'll see your words per minute." },
  { id: "trailing", label: "I trail off", said: "trailing off", unit: "structure", metric: "structure", line: "whether the ending lands, cited from your words.", reply: "Trailing off. I check whether the ending lands." },
  { id: "freezing", label: "I freeze on the spot", said: "freezing", unit: "fire", metric: "pause", line: "silences that land a point, and silences that search.", reply: "Freezing. I separate the silences that work." },
  { id: "flat", label: "I sound flat", said: "sounding flat", unit: "pace", metric: "range", line: "pace that moves, and words you repeat.", reply: "Flat. I watch whether your pace moves." },
  { id: "rambling", label: "I ramble", said: "rambling", unit: "compression", metric: "structure", line: "one claim, one example, an ending.", reply: "Rambling. One claim, one example, an ending." },
] as const satisfies readonly { id: string; label: string; said: string; unit: string; metric: string; line: string; reply: string }[];

/**
 * Each reply names the setting its answer just moved, and nothing else.
 * `frameStep` is the 30 seconds of think time before a recording (#35);
 * `intros` is whether a unit teaches before it tests (#210). A reply
 * that described a feeling instead would be the one kind of line this
 * table is not allowed to hold.
 */
export const LEVELS = [
  { id: "never", label: "Never practised", frameStep: true, intros: true, reply: "Then you get thirty seconds to think, before each one." },
  { id: "some", label: "A bit, a class or a few talks", frameStep: false, intros: true, reply: "I'll keep the unit intros on." },
  { id: "often", label: "Often, I present most weeks", frameStep: false, intros: false, reply: "Intros off. Straight to the floor." },
] as const satisfies readonly { id: string; label: string; frameStep: boolean; intros: boolean; reply: string }[];

export const CONTEXTS = [
  { id: "class", label: "Class", pool: "school" },
  { id: "work", label: "Work", pool: "work" },
  { id: "social", label: "Dates and friends", pool: "social" },
  { id: "online", label: "Online", pool: "online" },
] as const satisfies readonly { id: string; label: string; pool: Pool }[];

/**
 * When the daily nudge fires (#249). The hours match Settings' own set
 * so the two screens cannot disagree, and the word is there for the
 * scan while the hour is there for the truth.
 *
 * Picking one writes `prefs.reminderHour` and asks for NO permission:
 * `armPush` and `armReminder` no-op until one is granted, so the hour
 * waits, and the browser prompt stays where it already is, after the
 * first recording. A notification prompt inside the first thirty
 * seconds is how an app loses it permanently.
 */
export const TIMES = [
  { id: "morning", label: "Morning, 08:00", hour: 8 },
  { id: "midday", label: "Midday, 12:00", hour: 12 },
  { id: "evening", label: "Evening, 18:00", hour: 18 },
  { id: "night", label: "Night, 21:00", hour: 21 },
  { id: "off", label: "No reminder", hour: null },
] as const satisfies readonly { id: string; label: string; hour: number | null }[];

/**
 * Demos's first line to them, on the plan screen, in place of the
 * template's own "Built from what you told me." Four rows, because the
 * name and the thing they noticed are each optional and a template with
 * a hole in it reads worse than a shorter sentence.
 */
export const OPENING = {
  full: (name: string, said: string) => `${name}. You said ${said}. From day one that's a number.`,
  noName: (said: string) => `You said ${said}. From day one that's a number.`,
  noPain: (name: string) => `${name}. Sixty seconds a day, measured.`,
  none: "Sixty seconds a day, measured.",
} as const;

/** His reply to a name, the one answer that is not a tap. */
export const NAME_REPLY = (name: string) => `Good to meet you, ${name}.`;

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
export const PORTFOLIO_RULES_VERSION = 2;
