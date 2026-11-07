/**
 * The word lists behind the transcript's word sheet (#411, #428).
 *
 * All instant and all on the phone:
 *
 *  - VAGUE: the words the transcript underlines as vague. Each one often
 *    says less than the sentence needed (thing, stuff, good, really). The
 *    underline is display only: no score reads it. A word the engine
 *    already counts as a filler (basically, actually, literally, kind of,
 *    sort of) is not here: it is underlined as the filler it was counted
 *    as, so the two marks never disagree with the number.
 *  - SET_PHRASES: phrases where a vague word is doing exact work ("good
 *    luck", "just in case"). Their words are not underlined, since the
 *    sheet's honest answer for them is keep.
 *  - STOPWORDS: the small words that hold a sentence together. Never
 *    counted as repeated, never sent to the server.
 *
 * What to say instead is never answered from a list (#428, Timothy: "the
 * try instead words are shittt"). The curated map that used to answer
 * here could not read the sentence, so it offered "points" for "switch
 * things up". Every word now goes to the server (app/api/words), which
 * reads the word in its sentence and says swap or keep.
 *
 * Copy rules apply (COPY-RULES.md): no em dashes, no gym words, and no
 * word that manufactures insecurity.
 */

/** Lowercase, curly apostrophes made straight, outer punctuation gone. */
export function wordKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}' -]/gu, "")
    .replace(/\s+/g, " ")
    .replace(/^['\s-]+|['\s-]+$/g, "");
}

/** The vague words, one word or two, as the transcript matches them. */
export const VAGUE = [
  "thing",
  "things",
  "stuff",
  "really",
  "very",
  "just",
  "a lot",
  "good",
  "bad",
  "nice",
  "big",
  "great",
  "huge",
  "amazing",
  "awesome",
] as const;

export const VAGUE_SET: ReadonlySet<string> = new Set(VAGUE);

/** The two-word vague phrases, matched on consecutive words. */
export const VAGUE_BIGRAMS: readonly (readonly [string, string])[] = VAGUE.filter((v) =>
  v.includes(" ")
).map((v) => v.split(" ") as [string, string]);

/**
 * Phrases where a vague word is the plain, exact way to say it. The
 * transcript leaves their words unmarked (lib/transcript-words.ts), so
 * the underline and the sheet's "Keep it." agree. Idioms that do have a
 * better phrasing ("switch things up") are not here and keep their mark.
 */
export const SET_PHRASES: readonly string[] = [
  "just in case",
  "just in time",
  "just now",
  "good luck",
  "good morning",
  "good night",
  "for good",
  "the very first",
  "the very last",
  "the very same",
  "the very end",
  "the very beginning",
  "the big picture",
  "thanks a lot",
];

/**
 * Small words. Not counted as repeated (everyone says "the" forty times),
 * and a tap on one offers nothing to swap.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "the", "and", "or", "but", "nor", "so", "yet", "if", "then", "than", "because", "as",
  "of", "to", "in", "on", "at", "by", "for", "with", "from", "into", "onto", "about", "over",
  "under", "up", "down", "out", "off", "through", "after", "before", "between", "around", "till",
  "until", "while", "since",
  "i", "me", "my", "mine", "myself", "you", "your", "yours", "yourself", "he", "him", "his",
  "she", "her", "hers", "it", "its", "itself", "we", "us", "our", "ours", "they", "them", "their",
  "theirs", "this", "that", "these", "those", "who", "whom", "whose", "which", "what", "where",
  "when", "why", "how", "there", "here",
  "is", "are", "was", "were", "be", "been", "being", "am", "do", "does", "did", "done", "have",
  "has", "had", "having", "will", "would", "can", "could", "shall", "should", "may", "might",
  "must", "let",
  "not", "no", "yes", "all", "any", "some", "each", "every", "both", "either", "neither",
  "other", "such", "own", "same", "too", "only", "more", "most", "less", "much", "even", "ever",
  "again", "once", "now", "still", "well", "oh", "okay", "ok", "like", "um", "uh", "erm",
  "i'm", "i've", "i'll", "i'd", "you're", "you've", "you'll", "you'd", "it's", "that's",
  "there's", "he's", "she's", "we're", "we've", "they're", "they've", "don't", "doesn't",
  "didn't", "isn't", "aren't", "wasn't", "weren't", "can't", "couldn't", "won't", "wouldn't",
  "shouldn't", "haven't", "hasn't", "let's", "what's",
]);

export function isStopword(word: string): boolean {
  return STOPWORDS.has(wordKey(word));
}

/**
 * The one sentence a filler's sheet says under "Pause instead.", by the
 * label the engine counted it as (lib/metrics.ts fillerSpans).
 */
export function fillerWhy(label: string): string {
  switch (label) {
    case "um":
    case "uh":
    case "erm":
      return "A second of silence reads as thought, and the sound over it reads as searching.";
    case "like":
      return "As a filler it hedges whatever comes next, and the sentence stands up better without it.";
    case "you know":
      return "It asks the listener to supply the point, so make the point and stop.";
    case "kind of":
    case "sort of":
      return "It softens the claim before you make it, so say the claim plainly.";
    default:
      return "It adds sound and no meaning, so the sentence lands harder without it.";
  }
}
