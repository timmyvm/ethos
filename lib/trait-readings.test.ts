import { describe, expect, it } from "vitest";
import { NORMS } from "@/content/norms";
import { TRAITS } from "@/content/traits";
import { fmtRaw, nextLine, nextTrait, ordinal, withUnit, type TraitReading } from "./trait-readings";

const reading = (over: Partial<TraitReading> = {}): TraitReading => ({
  id: "pause",
  raw: 1.8,
  percentile: 40,
  fraction: 0.4,
  quality: "good",
  ...over,
});

describe("fmtRaw", () => {
  it("keeps one decimal under ten and drops it above", () => {
    expect(fmtRaw(1.83)).toBe("1.8");
    expect(fmtRaw(2)).toBe("2");
    expect(fmtRaw(155.4)).toBe("155");
  });
});

describe("withUnit", () => {
  /*
   * The bug this exists for: 0.997 restarts a minute prints as "1" and
   * then read "1 restarts a minute". The singular follows the DISPLAYED
   * value, not the raw one.
   */
  it("takes the singular from the printed value, not the raw one", () => {
    expect(withUnit("repairs", 0.997)).toBe("1 restart per hundred words");
    expect(withUnit("repairs", 1.4)).toBe("1.4 restarts per hundred words");
  });

  it("says what the fillers ring is actually drawn from", () => {
    expect(withUnit("fillers", 2.3)).toBe("2.3 um or uh per hundred words");
  });
});

describe("nextTrait", () => {
  /*
   * The one dishonest thing the whole model exists to avoid: sending
   * somebody to a lesson on the strength of a percentile the evidence
   * does not support (DECISIONS #257).
   */
  it("never chooses a trait whose scale is provisional", () => {
    const readings = [
      reading({ id: "pause", percentile: 4, quality: "provisional" }),
      reading({ id: "fillers", percentile: 61, quality: "good" }),
      reading({ id: "pace", percentile: 80, quality: "good" }),
    ];
    expect(nextTrait(readings)?.next.id).toBe("fillers");
  });

  it("chooses nothing at all rather than a provisional trait", () => {
    const readings = TRAITS.map((t, i) =>
      reading({ id: t.id, percentile: 10 + i, quality: "provisional" })
    );
    expect(nextTrait(readings)).toBeNull();
  });

  it("takes the lowest of the traits it is allowed to choose from", () => {
    const readings = [
      reading({ id: "fillers", percentile: 61 }),
      reading({ id: "pace", percentile: 22 }),
      reading({ id: "range", percentile: 90 }),
    ];
    expect(nextTrait(readings)?.next.id).toBe("pace");
  });
});

describe("a percentile never stands on its own", () => {
  /*
   * The hardest finding in docs/closure.md: a bare descriptive norm
   * made above-average households use MORE energy, and an injunctive
   * cue removed the effect. The people a naked position damages are
   * the ones already doing well, so the invariant has to hold at the
   * TOP of the scale, which is exactly where `move` gives up.
   */
  it("gives every non-provisional reading a line, at every percentile", () => {
    for (const t of TRAITS) {
      for (let p = 0; p <= 100; p++) {
        const line = nextLine(reading({ id: t.id, percentile: p, quality: "good", raw: 2 }));
        expect([t.id, p, typeof line === "string" && line.length > 0]).toEqual([t.id, p, true]);
      }
    }
  });

  it("says nothing where the card shows no percentile to qualify", () => {
    expect(nextLine(reading({ quality: "provisional" }))).toBeNull();
  });

  it("turns into a holding instruction at the top rather than going quiet", () => {
    const top = nextLine(reading({ id: "fillers", percentile: 99, quality: "good", raw: 0.2 }));
    expect(top).toMatch(/[Hh]olding/);
  });
});

describe("ordinal", () => {
  it("reads a percentile the way somebody would say it", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(62)).toBe("62nd");
  });
});

describe("every trait can print itself", () => {
  /*
   * A trait with a unit and no singular, or a `move` that throws on a
   * whole number, is a card that breaks on the one recording that hits
   * it. Cheaper to find here.
   */
  it.each(TRAITS.map((t) => [t.id, t] as const))("%s", (id, t) => {
    expect(withUnit(id, 1)).toContain("1 ");
    expect(withUnit(id, 4.2)).toContain("4.2 ");
    expect(t.move(1, true)).toMatch(/\S/);
    expect(t.move(3, false)).toMatch(/\S/);
    expect(NORMS[id]).toBeDefined();
  });
});
