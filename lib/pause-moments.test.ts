import { describe, expect, it } from "vitest";
import { detectPauses, type Pause, type Word } from "./metrics";
import {
  filledMoments,
  judgePauses,
  MOMENT_LEAD_S,
  MOMENT_TAIL_S,
  type JudgedPause,
  type PauseVerdict,
} from "./pause-quality";

/**
 * The Pause row's moments (DECISIONS #424): the pauses a take judged
 * filled, named by their timestamps so a lower Pause score traces to
 * moments you can hear back. Read off stored verdicts only (#422).
 */

/** A stored pause: where, how long, and the verdict the take gave it. */
function stored(t: number, verdict: PauseVerdict | undefined, len = 1.1): Pause & { verdict?: PauseVerdict } {
  return verdict ? { t, len, kind: "pre", verdict } : { t, len, kind: "pre" };
}

describe("the moments a take's filled pauses are heard at", () => {
  it("names nothing when no pause was filled, so the row reads as it did", () => {
    expect(filledMoments([])).toBeNull();
    expect(filledMoments(null)).toBeNull();
    expect(filledMoments(undefined)).toBeNull();
    expect(
      filledMoments([stored(2.1, "opening"), stored(20, "hesitation"), stored(41, "landing"), stored(50, "dead"), stored(55, "beat")])
    ).toBeNull();
  });

  it("names one moment in the singular", () => {
    const m = filledMoments([stored(2.1, "opening"), stored(15.3, "filled")]);
    expect(m?.sentence).toBe("0:15 had a sound in it.");
    expect(m?.moments.map((x) => x.clock)).toEqual(["0:15"]);
  });

  it("names two with 'and'", () => {
    const m = filledMoments([stored(15.3, "filled"), stored(20, "landing"), stored(40.2, "filled")]);
    expect(m?.sentence).toBe("0:15 and 0:40 had a sound in them.");
  });

  it("names three as a list", () => {
    const m = filledMoments([stored(15.3, "filled"), stored(40.2, "filled"), stored(62.5, "filled")]);
    expect(m?.sentence).toBe("0:15, 0:40 and 1:02 had a sound in them.");
  });

  it("names the first three of five and counts the rest", () => {
    const m = filledMoments([10, 20, 30, 40, 50].map((t) => stored(t, "filled")));
    expect(m?.sentence).toBe("0:10, 0:20, 0:30 and 2 more had a sound in them.");
    // Every one is still there to hear; the sentence names three.
    expect(m?.moments).toHaveLength(5);
    expect(m?.parts.filter((p) => p.kind === "moment")).toHaveLength(3);
    // "and 2 more" holds together on a narrow phone.
    expect(m?.parts).toContainEqual({ kind: "text", text: "and 2 more", keep: true });
  });

  it("says one more in the singular count", () => {
    const m = filledMoments([10, 20, 30, 40].map((t) => stored(t, "filled")));
    expect(m?.sentence).toBe("0:10, 0:20, 0:30 and 1 more had a sound in them.");
  });

  it("puts them in the order they were said, whatever order they arrive in", () => {
    const m = filledMoments([stored(62.5, "filled"), stored(15.3, "filled"), stored(30, "landing"), stored(40.2, "filled")]);
    expect(m?.sentence).toBe("0:15, 0:40 and 1:02 had a sound in them.");
    expect(m?.moments.map((x) => x.t)).toEqual([15.3, 40.2, 62.5]);
  });

  it("names a filled pause at the very start as 0:00 and plays it from 0", () => {
    const m = filledMoments([stored(0, "filled", 1.2)]);
    expect(m?.sentence).toBe("0:00 had a sound in it.");
    expect(m?.moments[0].from).toBe(0);
    expect(m?.moments[0].until).toBeCloseTo(0 + 1.2 + MOMENT_TAIL_S, 6);
  });

  it("plays from a second before the pause to a second after it ends", () => {
    const [moment] = filledMoments([stored(15.3, "filled", 1.4)])!.moments;
    expect(moment.from).toBeCloseTo(15.3 - MOMENT_LEAD_S, 6);
    expect(moment.until).toBeCloseTo(15.3 + 1.4 + MOMENT_TAIL_S, 6);
  });

  it("names each chip by its visible text, then what it does", () => {
    const [moment] = filledMoments([stored(15.3, "filled")])!.moments;
    expect(moment.label).toBe("Play 0:15, a pause with a sound in it");
    expect(moment.label.startsWith(`Play ${moment.clock}`)).toBe(true);
  });

  it("gives nothing for a row stored before pauses had verdicts", () => {
    expect(filledMoments([stored(15.3, undefined), stored(40.2, undefined), { t: 50, len: 0.4, kind: "beat" }])).toBeNull();
  });

  it("reads the verdicts and leaves the stored pauses as they are", () => {
    const pauses = [stored(40.2, "filled"), stored(15.3, "filled")];
    const before = JSON.stringify(pauses);
    filledMoments(pauses);
    expect(JSON.stringify(pauses)).toBe(before);
  });
});

/**
 * Both ways a pause is judged filled reach the row: a filler leaning on
 * the silence, and a sound the mic heard in it that the transcript lost.
 * The moment's clock is the one the pause's own note was written with.
 */
describe("both kinds of filled pause", () => {
  /** Two sentences with a held 1.4s gap between them, the second starting near 4.9s. */
  function take(): { words: Word[]; durationS: number } {
    const words: Word[] = [];
    let t = 0;
    const say = (s: string) => {
      for (const raw of s.split(" ")) {
        words.push({ word: ` ${raw}`, start: t, end: t + 0.35 });
        t += 0.4;
      }
    };
    say("I think the honest answer here is simpler than it looks.");
    t += 1.4;
    say("Most teams already know what the problem actually is.");
    return { words, durationS: Math.round(t * 100) / 100 };
  }

  function judged(opts: { filler?: boolean; heard?: boolean }): JudgedPause[] {
    const { words, durationS } = take();
    const pauses = detectPauses(words);
    const gap = pauses.find((p) => p.kind !== "beat")!;
    const rate = 20;
    const levels = new Array(Math.ceil(durationS * rate) + 40).fill(0.5);
    for (let i = levels.length - 40; i < levels.length; i++) levels[i] = 0.02;
    for (let i = Math.round(gap.t * rate); i < Math.round((gap.t + gap.len) * rate); i++) {
      levels[i] = opts.heard ? 0.3 : 0.02;
    }
    return judgePauses({
      pauses,
      words,
      fillers: opts.filler ? [{ word: "um", t: gap.t + gap.len + 0.2 }] : [],
      durationS,
      envelope: { levels, rate },
    });
  }

  it("names a pause with a filler leaning on it", () => {
    const pauses = judged({ filler: true });
    const filled = pauses.find((p) => p.verdict === "filled")!;
    expect(filled.note).toContain("filler leaning on it");
    const m = filledMoments(pauses)!;
    expect(m.moments).toHaveLength(1);
    expect(filled.note.startsWith(`${m.moments[0].clock} · `)).toBe(true);
  });

  it("names a pause the mic heard a sound in", () => {
    const pauses = judged({ heard: true });
    const filled = pauses.find((p) => p.verdict === "filled")!;
    expect(filled.note).toContain("the transcript didn't");
    const m = filledMoments(pauses)!;
    expect(m.sentence).toBe(`${m.moments[0].clock} had a sound in it.`);
    expect(filled.note.startsWith(`${m.moments[0].clock} · `)).toBe(true);
  });

  it("names nothing for the same take left clean", () => {
    expect(filledMoments(judged({}))).toBeNull();
  });
});
