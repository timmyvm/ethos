import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { plainRead } from "./plain-read";

/*
 * A stored read in plain words (#484). Timothy, 16 Nov, bracketed "7
 * mid-sentence pauses against 1 composed pause." on a stored recording:
 * the words were the app's own pause labels, which the coach was sent and
 * wrote back. Stored reads keep their text; only those labels are put
 * into plain words where the read is drawn, and only as whole phrases.
 */
describe("plainRead: the app's pause labels in plain words", () => {
  it("reads Timothy's line plainly, every number where it was", () => {
    expect(plainRead("7 mid-sentence pauses against 1 composed pause. Tomorrow: finish each sentence in one breath, then pause.")).toBe(
      "7 pauses mid-sentence against 1 pause between sentences. Tomorrow: finish each sentence in one breath, then pause."
    );
  });

  it("says each label in plain words, one and many", () => {
    expect(plainRead("3 composed pauses.")).toBe("3 pauses between sentences.");
    expect(plainRead("1 mid-sentence pause at 0:20.")).toBe("1 pause mid-sentence at 0:20.");
    expect(plainRead("8 held pauses in 60 seconds.")).toBe("8 pauses in 60 seconds.");
    expect(plainRead("A composed pause before your point.")).toBe("A pause between sentences before your point.");
    expect(plainRead("Your mid sentence pauses cost you.")).toBe("Your pauses mid-sentence cost you.");
    expect(plainRead("Two held pauses, both composed.")).toBe("Two pauses, both composed.");
  });

  it("leaves the internal word alone where it is not the app's label", () => {
    // A verb, not the label: "held" here is what the speaker did.
    expect(plainRead("You held pauses before 3 sentences.")).toBe("You held pauses before 3 sentences.");
    expect(plainRead("Held the pause before the point.")).toBe("Held the pause before the point.");
    // "composed" about the speaker, not a pause.
    expect(plainRead("You sounded composed for 60 seconds.")).toBe("You sounded composed for 60 seconds.");
  });

  it("never touches the speaker's quoted words", () => {
    const quoted = [
      'You said "a composed pause" at 0:12, then 2 composed pauses.',
      "You said “the held pause” at 0:12.",
      "Held the pause before ‘the composed pause’.",
      "Kill 'one held pause'. 2 of your 4 fillers.",
    ];
    expect(quoted.map(plainRead)).toEqual([
      'You said "a composed pause" at 0:12, then 2 pauses between sentences.',
      "You said “the held pause” at 0:12.",
      "Held the pause before ‘the composed pause’.",
      "Kill 'one held pause'. 2 of your 4 fillers.",
    ]);
  });

  it("returns a read with none of the labels exactly as it was", () => {
    for (const s of [
      "0 fillers in 59 seconds. Nothing filled the gaps.",
      "Kill ‘um’. 2 of your 4 fillers.",
      "11 fillers. Down from 19. Tomorrow: kill 'like.'",
      "",
    ]) {
      expect(plainRead(s)).toBe(s);
    }
  });

  it("adds no dash", () => {
    expect(plainRead("7 mid-sentence pauses against 1 composed pause.")).not.toMatch(/[—–]/);
  });
});

describe("the Log draws a stored read through it", () => {
  const page = readFileSync("app/rep/[id]/page.tsx", "utf8");
  it("for the read and for what went well, and never rewrites what is stored", () => {
    expect(page).toMatch(/focus: plainRead\(rep\.focus\)/);
    expect(page).toMatch(/strength: plainRead\(rep\.strength \?\? ""\)/);
    expect(page).not.toMatch(/\.update\(|\.upsert\(|\.insert\(/);
  });
});
