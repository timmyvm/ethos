/**
 * What Demos says on the score step: one line about THIS take (E54,
 * E34). Tomorrow is said once, on the last step (`Tomorrow`, the next
 * practice), so the bubble never names a second tomorrow two taps
 * before it ("Tomorrow: kill 'um'", then "Move the pace").
 *
 * Display-side, so the coach call and its prompt stay as they are: the
 * call also returns the scores the testers rate, and its prompt waits
 * for the test to end (13 November).
 */

/** The fields of a take the computed line reads. */
export interface LineMetrics {
  fillerCount: number;
  durationS: number;
  fillers: { word: string }[];
  topFiller?: string | null;
}

/**
 * A line counted from the take, for one the coach never read: the
 * fillers, the length and the word said most. It never says tomorrow,
 * and never calls a take with fillers clean.
 */
export function computedLine(m: LineMetrics): string {
  const n = m.fillerCount;
  if (n === 0) return "Clean take.";
  const s = Math.round(m.durationS);
  const counts = new Map<string, number>();
  for (const f of m.fillers) counts.set(f.word, (counts.get(f.word) ?? 0) + 1);
  const top = m.topFiller ?? [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (n === 1) return top ? `1 filler in ${s}s: “${top}”.` : `1 filler in ${s}s.`;
  return top ? `${n} fillers in ${s}s, most of them “${top}”.` : `${n} fillers in ${s}s.`;
}

/**
 * A line's sentences, each with its own end ("11 fillers.", "Tomorrow:
 * kill 'like.'"). A full stop between two digits is a decimal ("1.5 a
 * minute"), not an end.
 */
export function sentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "." || c === "!" || c === "?") {
      const decimal = /\d/.test(text[i - 1] ?? "") && /\d/.test(text[i + 1] ?? "");
      if (!decimal) {
        let j = i + 1;
        while (j < text.length && /[.!?"'”’)]/.test(text[j])) j++;
        if (j >= text.length || /\s/.test(text[j])) {
          out.push(text.slice(start, j).trim());
          while (j < text.length && /\s/.test(text[j])) j++;
          start = j;
          i = j;
          continue;
        }
      }
    }
    i++;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

/** The line without a last sentence that begins "Tomorrow"; "" if that was all of it. */
export function withoutTomorrow(line: string): string {
  const parts = sentences(line.trim());
  if (parts.length > 0 && /^tomorrow\b/i.test(parts[parts.length - 1])) parts.pop();
  return parts.join(" ");
}

/**
 * The score step's line: the coach's own, its tomorrow trimmed; a
 * stored focus on its own, capitalised (no "Tomorrow:" in front); or the
 * computed line when neither leaves anything to say.
 */
export function scoreLine(
  coach: { coachLine?: string | null; focus?: string | null } | null,
  m: LineMetrics
): string {
  const said = coach?.coachLine?.trim() ? withoutTomorrow(coach.coachLine) : "";
  if (said) return said;
  if (!coach?.coachLine?.trim() && coach?.focus?.trim()) {
    const f = coach.focus.trim();
    return f[0].toUpperCase() + f.slice(1);
  }
  return computedLine(m);
}
