import { describe, expect, it } from "vitest";
import { NORMS } from "@/content/norms";
import { TRAITS } from "@/content/traits";
import { percentile } from "./percentile";

/**
 * The gate (#256). A percentile is a claim about the whole population,
 * so this file refuses to let one ship without something behind it.
 *
 * The failure this prevents is specific and it is the worst one
 * available: a distribution that was made up, shipped, and then looked
 * exactly like a working feature on a phone.
 */
describe("the norms", () => {
  it("has one for every trait", () => {
    for (const t of TRAITS) expect(NORMS[t.id]).toBeDefined();
  });

  /**
   * The hard gate. A norm carrying placeholder numbers is a norm whose
   * percentiles are invented, and this stays red until every one of
   * them has been replaced from docs/percentiles.md.
   */
  it("has no placeholder distributions left in it", () => {
    const pending = Object.entries(NORMS)
      .filter(([, n]) => n.pending)
      .map(([id]) => id);
    expect(pending).toEqual([]);
  });

  it("never claims evidence it does not have", () => {
    for (const [id, n] of Object.entries(NORMS)) {
      if (n.quality === "provisional") continue;
      expect([id, n.sources.length > 0]).toEqual([id, true]);
      // Sources are citations with a link, not a name from memory.
      for (const s of n.sources) {
        expect([id, /https?:\/\/|doi/i.test(s)]).toEqual([id, true]);
      }
    }
  });

  it("writes down every assumption, including for a provisional one", () => {
    for (const [id, n] of Object.entries(NORMS)) {
      expect([id, n.assumptions.length > 0]).toEqual([id, true]);
    }
  });

  it("needs a band when it says it is banded, and not otherwise", () => {
    for (const [id, n] of Object.entries(NORMS)) {
      expect([id, n.direction === "band"]).toEqual([id, n.band !== undefined]);
      if (n.band) expect([id, n.band.lo < n.band.hi]).toEqual([id, true]);
    }
  });

  /* A distribution that puts nobody in the middle is a distribution
     fitted wrong, and it is invisible until somebody scores 98th on
     their first recording. */
  it("puts its own centre near the middle of the scale", () => {
    for (const [id, n] of Object.entries(NORMS)) {
      const centre =
        n.direction === "band"
          ? (n.band!.lo + n.band!.hi) / 2
          : n.shape === "lognormal"
            ? Math.exp(n.mu)
            : n.mu;
      const p = percentile(centre, n);
      const floor = n.direction === "band" ? 60 : 40;
      expect([id, p >= floor && p <= 100]).toEqual([id, true]);
    }
  });
});
