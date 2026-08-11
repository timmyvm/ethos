import { describe, expect, it } from "vitest";
import {
  DEFAULT_POSE_ART,
  SHOP,
  canBuy,
  itemById,
  ownedFrom,
  poseArt,
  reasonFor,
} from "./shop";

const freeze = itemById("streak_freeze")!;
const pose = itemById("pose_speaking")!;

function spend(reason: string) {
  return { kind: "spent", reason };
}

describe("reasonFor", () => {
  it("matches the ledger guard in migration 0005", () => {
    for (const item of SHOP) {
      expect(reasonFor(item)).toMatch(/^shop:[a-z0-9_-]{1,40}$/);
    }
  });
});

describe("ownedFrom", () => {
  it("reads purchases off the ledger, ignoring earnings", () => {
    const owned = ownedFrom([
      { kind: "earned", reason: "streak_day" },
      spend("shop:pose_speaking"),
      spend("shop:streak_freeze"),
    ]);
    expect(owned.ids.has("pose_speaking")).toBe(true);
    expect(owned.ids.has("streak_day")).toBe(false);
    expect(owned.freezes).toBe(1);
  });

  it("counts repeat freeze buys but keeps the id once", () => {
    const owned = ownedFrom([
      spend("shop:streak_freeze"),
      spend("shop:streak_freeze"),
    ]);
    expect(owned.freezes).toBe(2);
    expect(owned.ids.size).toBe(1);
  });
});

describe("canBuy", () => {
  const none = ownedFrom([]);

  it("refuses a cosmetic you already own", () => {
    const owned = ownedFrom([spend("shop:pose_speaking")]);
    expect(canBuy(pose, 999, owned, 0, 2)).toEqual({
      ok: false,
      reason: "Owned",
    });
  });

  it("lets a freeze be bought again", () => {
    const owned = ownedFrom([spend("shop:streak_freeze")]);
    expect(canBuy(freeze, 99, owned, 0, 2).ok).toBe(true);
  });

  it("refuses a freeze that would evaporate at the cap", () => {
    expect(canBuy(freeze, 99, none, 2, 2).ok).toBe(false);
  });

  it("says how far off the price is, rather than just no", () => {
    expect(canBuy(freeze, 9, none, 0, 2).reason).toBe("5 more to go");
  });

  it("checks ownership before the balance", () => {
    // Owning it is the truer reason than being broke.
    const owned = ownedFrom([spend("shop:pose_speaking")]);
    expect(canBuy(pose, 0, owned, 0, 2).reason).toBe("Owned");
  });
});

describe("poseArt", () => {
  const owned = ownedFrom([spend("shop:pose_workout")]);

  it("falls back to the default when nothing is equipped", () => {
    expect(poseArt(null, owned)).toBe(DEFAULT_POSE_ART);
  });

  it("draws an equipped pose that was actually bought", () => {
    expect(poseArt("pose_workout", owned)).toBe("/demos-workout.webp");
  });

  it("refuses a pose the ledger doesn't prove", () => {
    // prefs live in localStorage, so the id is user-editable.
    expect(poseArt("pose_celebrate", owned)).toBe(DEFAULT_POSE_ART);
  });
});

describe("the shop's non-negotiable", () => {
  it("sells nothing that buys a number", () => {
    // Money never buys stars, streaks, or scores — and neither do coins.
    for (const item of SHOP) {
      expect(["utility", "cosmetic"]).toContain(item.kind);
      expect(item.honest.length).toBeGreaterThan(0);
    }
    // The one utility is the freeze, which protects a streak but can
    // never grow one.
    expect(SHOP.filter((i) => i.kind === "utility").map((i) => i.id)).toEqual([
      "streak_freeze",
    ]);
  });
});
