/**
 * A title takes no full stop (#454, COPY-RULES.md).
 *
 * A heading, a card's title, an error's title and a sheet's headline are
 * names for what is under them, and a name is not a sentence. One that
 * holds two sentences keeps both stops, because the first needs the
 * second ("22 days of numbers. Keep all of them."). What Demos says is
 * speech and keeps its stop wherever he says it.
 *
 * Some lines are both: the plan's headline is said by Demos in the
 * introduction ("Hold the room.") and stands as the road card's title on
 * You. The line is written as speech, and the title is cut from it here.
 */
export function asTitle(line: string): string {
  const text = line.trim();
  if (!text.endsWith(".") || text.endsWith("...")) return text;
  const body = text.slice(0, -1);
  // A stop inside, followed by a space, is a second sentence: both stay.
  return /[.!?]\s/.test(body) ? text : body;
}
