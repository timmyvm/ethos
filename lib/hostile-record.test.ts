import { describe, expect, it } from "vitest";
import { hostileRecordOf, hostileVerdictOf, type HostileRecord } from "./hostile";
import { HostileVerdictSchema } from "./hostile-server";
import { z } from "./zod";

/*
 * The stored verdict is read in the browser by a plain guard since #508
 * (zod left the browser's bundle). It must answer exactly what the schema
 * it replaced answered, so the old schema is rebuilt here from the
 * server's verdict schema and the two are held side by side over the
 * shapes a `reps.round` can hold.
 */
const OldRecordSchema = z.object({
  v: z.literal(1),
  game: z.literal("hostile"),
  claimId: z.string(),
  verdict: HostileVerdictSchema,
  questions: z.array(z.object({ question: z.string(), quoted: z.string() })),
});
const old = (round: unknown): HostileRecord | null => {
  const parsed = OldRecordSchema.safeParse(round);
  return parsed.success ? (parsed.data as HostileRecord) : null;
};

const dim = (o: Record<string, unknown> = {}) => ({
  score: 60,
  citedMoment: 'You said "teams lose it".',
  improve: "Name one team.",
  ...o,
});
const record = (o: Record<string, unknown> = {}, v: Record<string, unknown> = {}) => ({
  v: 1,
  game: "hostile",
  claimId: "remote-work",
  verdict: { held: dim(), answered: dim(), composed: dim(), coachLine: "You held it.", ...v },
  questions: [{ question: "Which team?", quoted: "teams lose it" }],
  ...o,
});

const cases: [string, unknown][] = [
  ["a whole record", record()],
  ["no questions", record({ questions: [] })],
  ["extra keys everywhere", { ...record({ extra: 1 }, { overall: 99 }), questions: [{ question: "q", quoted: "", why: 1 }] }],
  ["an extra key on a dimension", record({}, { held: dim({ note: "x" }) })],
  ["null", null],
  ["undefined", undefined],
  ["a string", "hostile"],
  ["an array", [record()]],
  ["a game round", { v: 1, game: "qa", level: 2 }],
  ["version 2", record({ v: 2 })],
  ["the version as a string", record({ v: "1" })],
  ["no claim", record({ claimId: undefined })],
  ["a numeric claim", record({ claimId: 4 })],
  ["questions not a list", record({ questions: {} })],
  ["a question without its quote", record({ questions: [{ question: "Which?" }] })],
  ["a question that is a string", record({ questions: ["Which?"] })],
  ["no verdict", record({ verdict: undefined })],
  ["a verdict that is a list", record({ verdict: [] })],
  ["a dimension missing", record({}, { composed: undefined })],
  ["a dimension as a number", record({}, { held: 1 })],
  ["score 0", record({}, { held: dim({ score: 0 }) })],
  ["score 100", record({}, { held: dim({ score: 100 }) })],
  ["score 101", record({}, { held: dim({ score: 101 }) })],
  ["score -1", record({}, { held: dim({ score: -1 }) })],
  ["score 55.5", record({}, { held: dim({ score: 55.5 }) })],
  ["score as a string", record({}, { held: dim({ score: "60" }) })],
  ["score NaN", record({}, { held: dim({ score: NaN }) })],
  ["score Infinity", record({}, { held: dim({ score: Infinity }) })],
  ["a 3 character citation", record({}, { held: dim({ citedMoment: '"a"' }) })],
  ["a 4 character citation", record({}, { held: dim({ citedMoment: '"ab"' }) })],
  ["a 240 character citation", record({}, { held: dim({ citedMoment: "a".repeat(240) }) })],
  ["a 241 character citation", record({}, { held: dim({ citedMoment: "a".repeat(241) }) })],
  ["a 200 character improve", record({}, { answered: dim({ improve: "b".repeat(200) }) })],
  ["a 201 character improve", record({}, { answered: dim({ improve: "b".repeat(201) }) })],
  ["a 3 character improve", record({}, { answered: dim({ improve: "abc" }) })],
  ["a 240 character coach line", record({}, { coachLine: "c".repeat(240) })],
  ["a 241 character coach line", record({}, { coachLine: "c".repeat(241) })],
  ["a 3 character coach line", record({}, { coachLine: "Yes" })],
  ["no coach line", record({}, { coachLine: undefined })],
  ["an emoji at the bound", record({}, { coachLine: "😀".repeat(120) })],
];

describe("the stored verdict's guard answers as its schema did", () => {
  for (const [name, round] of cases) {
    it(name, () => {
      expect(hostileRecordOf(round)).toEqual(old(round));
    });
  }

  it("returns only the record's own fields, never a stranger's", () => {
    const got = hostileRecordOf(cases[2][1])!;
    expect(Object.keys(got).sort()).toEqual(["claimId", "game", "questions", "v", "verdict"]);
    expect(Object.keys(got.verdict).sort()).toEqual(["answered", "coachLine", "composed", "held"]);
    expect(Object.keys(got.verdict.held).sort()).toEqual(["citedMoment", "improve", "score"]);
    expect(got.questions).toEqual([{ question: "q", quoted: "" }]);
  });

  it("reads a verdict on its own the same way the server's schema does", () => {
    for (const [, round] of cases) {
      const v = (round as { verdict?: unknown } | null)?.verdict;
      const parsed = HostileVerdictSchema.safeParse(v);
      expect(hostileVerdictOf(v)).toEqual(parsed.success ? parsed.data : null);
    }
  });
});
