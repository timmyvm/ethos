import { describe, expect, it } from "vitest";
import type { Envelope } from "./envelope";
import { detectFillers, type Word } from "./metrics";
import {
  cutInFired,
  measureRound,
  numberInLastSentence,
  parseRoundField,
  validCutIn,
  type InterviewRound,
  type QaRound,
  type RoundInput,
  type RushRound,
} from "./round";

const r2 = (n: number) => Math.round(n * 100) / 100;
const W = (word: string, start: number, end: number): Word => ({ word: ` ${word}`, start, end });

/**
 * Unbroken speech from `from` to `to`: a word every 0.3s with 0.02s
 * between them (no gap reaches a beat), the last one ending at `to`.
 */
function talk(from: number, to: number, last = "word"): Word[] {
  const out: Word[] = [];
  let t = from;
  while (t + 0.58 < to) {
    out.push(W("word", r2(t), r2(t + 0.28)));
    t = r2(t + 0.3);
  }
  out.push(W(last, r2(t), r2(to)));
  return out;
}

function input(words: Word[], extra: Partial<RoundInput> = {}): RoundInput {
  return {
    game: "qa",
    level: 1,
    cutIns: [],
    stoppedBy: "you",
    words,
    fillers: detectFillers(words).fillers,
    durationS: words.length ? words[words.length - 1].end + 0.5 : 10,
    stars: 3,
    scorable: true,
    index: 640,
    ...extra,
  };
}

/** Q&A: speech to 19.9, Demos at 20.0, a silence of `gap`, then speech to `endAt`. */
function qaTake(gap: number, endAt = 40, extra: Partial<RoundInput> = {}): QaRound {
  const words = [...talk(0.5, 19.9), ...talk(r2(20 + gap), endAt)];
  return measureRound(
    input(words, { cutIns: [{ at: 20, line: "Says who?" }], ...extra })
  ) as QaRound;
}

describe("Q&A: the silence after the cut-in, at every threshold's edge (F2)", () => {
  it.each([
    [0.29, "through"],
    [0.3, "breath"],
    [0.79, "breath"],
    [0.8, "held"],
    [1.1, "held"],
    [3.5, "held"],
    [3.51, "long"],
  ] as const)("a %ss silence is %s", (gap, verdict) => {
    const round = qaTake(gap);
    expect(round.cutIns).toHaveLength(1);
    expect(round.cutIns[0].verdict).toBe(verdict);
    expect(round.cutIns[0].gap).toBe(gap);
  });

  it("measures from the cut-in, not from a silence you were already in", () => {
    // Quiet from 19.4; Demos at 20.0; you answer at 20.6: 0.6s after him.
    const words = [...talk(0.5, 19.4), ...talk(20.6, 40)];
    const round = measureRound(input(words, { cutIns: [{ at: 20, line: "So what?" }] })) as QaRound;
    expect(round.cutIns[0].gap).toBe(0.6);
    expect(round.cutIns[0].gapFrom).toBe(20);
    expect(round.cutIns[0].gapTo).toBe(20.6);
    expect(round.cutIns[0].verdict).toBe("breath");
  });

  it("calls a filler 1.2s from the silence's edge filled, and 1.21s held", () => {
    const at = (fillerStart: number) => {
      const words = [
        ...talk(0.5, 19.9),
        ...talk(21, r2(fillerStart - 0.02)),
        W("um", fillerStart, r2(fillerStart + 0.2)),
        ...talk(r2(fillerStart + 0.22), 40),
      ];
      return (measureRound(input(words, { cutIns: [{ at: 20, line: "So what?" }] })) as QaRound)
        .cutIns[0];
    };
    const filled = at(22.2);
    expect(filled.verdict).toBe("filled");
    expect(filled.fillerAt).toBe(22.2);
    expect(filled.fillerWord).toBe("um");
    expect(filled.cleanAfter).toBe(1.2);

    const held = at(22.21);
    expect(held.verdict).toBe("held");
    expect(held.fillerAt).toBeNull();
    expect(held.cleanAfter).toBe(1.21);
  });

  it("calls a silence the mic heard a sound in filled, with no word to name", () => {
    const rate = 20;
    const levels = Array.from({ length: 41 * rate }, (_, i) => {
      const t = i / rate;
      if (t < 2.5 || t > 40.4) return 0.02; // room tone, the floor
      if (t >= 20 && t < 21) return 0.6; // a sound in the gap
      return 0.8;
    });
    const envelope: Envelope = { levels, rate };
    const words = [...talk(2.5, 19.9), ...talk(21, 40)];
    const heard = (measureRound(
      input(words, { cutIns: [{ at: 20, line: "So what?" }], envelope })
    ) as QaRound).cutIns[0];
    expect(heard.verdict).toBe("filled");
    expect(heard.fillerWord).toBeNull();
    expect(heard.fillerAt).toBe(20);

    const quiet = levels.map((v, i) => (i / rate >= 20 && i / rate < 21 ? 0.02 : v));
    const silent = (measureRound(
      input(words, { cutIns: [{ at: 20, line: "So what?" }], envelope: { levels: quiet, rate } })
    ) as QaRound).cutIns[0];
    expect(silent.verdict).toBe("held");
  });

  it("is missed when Demos never got in, and the round does not count", () => {
    const round = measureRound(input(talk(0.5, 15))) as QaRound;
    expect(round.cutIns).toEqual([
      expect.objectContaining({ at: null, verdict: "missed", gap: null, spokeAfter: null }),
    ]);
    expect(round.counted).toBe(false);
    expect(round.best).toBeNull();
  });

  it("drops a cut-in past the end of the take, or in its last half second", () => {
    const words = talk(0.5, 30);
    const late = measureRound(
      input(words, { durationS: 30.5, cutIns: [{ at: 31, line: "So what?" }] })
    ) as QaRound;
    expect(late.cutIns[0].verdict).toBe("missed");
    const tail = measureRound(
      input(words, { durationS: 30.5, cutIns: [{ at: 30.1, line: "So what?" }] })
    ) as QaRound;
    expect(tail.cutIns[0].verdict).toBe("missed");
  });
});

