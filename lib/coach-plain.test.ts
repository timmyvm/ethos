import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { COACH_SCHEMA, COACH_SYSTEM } from "./coach";

/*
 * Demos's read in plain words (#484). Timothy, 16 Nov, bracketed two of
 * the coach's lines on a stored recording as failing the two-second test
 * (a first-time user, 16 to 28, reads it once and knows what it means
 * within two seconds): "7 mid-sentence pauses against 1 composed pause."
 * and "Kept: 0 fillers in 59 seconds. Nothing filled the gaps." Both are
 * the model's text, so the change is to the instructions for the read's
 * wording, Task A, and to nothing that judges a score.
 */
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const taskA = COACH_SYSTEM.slice(COACH_SYSTEM.indexOf("Task A,"), COACH_SYSTEM.indexOf("Task B,"));

describe("the read's instructions name the plain words (Task A)", () => {
  it("ask for plain words in every field a person reads as Demos's read", () => {
    expect(taskA).toContain("5. Plain words, in focus, strength and coachLine.");
    expect(taskA).toContain("has never studied speaking: each sentence must make sense on one read.");
    expect(taskA).toContain("Say what they did, with its number, in everyday words.");
  });

  it("name the app's own pause words as never to be written, and say the vocabulary is for judging", () => {
    expect(taskA).toContain("The pause vocabulary below is for judging.");
    expect(taskA).toContain('never write "composed", "held pause", "mid-sentence pause", "landed" or "landing"');
  });

  it("give Timothy's line its plain words, with the numbers kept", () => {
    expect(taskA).toContain('Write "You paused mid-sentence 7 times and after a finished sentence once.", not "7 mid-sentence pauses against 1 composed pause."');
  });

  it("ask for one idea said once, by the line that said it twice", () => {
    expect(taskA).toContain('Write "0 fillers in 59 seconds." and stop there, not "0 fillers in 59 seconds. Nothing filled the gaps.": one idea, said once.');
  });

  it("follow the copy rules they ask for: no dash", () => {
    expect(taskA).not.toMatch(/[—]| – /);
  });
});

describe("everything that judges a score is byte for byte as before (Task B)", () => {
  it("keeps Task B through the upgrade's last example identical to 1c4c312", () => {
    const fromB = COACH_SYSTEM.slice(COACH_SYSTEM.indexOf("Task B,"));
    expect(fromB.length).toBe(5514);
    expect(sha(fromB)).toBe("2a1cebf8ca11adad3a7f939bdada127b546c0089814ae5b88c33fbf304f68284");
  });

  it("keeps Task B through the pause vocabulary identical, as #429 pinned it", () => {
    const judged = COACH_SYSTEM.slice(COACH_SYSTEM.indexOf("Task B,"), COACH_SYSTEM.indexOf("\n\nThe upgrade (supply)"));
    expect(judged.length).toBe(1049);
    expect(sha(judged)).toBe("2f588023da612118e8ce05203e70340fc5470eacb378008680ebee3cedb09beb");
  });

  it("keeps the voice rules over Task A identical, and the schema", () => {
    expect(sha(COACH_SYSTEM.slice(0, COACH_SYSTEM.indexOf("Task A,")))).toBe(
      "4db57c0a8b0dfb02d360e4c8c96421e0b14f24b033910891d2614876cc115399"
    );
    expect(sha(JSON.stringify(COACH_SCHEMA))).toBe("2aee16ab27f4163e8741ee5ed0622df2ad52f82d5f6e2d2a7336e365c3aa61e4");
  });

  it("changes Task A by its fifth item alone", () => {
    const items = taskA.split("\n").filter((l) => /^\d\. /.test(l));
    expect(items.map((l) => l.slice(0, 3))).toEqual(["1. ", "2. ", "3. ", "4. ", "5. "]);
    expect(items.slice(0, 4)).toEqual([
      "1. focus: ONE thing for tomorrow. Exactly one. It must reference a metric.",
      "2. strength: ONE thing that measurably went well, traced to a metric or anchor. True praise is measurement, not flattery.",
      '3. supply: the one upgrade worth making to the speaker\'s own words, or none. The rules are under "The upgrade" below.',
      "4. coachLine: at most 2 sentences in the register above, grounded in the numbers.",
    ]);
  });
});
