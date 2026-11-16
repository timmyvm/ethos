import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { plainRead, tracedStrength } from "./plain-read";

/*
 * A stored read in plain words (#484). Timothy, 16 Nov, bracketed "7
 * mid-sentence pauses against 1 composed pause." on a stored recording:
 * the words were the app's own pause labels, which the coach was sent and
 * wrote back. Stored reads keep their text; only those labels are put
 * into plain words where the read is drawn, and only as whole phrases.
 */
describe("plainRead: the app's pause labels in plain words", () => {
  it("reads Timothy's line as one plain sentence about what you did, both numbers kept", () => {
    expect(plainRead("7 mid-sentence pauses against 1 composed pause. Tomorrow: finish each sentence in one breath, then pause.")).toBe(
      "You paused mid-sentence 7 times and between sentences once. Tomorrow: finish each sentence in one breath, then pause."
    );
  });

  it("says the pair whole in either order, once and twice for 1 and 2, after a colon in lower case", () => {
    expect(plainRead("2 composed pauses against 5 mid-sentence pauses.")).toBe(
      "You paused between sentences twice and mid-sentence 5 times."
    );
    expect(plainRead("Pausing: three mid-sentence pauses vs. one composed pause, so finish first.")).toBe(
      "Pausing: you paused mid-sentence three times and between sentences once, so finish first."
    );
    expect(plainRead("11 fillers. 4 mid sentence pauses against 2 composed pauses.")).toBe(
      "11 fillers. You paused mid-sentence 4 times and between sentences twice."
    );
  });

  it("leaves the pair to the label swap where it cannot stand as its own sentence", () => {
    // Inside a longer clause, "You paused" would break the sentence.
    expect(plainRead("Your 7 mid-sentence pauses against 1 composed pause cost points.")).toBe(
      "Your 7 pauses mid-sentence against 1 pause between sentences cost points."
    );
    // A count of none is not "0 times".
    expect(plainRead("0 mid-sentence pauses against 3 composed pauses.")).toBe(
      "0 pauses mid-sentence against 3 pauses between sentences."
    );
  });

  it("says each label in plain words, one and many", () => {
    expect(plainRead("3 composed pauses.")).toBe("3 pauses between sentences.");
    expect(plainRead("1 mid-sentence pause at 0:20.")).toBe("1 pause mid-sentence at 0:20.");
    expect(plainRead("8 held pauses in 60 seconds.")).toBe("8 pauses in 60 seconds.");
    expect(plainRead("A composed pause before your point.")).toBe("A pause between sentences before your point.");
    expect(plainRead("Your mid sentence pauses cost you.")).toBe("Your pauses mid-sentence cost you.");
  });

  it("says \"composed\" of pauses plainly where it closes the clause, as the prompt taught it", () => {
    expect(plainRead("Two held pauses, both composed.")).toBe("Two pauses, both between sentences.");
    expect(plainRead("Your pause at 0:19 was composed.")).toBe("Your pause at 0:19 was between sentences.");
    expect(plainRead("3 pauses, all composed, 1 searching.")).toBe("3 pauses, all between sentences, 1 searching.");
    // Not about a pause, or not closing its clause: the speaker's own composure stays.
    expect(plainRead("You were composed.")).toBe("You were composed.");
    expect(plainRead("2 pauses. You were composed.")).toBe("2 pauses. You were composed.");
    expect(plainRead("Your pauses were composed and calm.")).toBe("Your pauses were composed and calm.");
  });

  it("leaves landed and landing as stored: the coach was never sent them", () => {
    expect(plainRead("3 composed pauses landed your points.")).toBe("3 pauses between sentences landed your points.");
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

describe("tracedStrength: what went well, only the sentences that trace", () => {
  it("drops Timothy's riddle and keeps the number", () => {
    expect(tracedStrength("0 fillers in 59 seconds. Nothing filled the gaps.")).toBe("0 fillers in 59 seconds.");
    expect(tracedStrength("Clean run. 0 fillers in 59 seconds.")).toBe("0 fillers in 59 seconds.");
  });

  it("keeps a sentence with a number, a count in words, a time or the speaker's quote", () => {
    for (const s of [
      "142 words a minute. Down from 171.",
      "Two pauses before a new point. Both were once.",
      "Your opening at 0:04. It led with “the mistake people make”.",
      "1.5 fillers a minute. Half of last time's 3.",
    ]) {
      expect(tracedStrength(s)).toBe(s);
    }
  });

  it("returns a strength exactly as stored when nothing in it traces, or all of it does", () => {
    for (const s of [
      "Held the pause before ‘the mistake people make’.",
      "Steady the whole way. Nothing rushed.",
      "0 fillers in 59 seconds.",
      "",
    ]) {
      expect(tracedStrength(s)).toBe(s);
    }
  });

  it("never splits a decimal or a quote, and adds no word", () => {
    expect(tracedStrength("2.77 fillers a minute. That's fine.")).toBe("2.77 fillers a minute.");
    expect(tracedStrength("Kill 'like.' 2 of your 4 fillers. Well done.")).toBe("Kill 'like.' 2 of your 4 fillers.");
  });
});

describe("the Log draws a stored read through them", () => {
  const page = readFileSync("app/rep/[id]/page.tsx", "utf8");
  it("for the read and for what went well, and never rewrites what is stored", () => {
    expect(page).toMatch(/focus: plainRead\(rep\.focus\)/);
    expect(page).toMatch(/strength: tracedStrength\(plainRead\(rep\.strength \?\? ""\)\)/);
    expect(page).not.toMatch(/\.update\(|\.upsert\(|\.insert\(/);
  });
});
