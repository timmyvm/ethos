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
  /**
   * What it is called where its number is a SCORE out of 100, higher
   * better (#471): the results' and the Log's dimension rows, You's
   * trait levels and sheet. "Fillers 88" read as 88 fillers to the
   * testers (FT: "did it mean i was good in it or bad in it"), so a trait
   * named for the fault is named for the skill there. Where the number
   * is a count of the thing itself (Today's tile, a lesson's "Your
   * number", "4 fillers" on the glance) the name stays the fault's,
   * which reads right. The same as `name` where that is already a skill.
   */
  skill: string;
  /** The raw unit, for the number under the ring. */
  unit: string;
  /** The same unit at one. "1 restarts a minute" is a tell. */
  unitOne: string;
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
    skill: "Pausing",
    /* What the number counts, in the house's words (#490): pauses of a
       second or more before a sentence ("held" was the app's word). */
    unit: "pauses between sentences a minute",
    unitOne: "pause between sentences a minute",
    what: "Pauses of a second or more, and where you put them.",
    why: "A pause after a sentence is the clearest sign you meant it.",
    /*
     * The worked example Timothy named. It is the whole lesson: the
     * same length of silence reads as command or as searching depending
     * only on whether it lands between ideas or inside one.
     */
    distinction:
      "A pause to think and a pause for effect sound the same. Only where it falls is different.",
    howTo: [
      "Pause when a sentence ends, never halfway through it.",
      "Pause long enough to count to two in your head.",
      "Don't say \"um\" right before or after a pause.",
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
      note: "Same 1.4 seconds of silence. In the first it falls mid-sentence, so it sounds like you lost your place.",
    },
    move: (n, up) =>
      up
        ? `${s(n, "more pause", "more pauses")} between sentences a minute.`
        : `${s(n, "fewer pause", "fewer pauses")} between sentences a minute.`,
  },
  {
    id: "fillers",
    name: "Fillers",
    skill: "Filler control",
    /*
     * Per hundred WORDS, and um and uh only. The unit is not a
     * presentation choice: per minute moves when you change pace, and
     * every population figure this could be placed against counts
     * filled pauses and nothing else (docs/percentiles.md, Fillers).
     * Like and you know are still counted and still timestamped on the
     * results screen. They are just not what the ring is drawn from.
     */
    /* In words, as every unit is (#495): "per hundred words" here and
       "/100 words" on Today were two spellings of one measure. */
    unit: "um or uh in 100 words",
    unitOne: "um or uh in 100 words",
    what: "Um and uh, counted with a timestamp each, against the words around them.",
    why: "Every one is a gap you filled with sound instead of silence.",
    distinction:
      "Fillers are not a speaking problem. They are what happens when a thought arrives late.",
    howTo: [
      "Close your mouth between sentences. You can't say \"um\" with it shut.",
      "Take a breath before each sentence. That's where \"um\" sneaks in.",
      "Need a second to think? Stay quiet instead of saying \"um\".",
    ],
    move: (n, up) => `${n} ${up ? "more" : "fewer"} in 100 words.`,
  },
  {
    id: "repairs",
    name: "Restarts",
    /* "Follow-through" failed the two-second test (#490): finishing
       what, a plan or a sentence? Named like Filler control beside it,
       so a high number reads as fewer restarts. */
    skill: "Restart control",
    /* Per hundred words, like fillers and for the same reason: the
       published rate (Bortfeld's 1.94) is reported that way, and a
       per-minute count drops when somebody simply speeds up. */
    unit: "restarts in 100 words",
    unitOne: "restart in 100 words",
    what: "Sentences you abandoned and began again a different way.",
    why: "A listener hears a restart the way they hear an um, and it costs more.",
    distinction:
      "A restart is not an error to fix mid-flight. Finishing the weaker sentence beats abandoning it.",
    howTo: [
      "Finish the sentence you started, even if a better one comes to mind.",
      "Said it wrong? Finish the sentence, then say the right version as a new one.",
      "Know how a sentence ends before you start saying it.",
    ],
    move: (n, up) => `${n} ${up ? "more" : "fewer"} in 100 words.`,
  },
  {
    id: "pace",
    name: "Pace",
    skill: "Pace",
    unit: "words a minute",
    unitOne: "word a minute",
    what: "How fast you talk, and how much that speed moves.",
    why: "Too fast and people miss the point; too slow and they stop listening.",
    distinction:
      "Pace is not one speed. One steady speed the whole way sounds memorised, however good it is.",
    howTo: [
      "Say your most important sentence slower than the rest.",
      "Slow down for your last sentence.",
      "Catch yourself rushing? Pause for a second, then keep going.",
    ],
    move: (n, up) => `${s(n, "word")} a minute ${up ? "faster" : "slower"}.`,
  },
  {
    id: "range",
    name: "Variety",
    skill: "Variety",
    /* "distinct words per hundred" (#490): the same count in the words
       the Variety row already says ("62 different words in every 100
       you said"). */
    unit: "different words in every 100",
    unitOne: "different word in every 100",
    what: "How much of your vocabulary you actually reach for.",
    why: "The same phrase three times in a minute is the thing people remember.",
    distinction:
      "Variety is not a bigger vocabulary. It is not reaching for the same word twice in ten seconds.",
    howTo: [
      "Name a thing in full once, like \"my new phone\". Then just say \"it\".",
      "Skip \"really\" and \"very\". Say the exact word instead.",
      "Say exactly what it is: \"exams\", not \"stuff\".",
    ],
    move: (n, up) =>
      `${s(n, up ? "more different word" : "fewer different word", up ? "more different words" : "fewer different words")} in every 100.`,
  },
];

export const TRAIT = Object.fromEntries(
  TRAITS.map((t) => [t.id, t])
) as Record<TraitId, TraitDef>;
