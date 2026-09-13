/**
 * The traits (DECISIONS #257). The set Ethos measures, what each one
 * is, why it matters, and the one concrete thing that moves it.
 *
 * This replaces the road. There is no fixed order any more: the next
 * lesson is whichever trait is lowest, and a lesson exists because a
 * number said so. That means every trait here has to be able to stand
 * as the reason, so each one carries its own teaching copy rather than
 * inheriting it from a unit it happens to sit in.
 *
 * The DISTRIBUTIONS are not here. They live in `content/norms.ts` with
 * their sources, because a number that claims to place somebody against
 * the population needs a citation beside it and copy does not.
 *
 * Copy rules apply to every string (COPY-RULES.md), and the tests hold
 * them to it.
 */

export type TraitId = "pause" | "fillers" | "repairs" | "pace" | "range";

export interface TraitDef {
  id: TraitId;
  /** What the card calls it. A behaviour, not a metric name. */
  name: string;
  /** The raw unit, for the number under the ring. */
  unit: string;
  /** One sentence: what this measures. */
  what: string;
  /** One sentence: why a listener cares. Never "you should". */
  why: string;
  /**
   * The distinction the lesson turns on. Every trait has one thing
   * people get wrong about it, and naming that is what makes a lesson
   * a lesson rather than a tip.
   */
  distinction: string;
  /** Two or three tactics. The technique, not encouragement. */
  howTo: string[];
  /**
   * The walk-through: the SAME line said two ways, so the distinction
   * stops being an assertion and becomes something you can hear.
   *
   * Optional, and only `pause` has approved copy today. A trait without
   * one skips that step rather than showing a screen somebody would
   * have had to write on the spot (the pattern #248 set for the unit
   * marks).
   */
  walkthrough?: {
    /** What most people do. */
    before: string;
    /** The same words, moved. */
    after: string;
    /** One line naming what changed. Never "see the difference?". */
    note: string;
  };
  /**
   * The one concrete move, in this trait's own units, built from the
   * distance the raw number has to travel. This is the answer to "how
   * do I raise this", and it is a number rather than advice: a
   * percentile nobody can act on is a horoscope with a number in it.
   *
   * `n` arrives already rounded and positive; `up` says which way.
   */
  move: (n: number, up: boolean) => string;
}

/** "1 filler" and "2 fillers", without a plural helper at every site. */
const s = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export const TRAITS: TraitDef[] = [
  {
    id: "pause",
    name: "Pausing",
    unit: "held pauses a minute",
    what: "Silences long enough to land, and where you put them.",
    why: "A held silence after a point is the clearest signal that you meant it.",
    /*
     * The worked example Timothy named. It is the whole lesson: the
     * same length of silence reads as command or as searching depending
     * only on whether it lands between ideas or inside one.
     */
    distinction:
      "A pause to think and a pause for effect sound identical. Only the placement differs.",
    howTo: [
      "The beat goes after the full stop, before the next idea. Inside a sentence it reads as searching.",
      "One to two seconds reads as command. Past three and a half it costs you.",
      "Do not fill it. A pause with an \"um\" leaning on it earns nothing.",
    ],
    walkthrough: {
      /*
       * The same sentence, the same 1.4 seconds of silence, in two
       * places. This is the whole lesson: the silence is identical and
       * only its position decides whether it reads as command or as
       * somebody looking for the next word.
       */
      before: "The thing about habits is  \u2026  they compound, and you do the small version every day.",
      after: "The thing about habits is that they compound.  \u2026  You do the small version every day.",
      note: "Same 1.4 seconds of silence. In the first it is inside the sentence, so it reads as searching.",
    },
    move: (n, up) =>
      up
        ? `${s(n, "more landed pause", "more landed pauses")} a minute.`
        : `${s(n, "fewer landed pause", "fewer landed pauses")} a minute.`,
  },
  {
    id: "fillers",
    name: "Fillers",
    unit: "fillers a minute",
    what: "Um, uh, like, you know, counted with a timestamp each.",
    why: "Every one is a gap you filled with sound instead of silence.",
    distinction:
      "Fillers are not a speaking problem. They are what happens when a thought arrives late.",
    howTo: [
      "Close your mouth at the end of a clause. Most fillers happen with it already open.",
      "Slow the run-up, not the words. Fillers cluster where the sentence starts.",
      "Let the gap sit. One second of silence costs nothing and buys the next sentence.",
    ],
    move: (n, up) =>
      up ? `${s(n, "more filler")} a minute.` : `${s(n, "fewer filler")} a minute.`,
  },
  {
    id: "repairs",
    name: "Restarts",
    unit: "restarts a minute",
    what: "Sentences you abandoned and began again a different way.",
    why: "A listener hears a restart the way they hear an um, and it costs more.",
    distinction:
      "A restart is not an error to fix mid-flight. Finishing the weaker sentence beats abandoning it.",
    howTo: [
      "Finish the sentence you started, even when you can hear a better one.",
      "Say the correction as a new sentence: \"Or rather,\" then the better version.",
      "Decide the ending before the beginning. Most restarts are a sentence with nowhere to land.",
    ],
    move: (n, up) =>
      up ? `${s(n, "more restart")} a minute.` : `${s(n, "fewer restart")} a minute.`,
  },
  {
    id: "pace",
    name: "Pace",
    unit: "words a minute",
    what: "How fast you talk, and how much that speed moves.",
    why: "Too fast and the point does not land; too slow and it leaves before you do.",
    distinction:
      "Pace is not one speed. A talk at one steady rate reads as recited, however good the rate is.",
    howTo: [
      "Slow the sentence that carries the point, and only that one.",
      "Speed is a tool for the middle of a list and a liability at the end of an argument.",
      "If you are rushing, you are usually afraid of the silence. Take the silence.",
    ],
    move: (n, up) => `${s(n, "word")} a minute ${up ? "faster" : "slower"}.`,
  },
  {
    id: "range",
    name: "Variety",
    unit: "distinct words per hundred",
    what: "How much of your vocabulary you actually reach for.",
    why: "The same phrase three times in a minute is the thing people remember.",
    distinction:
      "Variety is not a bigger vocabulary. It is not reaching for the same word twice in ten seconds.",
    howTo: [
      "Name the thing once properly, then use a pronoun. Repeating the full phrase is what reads as padding.",
      "Your crutch word is the one you cannot hear. The recording can.",
      "A short concrete noun beats a long abstract one every time.",
    ],
    move: (n, up) =>
      `${s(n, "distinct word")} per hundred ${up ? "more" : "fewer"}.`,
  },
];

export const TRAIT = Object.fromEntries(
  TRAITS.map((t) => [t.id, t])
) as Record<TraitId, TraitDef>;
