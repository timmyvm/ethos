import { describe, expect, it } from "vitest";
import { LESSONS, FINAL_MOD, lessonById, lessonsForTrait } from "@/content/lessons";
import { TRAITS } from "@/content/traits";
import { TOPICS } from "./topics";
import { modById } from "./stress-mods";
import { resolveRepConfig } from "./rep-config";
import { lessonProgress, nextPractice, parsePracticeId, practiceLessonId } from "./lesson-progress";

describe("the lessons", () => {
  it("is fifteen, three per trait", () => {
    expect(LESSONS.length).toBe(15);
    for (const t of TRAITS) {
      expect([t.id, lessonsForTrait(t.id).length]).toEqual([t.id, 3]);
    }
  });

  it("takes every prompt from a topic that already existed", () => {
    for (const l of LESSONS) {
      for (const p of l.practices) {
        const topic = TOPICS.find((t) => t.id === p.topicId);
        expect([l.id, topic?.prompt]).toEqual([l.id, p.prompt]);
      }
    }
  });

  /*
   * The last practice is harder, and the thing that makes it harder is
   * FREE. A lesson whose final step needed a subscription would be
   * progress sold for money, which #14 rules out.
   */
  it("puts a mod on the last practice and nowhere else", () => {
    for (const l of LESSONS) {
      l.practices.forEach((p, i) => {
        const last = i === l.practices.length - 1;
        expect([l.id, i, Boolean(p.mods?.length)]).toEqual([l.id, i, last]);
      });
    }
  });

  it("never puts a premium mod on a lesson", () => {
    for (const l of LESSONS) {
      for (const p of l.practices) {
        for (const m of p.mods ?? []) {
          expect([l.id, m, modById(m)?.premium]).toEqual([l.id, m, false]);
        }
      }
    }
    expect(modById(FINAL_MOD)?.premium).toBe(false);
  });
});

describe("lesson progress", () => {
  it("round-trips a practice id", () => {
    expect(parsePracticeId(practiceLessonId("the-landing", 2))).toEqual({
      lessonId: "the-landing",
      practice: 2,
    });
  });

  it("ignores ids that are not lesson practices", () => {
    for (const id of [null, "f1", "topic:t3", "game:qa:qa3", "lesson:", "lesson:x:0"]) {
      expect([id, parsePracticeId(id)]).toEqual([id, null]);
    }
  });

  /* Doing practice 1 four times is one of three, not four of three. */
  it("counts distinct practices, not recordings", () => {
    const rows = [
      { lesson_id: "lesson:the-landing:1" },
      { lesson_id: "lesson:the-landing:1" },
      { lesson_id: "lesson:the-landing:2" },
      { lesson_id: "f1" },
    ];
    expect(lessonProgress(rows)["the-landing"]).toBe(2);
  });

  it("gives every lesson a number even with no history", () => {
    const p = lessonProgress([]);
    for (const l of LESSONS) expect([l.id, p[l.id]]).toEqual([l.id, 0]);
  });

  it("offers the first undone practice, then holds at the last", () => {
    const l = lessonById("the-landing")!;
    expect(nextPractice(l, 0)).toBe(1);
    expect(nextPractice(l, 2)).toBe(3);
    expect(nextPractice(l, 3)).toBe(3);
  });
});

describe("recording a lesson practice", () => {
  it("resolves the right prompt and files it under the lesson", () => {
    const l = lessonById("the-cold-open")!;
    const c = resolveRepConfig({ lesson: l.id, q: "2" });
    expect(c.prompt).toBe(l.practices[1].prompt);
    expect(c.lessonId).toBe("lesson:the-cold-open:2");
  });

  it("turns the final practice's mod on", () => {
    const c = resolveRepConfig({ lesson: "the-cold-open", q: "3" });
    expect(c.hidePrompt).toBe(true);
  });

  it("leaves the earlier practices alone", () => {
    expect(resolveRepConfig({ lesson: "the-cold-open", q: "1" }).hidePrompt).toBe(false);
  });

  it("clamps a practice number that is out of range", () => {
    expect(resolveRepConfig({ lesson: "the-cold-open", q: "9" }).lessonId).toBe(
      "lesson:the-cold-open:3"
    );
    expect(resolveRepConfig({ lesson: "the-cold-open", q: "0" }).lessonId).toBe(
      "lesson:the-cold-open:1"
    );
  });
});
