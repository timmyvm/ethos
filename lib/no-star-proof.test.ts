import { describe, expect, it } from "vitest";
import { isScorable, starsFor, substance } from "./metrics";
import { coachSwap, proofIn, usesOf, type TakeText, type TimedWord } from "./say";
import { glanceCues, proofLeads, topMoment, withProof } from "./sound-recipes";
import { xpForTake } from "./xp";

/*
 * #510 with #509 (the final pass of 19 Nov): a take with no star that says
 * a saved swap's better phrase. By the product's rules, feedback traces
 * to a timestamp and stars and XP are earned. A take with no star is a
 * take that was not scored (`starsFor`: 0 exactly when `isScorable` says
 * no, so it has no Ethos number), and it won nothing: it pays no XP
 * (#510), plays no sound and Demos does not cheer (#505), and the glance
 * proves only on a scored take with its number (#509). Say it better's
 * count follows the same rule (the #507 review's "only a stored take with
 * an Ethos number"), so the take is no use and never marks the swap heard
 * ahead of the scored take that earns the token.
 */

const SAVED = "2026-11-15T08:00:00.000Z";
const pair = coachSwap({ id: "p1", original: "the thing is", upgrade: "the point is", created_at: SAVED, rep_id: "src" });
const timed = (text: string): TimedWord[] => text.split(" ").map((word, i) => ({ word, start: i * 0.4, end: i * 0.4 + 0.3 }));

/** Twelve words, three different: under the 20-word floor, and repetitive. */
const SHORT = "the point is the point is the point is um um um";
/** A real answer that says it at 0:00. */
const REAL = `the point is ${Array.from({ length: 26 }, (_, i) => `word${i}`).join(" ")}`;

describe("a take with no star that says the better phrase (#510 with #509)", () => {
  it("has no star exactly when it was not scored, so it has no Ethos number", () => {
    const short = substance(SHORT);
    expect(isScorable(short)).toBe(false);
    expect(starsFor({ slips: 0, durationS: 8, substance: short })).toBe(0);
    const real = substance(REAL);
    expect(isScorable(real)).toBe(true);
    expect(starsFor({ slips: 0, durationS: 30, substance: real })).toBeGreaterThan(0);
  });

  it("pays no XP, plays nothing and Demos does not cheer, the proof or no proof", () => {
    expect(xpForTake(0)).toBe(0);
    expect(xpForTake(0, 2)).toBe(0);
    const win = withProof({ stars: 0 }, true, true);
    expect(glanceCues(win, { landAfter: 400, starStep: 300, starMs: 600, reduced: false })).toEqual([]);
    expect(topMoment(win)).toBeNull();
    expect(proofLeads(win)).toBe(false);
  });

  it("is no use in Say it better's count, and a scored take that says it is", () => {
    const takes: TakeText[] = [
      { id: "nostar", created_at: "2026-11-16T08:00:00.000Z", transcript: SHORT, ethos_index: null, words: timed(SHORT) },
    ];
    expect(usesOf(pair, takes)).toEqual([]);
    const scored: TakeText = { id: "scored", created_at: "2026-11-17T08:00:00.000Z", transcript: REAL, ethos_index: 640, words: timed(REAL) };
    expect(usesOf(pair, [...takes, scored]).map((u) => u.repId)).toEqual(["scored"]);
    // A take whose number was not read (the proved take's own view) still counts.
    expect(usesOf(pair, [{ ...scored, ethos_index: undefined }]).map((u) => u.repId)).toEqual(["scored"]);
  });

  it("still holds the moment, so the first scored take to say it gets the token", () => {
    // The glance asks proofIn only of a scored take with its number
    // (app/rep/page.tsx); the swap was never marked heard by the no-star
    // take, so the scored one proves it, with where it was said.
    const proof = proofIn([pair], {}, { id: "scored", transcript: REAL, words: timed(REAL), startedAt: new Date("2026-11-17T07:59:00.000Z") });
    expect(proof).toMatchObject({ better: "the point is", at: 0 });
  });
});