describe("Q&A: when a round counts, and its best", () => {
  it("counts a held silence you kept talking after, with two stars", () => {
    const round = qaTake(1.1);
    expect(round.counted).toBe(true);
    expect(round.cutIns[0]).toMatchObject({
      at: 20,
      line: "Says who?",
      verdict: "held",
      spokeAfter: 20,
      cleanAfter: 18.9,
    });
    expect(round.best).toBe(18.9);
  });

  it("does not count when you stopped under 5s after him, and keeps the held best", () => {
    const short = qaTake(1, 24.9);
    expect(short.cutIns[0].spokeAfter).toBe(4.9);
    expect(short.counted).toBe(false);
    expect(short.best).toBe(3.9);
    expect(qaTake(1, 25).counted).toBe(true);
  });

  it("does not count under two stars, or on a take that cannot be scored", () => {
    expect(qaTake(1.1, 40, { stars: 1 }).counted).toBe(false);
    expect(qaTake(1.1, 40, { scorable: false }).counted).toBe(false);
    expect(qaTake(1.1, 40, { stars: 2 }).counted).toBe(true);
  });

  it("holds no best when the silence was not held", () => {
    expect(qaTake(0.5).best).toBeNull();
    expect(qaTake(4).best).toBeNull();
  });

  it("measures the quiet before your first word when he was forced in there", () => {
    // Level 2, silent until he is forced in at 10.0; the first word at 11.0.
    const words = talk(11, 40);
    const round = measureRound(
      input(words, { level: 2, cutIns: [{ at: 10, line: "Says who?" }] })
    ) as QaRound;
    expect(round.cutIns[0].verdict).toBe("held");
    expect(round.cutIns[0].gap).toBe(1);
    expect(round.cutIns[0].gapFrom).toBe(10);
    expect(round.cutIns[0].gapTo).toBe(11);
    expect(round.counted).toBe(true);
    // A first word inside the settle is talking as he lands: not a reply.
    const onTop = measureRound(
      input(talk(10.05, 40), { level: 2, cutIns: [{ at: 10, line: "Says who?" }] })
    ) as QaRound;
    expect(onTop.cutIns[0].verdict).toBe("through");
  });

  it("measures a stop at the cut-in as silence to the end, and never counts it", () => {
    const words = talk(0.5, 19.9);
    const round = measureRound(
      input(words, { durationS: 22, cutIns: [{ at: 20, line: "So what?" }] })
    ) as QaRound;
    expect(round.cutIns[0].gap).toBe(2);
    expect(round.cutIns[0].spokeAfter).toBe(0);
    expect(round.counted).toBe(false);
  });

  it("files a first cut-in at 0:21 or later at level 1", () => {
    const words = [...talk(0.5, 24.9), ...talk(26.2, 45)];
    const at = (level: number, cut: number) =>
      (measureRound(input(words, { level, cutIns: [{ at: cut, line: "So what?" }] })) as QaRound).level;
    expect(at(2, 25)).toBe(1);
    expect(at(3, 21)).toBe(1);
    expect(at(2, 20.9)).toBe(2);
    expect(at(2, 8)).toBe(2);
  });

  it("at level 3 needs both cut-ins held, and its best is the shorter run", () => {
    const words = [...talk(0.5, 7.9), ...talk(9, 34.9), ...talk(36.2, 60)];
    const both = measureRound(
      input(words, {
        level: 3,
        cutIns: [
          { at: 35, line: "Says who?" },
          { at: 8, line: "So what?" },
        ],
      })
    ) as QaRound;
    expect(both.level).toBe(3);
    expect(both.cutIns.map((c) => [c.at, c.verdict, c.gap])).toEqual([
      [8, "held", 1],
      [35, "held", 1.2],
    ]);
    expect(both.cutIns.map((c) => c.cleanAfter)).toEqual([51, 23.8]);
    expect(both.best).toBe(23.8);
    expect(both.counted).toBe(true);

    const once = measureRound(
      input(talk(0.5, 7.9).concat(talk(9, 30)), { level: 3, cutIns: [{ at: 8, line: "So what?" }] })
    ) as QaRound;
    expect(once.cutIns.map((c) => c.verdict)).toEqual(["held", "missed"]);
    expect(once.counted).toBe(false);
  });
});

