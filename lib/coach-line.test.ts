import { describe, expect, it } from "vitest";
import { computedLine, scoreLine, sentences, splitTomorrow, takeLine, withoutTomorrow } from "@/lib/coach-line";

const take = (words: string[], durationS = 62) => ({
  fillerCount: words.length,
  durationS,
  fillers: words.map((word) => ({ word })),
  topFiller: null,
});

/*
 * One tomorrow (E54, E34): the score step's bubble talks about this
 * take; the last step names what is next. Two tomorrows two taps apart
 * ("kill 'um'", then "Move the pace") was the walk saying two things.
 */
describe("the computed line", () => {
  it("counts this take and names its most-said filler, never tomorrow", () => {
    expect(computedLine(take(["um", "um", "um", "like"]))).toBe("4 fillers in 62s, most of them “um”.");
    expect(computedLine(take(["like"], 40.4))).toBe("1 filler in 40s: “like”.");
    expect(computedLine(take([]))).toBe("Clean take.");
    for (const words of [[], ["um"], ["um", "so", "um"], ["like", "like"]]) {
      expect(computedLine(take(words))).not.toMatch(/tomorrow/i);
    }
  });

  it("takes the engine's own top filler when it has one", () => {
    expect(computedLine({ ...take(["um", "like", "like"]), topFiller: "um" })).toBe(
      "3 fillers in 62s, most of them “um”."
    );
  });
});

describe("sentences", () => {
  it("splits on ends, keeps quotes with their sentence, and leaves decimals whole", () => {
    expect(sentences("11 fillers. Down from 19. Tomorrow: kill 'like.'")).toEqual([
      "11 fillers.",
      "Down from 19.",
      "Tomorrow: kill 'like.'",
    ]);
    expect(sentences("1.5 fillers a minute. Steady!")).toEqual(["1.5 fillers a minute.", "Steady!"]);
  });
});

describe("a coach line's tomorrow", () => {
  it("is trimmed when it is the last sentence", () => {
    expect(withoutTomorrow("11 fillers. Down from 19. Tomorrow: kill 'like.'")).toBe("11 fillers. Down from 19.");
    expect(withoutTomorrow("Held three pauses. tomorrow, slow the open.")).toBe("Held three pauses.");
  });

  it("stays when it is not the last sentence, and a line with none is untouched", () => {
    expect(withoutTomorrow("Tomorrow, slow the open. 3 held pauses already land.")).toBe(
      "Tomorrow, slow the open. 3 held pauses already land."
    );
    expect(withoutTomorrow("Three held pauses landed the point.")).toBe("Three held pauses landed the point.");
  });

  it("leaves the computed line when the tomorrow was all of it", () => {
    expect(scoreLine({ coachLine: "Tomorrow: kill 'um'." }, take(["um", "um"]))).toBe(
      "2 fillers in 62s, most of them “um”."
    );
  });
});

describe("the score step's line", () => {
  it("is the coach's line without its tomorrow", () => {
    expect(scoreLine({ coachLine: "4 fillers in 62s. Tomorrow: kill 'um'.", focus: "kill um" }, take(["um"]))).toBe(
      "4 fillers in 62s."
    );
  });

  it("says a stored focus alone, capitalised, with no Tomorrow in front", () => {
    const line = scoreLine({ coachLine: "", focus: "move the pace at the turn" }, take(["um"]));
    expect(line).toBe("Move the pace at the turn");
    expect(line).not.toMatch(/tomorrow/i);
  });

  it("is the computed line with no coach", () => {
    expect(scoreLine(null, take([]))).toBe("Clean take.");
  });

  it("counts no fillers and calls nothing clean in a take too short to score (#416 review)", () => {
    for (const words of [[], ["um"], ["um", "um", "like"]]) {
      const line = scoreLine(null, { ...take(words, 8), scorable: false });
      expect(line).toBe("Give it 60 to 90 seconds and a real answer.");
      expect(line).not.toMatch(/clean|filler/i);
    }
    expect(scoreLine({ coachLine: "Tomorrow: kill 'um'." }, { ...take(["um"], 8), scorable: false })).toBe(
      "Give it 60 to 90 seconds and a real answer."
    );
  });
});

/*
 * The Log's bubble in two parts (Timothy, 12 Nov, #436): what the take
 * did, then tomorrow as its own statement under its own label.
 */
describe("a stored line, split at its tomorrow", () => {
  it("parts the read from the instruction and drops the word the label prints", () => {
    expect(
      splitTomorrow("7 mid-sentence pauses against 1 composed pause. Tomorrow: finish each sentence in one breath, then pause.")
    ).toEqual({
      read: "7 mid-sentence pauses against 1 composed pause.",
      tomorrow: "Finish each sentence in one breath, then pause.",
    });
  });

  it("keeps a decimal whole and a quoted word with its sentence", () => {
    expect(splitTomorrow("1.5 fillers a minute, most of them \u201cum.\u201d Tomorrow, kill \u2018um.\u2019")).toEqual({
      read: "1.5 fillers a minute, most of them \u201cum.\u201d",
      tomorrow: "Kill \u2018um.\u2019",
    });
  });

  it("takes everything after the word, when the instruction runs to a second sentence", () => {
    expect(splitTomorrow("11 fillers. Tomorrow: kill \u2018like\u2019. Then hold the pause.")).toEqual({
      read: "11 fillers.",
      tomorrow: "Kill \u2018like\u2019. Then hold the pause.",
    });
  });

  it("is all instruction when the line is only a tomorrow, and all read when it names none", () => {
    expect(splitTomorrow("Tomorrow: one gear down.")).toEqual({ read: "", tomorrow: "One gear down." });
    expect(splitTomorrow("Kill \u2018like\u2019. 2 of your 3 fillers.")).toEqual({
      read: "Kill \u2018like\u2019. 2 of your 3 fillers.",
      tomorrow: null,
    });
    // A word that only starts the same is not the label.
    expect(splitTomorrow("Tomorrows are not promised.").tomorrow).toBeNull();
  });
});

describe("a take's three numbers, as one line", () => {
  it("says length, pace and held pauses in words", () => {
    expect(takeLine({ durationS: 64.6, wpm: 155, heldPauses: 3 })).toBe(
      "65 seconds at 155 words a minute, with 3 held pauses."
    );
  });

  it("counts one and none the way a person would", () => {
    expect(takeLine({ durationS: 59.66, wpm: 115, heldPauses: 1 })).toBe(
      "60 seconds at 115 words a minute, with 1 held pause."
    );
    expect(takeLine({ durationS: 1, wpm: 80, heldPauses: 0 })).toBe(
      "1 second at 80 words a minute, with no held pauses."
    );
  });

  it("carries no dash", () => {
    expect(takeLine({ durationS: 60, wpm: 140, heldPauses: 2 })).not.toMatch(/[\u2014\u2013]/);
  });
});
