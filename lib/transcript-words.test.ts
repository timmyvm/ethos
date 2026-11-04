import { describe, expect, it } from "vitest";
import { computeMetrics, type Word } from "./metrics";
import { clockOf, transcriptPieces, type TranscriptUnit } from "./transcript-words";

/**
 * The transcript as tappable words (#411). Three promises: the text
 * comes back exactly as it was (every letter and comma, in order), a word
 * underlined as a filler is one the engine counted, at the time it
 * counted it, and a word knows when it was said.
 */

/** Whisper's list for a text: its words without punctuation, 0.4s apart. */
function listFor(text: string): Word[] {
  return (text.match(/[A-Za-z0-9']+/g) ?? []).map((word, i) => ({ word, start: i * 0.4, end: i * 0.4 + 0.3 }));
}

const TEXT =
  "So the thing about habits is, um, they compound. You do the small version every day and, like, it builds. Um, you know, a lot of people miss a day. The day after is the day that counts.";

const words = (text: string, list: Word[] | null = listFor(text)) =>
  transcriptPieces(text, list).filter((p): p is TranscriptUnit => p.kind === "word");

describe("transcriptPieces", () => {
  it("gives the text back exactly, every word a piece of it", () => {
    const pieces = transcriptPieces(TEXT, listFor(TEXT));
    expect(pieces.map((p) => p.text).join("")).toBe(TEXT);
    const units = pieces.filter((p) => p.kind === "word");
    expect(units.map((u) => (u as TranscriptUnit).n)).toEqual(units.map((_, i) => i));
  });

  it("underlines exactly the fillers the engine counts, at its times", () => {
    const list = listFor(TEXT);
    const counted = computeMetrics(list, 60).fillers;
    const marked = words(TEXT, list)
      .filter((u) => u.mark === "filler")
      .map((u) => ({ word: u.filler, t: Math.round((u.start ?? -1) * 100) / 100 }));
    expect(marked).toEqual(counted);
    expect(marked.map((m) => m.word)).toEqual(["um", "like", "um", "you know"]);
  });

  it("keeps a two-word filler as one tap", () => {
    const youKnow = words(TEXT).find((u) => u.filler === "you know");
    expect(youKnow?.text).toBe("you know");
    expect(youKnow?.key).toBe("you know");
  });

  it("marks the vague words, the two-word phrases whole", () => {
    const vague = words(TEXT).filter((u) => u.mark === "vague").map((u) => u.text);
    expect(vague).toEqual(["thing", "a lot"]);
  });

  it("marks a word said three times or more, and not the small ones", () => {
    const units = words(TEXT);
    const day = units.filter((u) => u.key === "day");
    expect(day.length).toBe(4);
    expect(day.every((u) => u.mark === "repeat" && u.times === 4)).toBe(true);
    // "the" is said six times and is a small word.
    expect(units.filter((u) => u.key === "the").every((u) => u.mark === null && u.small)).toBe(true);
  });

  it("counts plural and singular together", () => {
    const units = words("One habit. Two habits. The habit holds.");
    expect(units.filter((u) => u.mark === "repeat").map((u) => u.text)).toEqual(["habit", "habits", "habit"]);
  });

  it("gives each word the time it was said and its sentence", () => {
    const units = words(TEXT);
    const compound = units.find((u) => u.key === "compound")!;
    expect(compound.start).toBeCloseTo(8 * 0.4);
    expect(compound.sentence).toBe("So the thing about habits is, um, they compound.");
    expect(clockOf(74.6)).toBe("1:14");
  });

  it("names a word as said, without the capital only the sentence gave it", () => {
    const units = words("Habits matter. I think Tim knows. NASA does too.");
    expect(units.map((u) => u.display)).toEqual(["habits", "matter", "I", "think", "Tim", "knows", "NASA", "does", "too"]);
  });

  it("keeps aligning past a word the list split in two", () => {
    const text = "A five-minute habit compounds.";
    const list: Word[] = [
      { word: "A", start: 0, end: 0.2 },
      { word: "five", start: 0.4, end: 0.6 },
      { word: "minute", start: 0.7, end: 0.9 },
      { word: "habit", start: 1.1, end: 1.3 },
      { word: "compounds", start: 1.5, end: 1.9 },
    ];
    const units = words(text, list);
    expect(units.map((u) => [u.text, u.start])).toEqual([
      ["A", 0],
      ["five-minute", 0.4],
      ["habit", 1.1],
      ["compounds", 1.5],
    ]);
  });

  it("leaves a word the list never said without a time", () => {
    const units = words("They compound fast.", [
      { word: "They", start: 0, end: 0.2 },
      { word: "fast", start: 1, end: 1.2 },
    ]);
    expect(units.map((u) => u.start)).toEqual([0, null, 1]);
  });

  it("reads a stored row with no word list from its text, fillers timed by label", () => {
    const text = "So, um, the plan. You know, it held. Um, yes.";
    const units = transcriptPieces(text, null, [
      { word: "um", t: 1.2 },
      { word: "you know", t: 4.5 },
      { word: "um", t: 8.1 },
    ]).filter((p): p is TranscriptUnit => p.kind === "word");
    expect(units.filter((u) => u.mark === "filler").map((u) => [u.filler, u.start])).toEqual([
      ["um", 1.2],
      ["you know", 4.5],
      ["um", 8.1],
    ]);
    expect(units.filter((u) => u.mark !== "filler").every((u) => u.start === null)).toBe(true);
  });

  it("is nothing for nothing", () => {
    expect(transcriptPieces("", [])).toEqual([]);
    expect(transcriptPieces("...", [])).toEqual([{ kind: "gap", text: "..." }]);
  });
});
