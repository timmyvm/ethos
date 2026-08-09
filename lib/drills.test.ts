import { describe, expect, it } from "vitest";
import { DRILLS, todaysDrill } from "./drills";

describe("todaysDrill", () => {
  it("serves the baseline rep on day zero", () => {
    expect(todaysDrill(new Date(2026, 7, 9, 14, 30)).id).toBe("f1");
  });

  it("rotates one drill per day", () => {
    expect(todaysDrill(new Date(2026, 7, 10)).id).toBe("f2");
    expect(todaysDrill(new Date(2026, 7, 15)).id).toBe("h2");
  });

  it("wraps around after the full rotation", () => {
    expect(todaysDrill(new Date(2026, 7, 9 + DRILLS.length)).id).toBe("f1");
  });

  it("does not change within the same day", () => {
    expect(todaysDrill(new Date(2026, 7, 11, 0, 1)).id).toBe(
      todaysDrill(new Date(2026, 7, 11, 23, 59)).id
    );
  });

  it("clamps dates before the epoch to the baseline", () => {
    expect(todaysDrill(new Date(2026, 7, 1)).id).toBe("f1");
  });
});
