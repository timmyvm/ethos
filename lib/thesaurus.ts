/**
 * The thesaurus behind the transcript's word sheet (#411, Timothy: "instead
 * of the definition of the word I'd like a thesaurus").
 *
 * Three lists, all instant and all on the phone:
 *
 *  - VAGUE: the words the transcript underlines as vague. Each one says
 *    less than the sentence needed (thing, stuff, good, really). A word the
 *    engine already counts as a filler (basically, actually, literally,
 *    kind of, sort of) is not here: it is underlined as the filler it was
 *    counted as, so the two marks never disagree with the number.
 *  - CURATED: alternatives for the vague words and the words people lean
 *    on most. Context-neutral, so each one fits most sentences the word
 *    fits, three to six each. Any other word asks the server
 *    (app/api/words), which reads the sentence it was said in.
 *  - STOPWORDS: the small words that hold a sentence together. Never
 *    counted as repeated, never sent to the server.
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
 * Alternatives, three to six each, good in most sentences the word is
 * good in. `lib/thesaurus.test.ts` holds the shape.
 */
export const CURATED: Readonly<Record<string, readonly string[]>> = {
  // The vague words.
  thing: ["point", "idea", "part", "detail", "issue", "step"],
  things: ["points", "ideas", "parts", "details", "steps"],
  stuff: ["material", "details", "the rest", "everything else"],
  really: ["truly", "deeply", "genuinely", "seriously"],
  very: ["deeply", "highly", "extremely", "especially"],
  just: ["only", "simply", "merely"],
  "a lot": ["many", "much", "plenty", "a great deal"],
  good: ["strong", "solid", "useful", "sound", "effective"],
  bad: ["weak", "poor", "harmful", "costly", "wrong"],
  nice: ["pleasant", "kind", "welcome", "warm", "thoughtful"],
  big: ["large", "major", "significant", "serious"],
  great: ["excellent", "strong", "remarkable", "outstanding"],
  huge: ["vast", "enormous", "major", "massive"],
  amazing: ["remarkable", "striking", "impressive", "extraordinary"],
  awesome: ["excellent", "impressive", "superb", "first-rate"],
  // The words people lean on most.
  important: ["central", "essential", "key", "vital", "critical"],
  interesting: ["striking", "curious", "surprising", "telling", "unusual"],
  different: ["distinct", "separate", "unlike", "other", "varied"],
  hard: ["difficult", "demanding", "tough", "testing"],
  easy: ["simple", "clear", "painless", "smooth"],
  problem: ["issue", "obstacle", "difficulty", "snag", "challenge"],
  problems: ["issues", "obstacles", "difficulties", "snags"],
  help: ["support", "assist", "aid", "serve"],
  change: ["shift", "move", "turn", "adjust"],
  show: ["reveal", "prove", "display", "demonstrate"],
  shows: ["reveals", "proves", "displays", "demonstrates"],
  make: ["build", "create", "produce", "form"],
  get: ["gain", "earn", "reach", "receive", "find"],
  got: ["gained", "earned", "reached", "received", "found"],
  use: ["apply", "employ", "draw on", "rely on"],
  think: ["believe", "expect", "suspect", "reckon"],
  know: ["understand", "see", "recognise", "realise"],
  want: ["need", "hope", "aim", "wish"],
  start: ["begin", "open", "launch", "set out"],
  try: ["attempt", "test", "aim for", "set out"],
  idea: ["plan", "notion", "proposal", "thought", "concept"],
  people: ["everyone", "others", "listeners", "the public"],
  way: ["method", "approach", "route", "means", "manner"],
  many: ["numerous", "plenty of", "countless", "several"],
  maybe: ["perhaps", "possibly", "likely"],
  also: ["too", "as well", "besides", "plus"],
  quite: ["fairly", "rather", "notably"],
  always: ["every time", "reliably", "without fail", "constantly"],
  never: ["not once", "at no point", "not ever"],
  obviously: ["clearly", "plainly", "evidently"],
  definitely: ["certainly", "surely", "without doubt"],
  totally: ["fully", "completely", "entirely", "wholly"],
  cool: ["impressive", "clever", "neat", "sharp"],
  fun: ["enjoyable", "lively", "engaging", "playful"],
  happy: ["glad", "pleased", "content", "delighted"],
  sad: ["low", "down", "disappointed", "unhappy"],
  small: ["minor", "modest", "slight", "little"],
  fast: ["quick", "rapid", "swift", "prompt"],
  slow: ["gradual", "unhurried", "steady", "measured"],
};

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

/** Instant alternatives for a word or a two-word phrase, or null when the server has to read the sentence. */
export function curatedFor(word: string): readonly string[] | null {
  return CURATED[wordKey(word)] ?? null;
}

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
