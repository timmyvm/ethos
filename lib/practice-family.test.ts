import { describe, expect, it } from "vitest";
import { practiceFamily } from "./practice-family";
import { repHref, repKey, resolveRepConfig } from "./rep-config";

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

  it("keeps the family of the card that was pressed when the practice names no trait", () => {
    const topic = resolveRepConfig({ topic: "t9" });
    expect(practiceFamily(topic)).toBe("sky");
    expect(practiceFamily(topic, "pause")).toBe("pause");
    expect(practiceFamily(topic, "range")).toBe("range");
    // The practice's own trait wins, and a hint that names no trait is ignored.
    expect(practiceFamily(resolveRepConfig({ lesson: "finish-it" }), "pause")).toBe("repairs");
    expect(practiceFamily(topic, "nope")).toBe("sky");
    expect(practiceFamily(topic, "constructor")).toBe("sky");
    // The boss is always the sky stage.
    expect(practiceFamily(resolveRepConfig({ boss: "1" }), "pause")).toBe("sky");
  });

  it("is carried on Today's Start as ?trait=, outside the take's key", () => {
    const href = repHref({ topic: "t9", trait: "pause" });
    expect(href).toBe("/rep?topic=t9&trait=pause");
    const u = new URL(href, "http://ethos.local");
    expect(repKey(u.searchParams)).toBe(repKey(new URL("/rep?topic=t9", "http://ethos.local").searchParams));
  });

  it("takes the sky stage where no one trait is practised", () => {
    expect(practiceFamily(resolveRepConfig({ boss: "1" }))).toBe("sky");
    expect(practiceFamily({ kind: "daily", lessonId: "practice:trait-nope" })).toBe("sky");
    expect(practiceFamily({ kind: "daily", lessonId: "game:hot-seat:3" })).toBe("sky");
  });
});