describe("Speed rush: the last word against the clock (M1)", () => {
  const rush = (to: number, extra: Partial<RoundInput> = {}) =>
    measureRound(input(talk(0.5, to), { game: "rush", level: 2, ...extra })) as RushRound;

  it("is cut off at 29.8 of 30", () => {
    const round = rush(29.8, { durationS: 30, stoppedBy: "clock" });
    expect(round).toMatchObject({ cap: 30, lastWord: 29.8, spare: 0.2, landed: false, counted: false });
  });

  it("is too short at 9 of 30", () => {
    const round = rush(9, { durationS: 9.5 });
    expect(round).toMatchObject({ lastWord: 9, spare: 21, landed: false, counted: false });
  });

  it("lands at 27.4 of 30, with 2.6s to spare", () => {
    const round = rush(27.4, { durationS: 28, stars: 2 });
    expect(round).toMatchObject({ level: 2, spare: 2.6, landed: true, counted: true, best: null });
  });

  it("holds the edges: 0.5s inside the clock, and half of it", () => {
    expect(rush(29.5, { durationS: 29.6 }).landed).toBe(true);
    expect(rush(29.51, { durationS: 29.6 }).landed).toBe(false);
    expect(rush(15, { durationS: 15.5 }).landed).toBe(true);
    expect(rush(14.99, { durationS: 15.5 }).landed).toBe(false);
  });

  it("never lands when the clock stopped it, and infers the clock when the phone does not say", () => {
    expect(rush(27, { durationS: 28, stoppedBy: "clock" }).landed).toBe(false);
    expect(rush(29.8, { durationS: 30, stoppedBy: null }).stoppedBy).toBe("clock");
    expect(rush(25, { durationS: 26, stoppedBy: null }).stoppedBy).toBe("you");
  });

  it("does not count without two stars or a scorable take", () => {
    expect(rush(27.4, { durationS: 28, stars: 1 }).counted).toBe(false);
    expect(rush(27.4, { durationS: 28, scorable: false }).counted).toBe(false);
  });

  it("files a round that ran past its clock at the level whose clock it fits", () => {
    expect(rush(27, { level: 3, durationS: 28 }).level).toBe(2);
    expect(rush(20.5, { level: 3, durationS: 21 }).level).toBe(3);
    expect(rush(40, { level: 3, durationS: 41 }).level).toBe(1);
    expect(rush(50, { level: 2, durationS: 52 }).level).toBe(1);
  });
});

