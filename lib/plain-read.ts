/**
 * A stored read, shown in plain words (DECISIONS #484).
 *
 * Timothy, 16 Nov, bracketed Demos's read on a stored recording as
 * failing the two-second test: "7 mid-sentence pauses against 1 composed
 * pause." The words were the app's own. The coach is sent its pauses as
 * `heldPauses`, `composedPauses` and `midSentencePauses`, and its prompt's
 * pause vocabulary says "a held pause before a sentence is composed", so
 * it wrote them back. New reads are asked for plain words (lib/coach.ts,
 * Task A item 5); a stored read keeps its text, and only these three
 * phrases are put into plain words where it is drawn:
 *
 *   composed pause(s)       pause(s) between sentences
 *   mid-sentence pause(s)   pause(s) mid-sentence
 *   held pause(s)           pause(s)
 *
 * A "composed" pause is a held pause after a word that ends a sentence
 * (lib/metrics.ts detectPauses, kind "pre"), and a pause is a gap between
 * two words, so every one of them stands between two sentences.
 *
 * Each only as a whole phrase, and only after a count or a word that
 * counts it ("7", "one", "a", "your", "no"), so a verb is never read as
 * the label ("You held pauses" stays as written) and nothing else in the
 * sentence moves. Never inside quotes, which hold the speaker's own words.
 * Every number stays where it was, so the read still traces to it.
 *
 *   "7 mid-sentence pauses against 1 composed pause."
 *   "7 pauses mid-sentence against 1 pause between sentences."
 */

/** The words that count a pause in front of the phrase. */
const COUNT =
  "\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|the|your|no|each|every|only|both|all|those|these|its|their";

const PHRASE = new RegExp(
  `\\b(${COUNT})(\\s+)(composed|mid-sentence|mid sentence|held)\\s+(pauses?)\\b`,
  "gi"
);

/** The speaker's words, quoted: double quotes, curly quotes, and single quotes that open and close on word edges. */
const QUOTED = /"[^"]*"|“[^”]*”|‘[^’]*’|(?<![\p{L}\p{N}])'[^']*'(?![\p{L}\p{N}])/gu;

/** One stretch of the coach's own words, outside any quote. */
function plainSpan(text: string): string {
  return text.replace(PHRASE, (_m, count: string, gap: string, kind: string, noun: string) => {
    const pause = noun.toLowerCase();
    const k = kind.toLowerCase();
    if (k === "composed") return `${count}${gap}${pause} between sentences`;
    if (k === "held") return `${count}${gap}${pause}`;
    return `${count}${gap}${pause} mid-sentence`;
  });
}

/**
 * The read with the app's three pause labels in plain words, the
 * speaker's quoted words untouched. Text with none of them comes back
 * exactly as it went in.
 */
export function plainRead(text: string): string {
  let out = "";
  let at = 0;
  for (const q of text.matchAll(QUOTED)) {
    const start = q.index ?? 0;
    out += plainSpan(text.slice(at, start)) + q[0];
    at = start + q[0].length;
  }
  return out + plainSpan(text.slice(at));
}
