import { existsSync, readFileSync } from "node:fs";
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

/** A purchase as spend_coins writes it: the reason, at the catalog's price. */
function spend(reason: string, amount = itemById(reason.slice(5))?.price ?? 1) {
  return { kind: "spent", reason, amount };
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
      { kind: "earned", reason: "streak_day", amount: 1 },
      spend("shop:pose_speaking"),
      spend("shop:streak_freeze"),
    ]);
    expect(owned.ids.has("pose_speaking")).toBe(true);
    expect(owned.ids.has("streak_day")).toBe(false);
    expect(owned.freezes).toBe(1);
  });

  it("proves nothing with a spend below the price", () => {
    // Before 0015, spend_coins took the caller's amount: a direct call
    // bought a freeze for one coin. Those rows may be in the ledger, and
    // they must never count as a purchase.
    const owned = ownedFrom([
      spend("shop:streak_freeze", 1),
      spend("shop:pose_celebrate", 11),
    ]);
    expect(owned.freezes).toBe(0);
    expect(owned.ids.size).toBe(0);
    expect(poseArt("pose_celebrate", owned)).toBe(DEFAULT_POSE_ART);
  });

  it("counts a spend at the catalog's price", () => {
    const owned = ownedFrom([spend("shop:streak_freeze", 14), spend("shop:pose_celebrate", 12)]);
    expect(owned.freezes).toBe(1);
    expect([...owned.ids].sort()).toEqual(["pose_celebrate", "streak_freeze"]);
  });

  it("ignores a spend on an item the shop doesn't sell", () => {
    expect(ownedFrom([spend("shop:gold_mic", 999)]).ids.size).toBe(0);
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
    expect(canBuy(freeze, 99, none, 2, 2)).toEqual({ ok: false, reason: "2 of 2 held" });
  });

  it("says how far off the price is, rather than just no", () => {
    expect(canBuy(freeze, 9, none, 0, 2).reason).toBe("5 more coins");
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
    expect(poseArt("pose_workout", owned)).toBe("/demos-practice.webp");
  });

  it("refuses a pose the ledger doesn't prove", () => {
    // prefs live in localStorage, so the id is user-editable.
    expect(poseArt("pose_celebrate", owned)).toBe(DEFAULT_POSE_ART);
  });
});

describe("the shop's non-negotiable", () => {
  it("sells nothing that buys a number", () => {
    // Money never buys stars, streaks, or scores, and neither do coins.
    // (#163 removed the printed disclaimers; the MECHANIC stays tested.)
    for (const item of SHOP) {
      expect(["utility", "cosmetic"]).toContain(item.kind);
    }
    // The one utility is the freeze, which protects a streak but can
    // never grow one.
    expect(SHOP.filter((i) => i.kind === "utility").map((i) => i.id)).toEqual([
      "streak_freeze",
    ]);
  });
});

/**
 * The server's copy of the catalog (migration 0015). spend_coins charges
 * the price in shop_prices and refuses any other amount, so the shop's
 * button and the database have to agree item for item, price for price,
 * or a purchase the shop offers is refused.
 */
describe("the server's catalog", () => {
  const PATH = "supabase/migrations/0015_shop_prices.sql";
  const sql = existsSync(PATH) ? readFileSync(PATH, "utf8") : "";
  const code = sql.replace(/--.*$/gm, "");

  it("seeds shop_prices with exactly lib/shop.ts's items and prices", () => {
    const seed = code.match(/insert into public\.shop_prices[^;]*values([^;]*?)on conflict/i)?.[1] ?? "";
    const rows = [...seed.matchAll(/\(\s*'([^']+)'\s*,\s*(\d+)\s*\)/g)].map((m) => [m[1], Number(m[2])]);
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.fromEntries(rows)).toEqual(
      Object.fromEntries(SHOP.map((item) => [reasonFor(item), item.price]))
    );
    expect(rows).toHaveLength(SHOP.length);
  });

  it("charges the catalog's price and refuses an unknown item or any other amount", () => {
    const body = code.match(/create or replace function public\.spend_coins\([\s\S]*?\$\$;/i)?.[0] ?? "";
    expect(body).toMatch(/security definer/i);
    expect(body).toMatch(/set search_path = ''/i);
    expect(body).toMatch(/from public\.shop_prices/i);
    expect(body).toMatch(/'unknown item'/);
    expect(body).toMatch(/p_amount is distinct from v_price/i);
    // The row written carries the catalog's price, never the caller's.
    expect(body).toMatch(/values \(uid, 'spent', v_price, p_reason\)/i);
    expect(body).not.toMatch(/values \([^)]*p_amount/i);
  });

  it("lets a signed-in session spend, anonymous-first ones included, and never the anon key", () => {
    expect(code).toMatch(/revoke all on function public\.spend_coins\(text, integer\) from public, anon;/i);
    expect(code).toMatch(/grant execute on function public\.spend_coins\(text, integer\) to authenticated;/i);
  });

  it("keeps purchased_freezes to the reader's own rows, and away from the anon key", () => {
    expect(code).toMatch(/alter view public\.purchased_freezes set \(security_invoker = true\);/i);
    expect(code).toMatch(/revoke select on public\.purchased_freezes from anon;/i);
  });

  it("holds no drop statement, which the production connector stalls on", () => {
    expect(sql.length).toBeGreaterThan(0);
    expect(sql).not.toMatch(/\bdrop\b/i);
  });
});