describe("Interview: the window and the number at the end (M1)", () => {
  const ending = [
    W("We", 70.1, 70.3),
    W("cut", 70.4, 70.6),
    W("costs", 70.7, 70.95),
    W("by", 71.0, 71.1),
    W("30", 71.15, 71.5),
    W("percent.", 71.55, 72),
  ];
  const take = (words: Word[], extra: Partial<RoundInput> = {}) =>
    measureRound(input(words, { game: "interview", level: 1, ...extra })) as InterviewRound;

  it("ends at 1:12 inside the window, on 30 percent", () => {
    const round = take([...talk(3.2, 70, "done."), ...ending], { stars: 2 });
    expect(round).toMatchObject({
      game: "interview",
      cap: 90,
      firstWord: 3.2,
      lastWord: 72,
      inWindow: true,
      numberAtEnd: "30 percent",
      cutIns: [],
      counted: true,
      best: 640,
    });
  });

  it("holds the window's edges: 60.0 and 89.5", () => {
    expect(take(talk(1, 60)).inWindow).toBe(true);
    expect(take(talk(1, 59.99)).inWindow).toBe(false);
    expect(take(talk(1, 89.5)).inWindow).toBe(true);
    expect(take(talk(1, 89.51)).inWindow).toBe(false);
    expect(take(talk(1, 48)).counted).toBe(false);
  });

  it("needs level 3's follow-up to have come before it counts", () => {
    const words = [...talk(1, 37.9), ...talk(39.1, 75)];
    const without = take(words, { level: 3 });
    expect(without.cutIns.map((c) => c.verdict)).toEqual(["missed"]);
    expect(without.counted).toBe(false);
    const withIt = take(words, { level: 3, cutIns: [{ at: 38, line: "Give me a number." }] });
    expect(withIt.cutIns[0]).toMatchObject({ at: 38, verdict: "held", gap: 1.1 });
    expect(withIt.counted).toBe(true);
  });

  it("keeps no best when the take cannot be scored", () => {
    expect(take(talk(1, 70), { scorable: false }).best).toBeNull();
    expect(take(talk(1, 70), { index: null }).best).toBeNull();
  });
});

describe("a number in the last sentence", () => {
  const say = (...sentences: string[]) => {
    let t = 0;
    return sentences.join(" ").split(" ").map((w) => {
      const word = W(w, t, t + 0.25);
      t = r2(t + 0.3);
      return word;
    });
  };

  it("reads digits and number words, with what carries them", () => {
    expect(numberInLastSentence(say("I led it.", "We grew sign-ups 40%."))).toBe("40%");
    expect(numberInLastSentence(say("It took twenty five people."))).toBe("twenty five");
    expect(numberInLastSentence(say("Done.", "We saved $40 a week."))).toBe("$40");
    expect(numberInLastSentence(say("Done.", "Costs fell by two per cent overall."))).toBe(
      "two per cent"
    );
    expect(numberInLastSentence(say("Done.", "Sales went up twenty-five percent."))).toBe(
      "twenty-five percent"
    );
  });

  it("is null when the last sentence has none, even if an earlier one did", () => {
    expect(numberInLastSentence(say("We hit 30 percent.", "It went well."))).toBeNull();
    expect(numberInLastSentence([])).toBeNull();
  });
});

describe("what the phone sends", () => {
  it("parses the round field and drops what is malformed", () => {
    const claim = parseRoundField(
      JSON.stringify({
        game: "qa",
        level: 2,
        cutIns: [{ at: 35.456, line: "  Says who?  " }, { at: "x" }, null, { at: 8, line: "So what?" }],
        stoppedBy: "clock",
      })
    );
    expect(claim).toEqual({
      game: "qa",
      level: 2,
      cutIns: [
        { at: 8, line: "So what?" },
        { at: 35.46, line: "Says who?" },
      ],
      stoppedBy: "clock",
    });
  });

  it("clamps the level and refuses anything that is not the shape", () => {
    expect(parseRoundField(JSON.stringify({ level: 9 }))?.level).toBe(3);
    expect(parseRoundField(JSON.stringify({ level: "two" }))?.level).toBe(1);
    expect(parseRoundField(JSON.stringify({ stoppedBy: "me" }))?.stoppedBy).toBeNull();
    expect(parseRoundField("{nope")).toBeNull();
    expect(parseRoundField("[1,2]")).toBeNull();
    expect(parseRoundField(null)).toBeNull();
    expect(parseRoundField("")).toBeNull();
    expect(
      parseRoundField(JSON.stringify({ cutIns: [{ at: 9, line: "x".repeat(200) }] }))?.cutIns[0].line
    ).toHaveLength(80);
  });

  it("says Demos cut in only for a cut-in the take could hear", () => {
    expect(validCutIn(1, 30)).toBe(true);
    expect(validCutIn(0.99, 30)).toBe(false);
    expect(validCutIn(29.5, 30)).toBe(true);
    expect(validCutIn(29.51, 30)).toBe(false);
    const claim = parseRoundField(JSON.stringify({ cutIns: [{ at: 15, line: "So what?" }] }));
    expect(cutInFired(claim, 60)).toBe(true);
    expect(cutInFired(claim, 15.2)).toBe(false);
    expect(cutInFired(null, 60)).toBe(false);
  });

  it("measures nothing for a game it does not know", () => {
    expect(measureRound(input(talk(1, 20), { game: "debate" }))).toBeNull();
  });
});
