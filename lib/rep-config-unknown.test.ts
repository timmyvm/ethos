import { describe, expect, it } from "vitest";
import { resolveRepConfig } from "@/lib/rep-config";
import { DRILLS } from "@/lib/drills";

describe("an unknown lesson id", () => {
  /*
   * /practice/[trait] has sent ?lesson=trait-pause since #258. It
   * matches no drill, and the resolver used to fall back to today's
   * rotation SILENTLY: the wrong prompt on screen, and the star filed
   * against whichever road lesson the rotation was on. Stars move unit
   * gates, so a lesson nobody did was opening doors.
   */
  it("never files a star against a real drill", () => {
    const c = resolveRepConfig({ lesson: "trait-pause" });
    expect(DRILLS.some((d) => d.id === c.lessonId)).toBe(false);
  });

  it("namespaces it so it is traceable to what was actually done", () => {
    expect(resolveRepConfig({ lesson: "trait-pause" }).lessonId).toBe("practice:trait-pause");
  });

  it("still resolves a real drill id to that drill", () => {
    expect(resolveRepConfig({ lesson: "f1" }).lessonId).toBe("f1");
  });

  it("still rotates when no lesson is named at all", () => {
    const c = resolveRepConfig({});
    expect(DRILLS.some((d) => d.id === c.lessonId)).toBe(true);
  });
});
