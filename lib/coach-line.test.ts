import { describe, expect, it } from "vitest";
import { computedLine, scoreLine, sentences, withoutTomorrow } from "@/lib/coach-line";

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
});
