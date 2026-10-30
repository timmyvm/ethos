import { describe, expect, it } from "vitest";
import { practiceFamily } from "./practice-family";
import { resolveRepConfig } from "./rep-config";

describe("practiceFamily (D50)", () => {
  it("wears a lesson's trait", () => {
    expect(practiceFamily(resolveRepConfig({ lesson: "the-landing" }))).toBe("pause");
    expect(practiceFamily(resolveRepConfig({ lesson: "the-cold-open", q: "2" }))).toBe("fillers");
    expect(practiceFamily(resolveRepConfig({ lesson: "finish-it" }))).toBe("repairs");
  });

  it("wears a trait walk's trait", () => {
    expect(practiceFamily(resolveRepConfig({ lesson: "trait-pace" }))).toBe("pace");
    expect(practiceFamily({ kind: "daily", lessonId: "practice:trait-range" })).toBe("range");
  });

  it("takes the sky stage where no one trait is practised", () => {
    expect(practiceFamily(resolveRepConfig({ boss: "1" }))).toBe("sky");
    expect(practiceFamily({ kind: "daily", lessonId: "practice:trait-nope" })).toBe("sky");
    expect(practiceFamily({ kind: "daily", lessonId: "game:hot-seat:3" })).toBe("sky");
  });
});
