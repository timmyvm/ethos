/**
 * A stored read, shown in plain words (DECISIONS #484).
 *
 * Timothy, 16 Nov, bracketed Demos's read on a stored recording as
 * failing the two-second test: "7 mid-sentence pauses against 1 composed
 * pause." The words were the app's own. The coach is sent its pauses as
 * `heldPauses`, `composedPauses` and `midSentencePauses`, and its prompt's
 * pause vocabulary says "a held pause before a sentence is composed", so
 * it wrote them back. New reads are asked for plain words (lib/coach.ts,
 * Task A item 5); a stored read keeps its text, and only the app's own
 * pause labels are put into plain words where it is drawn:
 *
 *   N mid-sentence pauses against M composed pauses
 *                           You paused mid-sentence N times and between
 *                           sentences M times (1 once, 2 twice), when the
 *                           pair stands as its own clause
 *   composed pause(s)       pause(s) between sentences
 *   mid-sentence pause(s)   pause(s) mid-sentence
 *   held pause(s)           pause(s)
 *   (pauses) both composed  both between sentences, where "composed"
 *                           closes its clause in a sentence about pauses,
 *                           as the prompt taught it ("is composed")
 *
 * A "composed" pause is a held pause after a word that ends a sentence
 * (lib/metrics.ts detectPauses, kind "pre"), and a pause is a gap between
 * two words, so every one of them stands between two sentences. The
 * prompt (Task A item 5) asks new reads for the same words.
 *
 * Each only as a whole phrase, and a label only after a count or a word
 * that counts it ("7", "one", "a", "your", "no"), so a verb is never read
 * as the label ("You held pauses" stays as written) and nothing else in
 * the sentence moves. Never inside quotes, which hold the speaker's own
 * words. Every number stays, so the read still traces to it. "landed"
 * and "landing" are left as stored: the coach was never sent them, so
 * they are the model's words, not the app's.
 */

const COUNT_WORD = "\\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve";

/** The words that count a pause in front of the phrase. */
const COUNT = `${COUNT_WORD}|a|an|the|your|no|each|every|only|both|all|those|these|its|their`;

const PHRASE = new RegExp(
  `\\b(${COUNT})(\\s+)(composed|mid-sentence|mid sentence|held)\\s+(pauses?)\\b`,
  "gi"
);

/**
 * The bracketed shape whole: two counts, the app's two labels, "against"
 * between them, at the head of a sentence (or after a colon) and closing
 * its clause, so it can be said as one plain sentence about what you did.
 */
const PAIR = new RegExp(
  `(^|[.!?:;]\\s+)(${COUNT_WORD})\\s+(composed|mid[- ]sentence)\\s+pauses?\\s+(?:against|versus|vs\\.?)\\s+(${COUNT_WORD})\\s+(composed|mid[- ]sentence)\\s+pauses?(?=\\s*(?:[.!?,;]|$))`,
  "gi"
);

/** "composed" said of pauses, closing its clause: "both composed", "was composed". */
const PREDICATE = /\b(both|all|each|was|were|is|are)\s+composed\b(?=\s*(?:[.!?,;:]|$))/gi;

/** The speaker's words, quoted: double quotes, curly quotes, and single quotes that open and close on word edges. */
const QUOTED = /"[^"]*"|“[^”]*”|‘[^’]*’|(?<![\p{L}\p{N}])'[^']*'(?![\p{L}\p{N}])/gu;

/** A quote stands in as one private-use mark (no digit, no letter), so nothing below can match inside it. */
const MARK = /[-]/;

function shielded(text: string): { masked: string; restore: (s: string) => string } {
  const quotes: string[] = [];
  const masked = text.replace(QUOTED, (q) => {
    quotes.push(q);
    return `${String.fromCharCode(0xe100 + quotes.length - 1)}`;
  });
  return {
    masked,
    restore: (s) => s.replace(/([-])/g, (_m, c: string) => quotes[c.charCodeAt(0) - 0xe100]),
  };
}

const where = (kind: string) => (/^composed$/i.test(kind) ? "between sentences" : "mid-sentence");

function times(n: string): string {
  const l = n.toLowerCase();
  if (l === "1" || l === "one") return "once";
  if (l === "2" || l === "two") return "twice";
  return `${n} times`;
}

const none = (n: string) => /^(0+|zero)$/i.test(n);

/** The sentence around `at` in `s`, by its stops. */
function sentenceAt(s: string, at: number): string {
  const before = s.slice(0, at);
  const start = Math.max(before.lastIndexOf(". "), before.lastIndexOf("! "), before.lastIndexOf("? "));
  const rest = s.slice(at).search(/[.!?](?=\s|$)/);
  return s.slice(start < 0 ? 0 : start + 2, rest < 0 ? s.length : at + rest + 1);
}

/**
 * The read with the app's pause labels in plain words, the speaker's
 * quoted words untouched. Text with none of them comes back exactly as
 * it went in.
 */
export function plainRead(text: string): string {
  const { masked, restore } = shielded(text);
  const out = masked
    .replace(PAIR, (whole, lead: string, n1: string, k1: string, n2: string, k2: string) => {
      /* The same label twice, or a count of none, is left to the label swap below. */
      if (where(k1) === where(k2) || none(n1) || none(n2)) return whole;
      const you = lead === "" || /[.!?]/.test(lead) ? "You" : "you";
      return `${lead}${you} paused ${where(k1)} ${times(n1)} and ${where(k2)} ${times(n2)}`;
    })
    .replace(PHRASE, (_m, count: string, gap: string, kind: string, noun: string) => {
      const pause = noun.toLowerCase();
      const k = kind.toLowerCase();
      if (k === "composed") return `${count}${gap}${pause} between sentences`;
      if (k === "held") return `${count}${gap}${pause}`;
      return `${count}${gap}${pause} mid-sentence`;
    })
    .replace(PREDICATE, (m: string, word: string, at: number, s: string) =>
      /\bpause/i.test(sentenceAt(s, at)) ? `${word} between sentences` : m
    );
  return restore(out);
}

/** A sentence traces when it holds a number, a count in words, or the speaker's quoted words. */
const TRACES = /\d|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|once|twice)\b/i;

/** Sentences, each with its stop and any quote that closes on it. A decimal point is not a stop. */
function sentences(s: string): string[] {
  const out: string[] = [];
  let at = 0;
  for (const m of s.matchAll(/[.!?]+['’"”)\]]*(?=\s|$)/g)) {
    const end = (m.index ?? 0) + m[0].length;
    out.push(s.slice(at, end));
    at = end;
  }
  if (at < s.length) out.push(s.slice(at));
  return out.map((x) => x.trim()).filter(Boolean);
}

/**
 * A stored strength, drawn with only the sentences that trace (CLAUDE.md:
 * feedback traces to a timestamp or a number; if it can't, it isn't
 * said). Timothy bracketed "Kept: 0 fillers in 59 seconds. Nothing
 * filled the gaps." (#484): the second sentence says the first again as
 * a riddle, with nothing to point to. A sentence with no number, no
 * count in words and no quote is not drawn, so long as one that traces
 * is left; a strength with none that traces, or with every sentence
 * tracing, comes back exactly as stored. Nothing is added or reworded,
 * and nothing is written back.
 */
export function tracedStrength(text: string): string {
  const { masked, restore } = shielded(text);
  const all = sentences(masked);
  const traced = all.filter((s) => TRACES.test(s) || MARK.test(s));
  if (traced.length === 0 || traced.length === all.length) return text;
  return restore(traced.join(" "));
}
