/**
 * The shop (DECISIONS #90 reopened on Timothy's call, 11 Aug).
 *
 * It was deferred because the obvious sinks — freezes, early boss
 * access, score retries — mostly competed with Pro. Everything is free
 * right now (`entitlement.ts`), so that objection is moot, and coins
 * have been accruing with nothing to spend them on, which was always
 * the temporary state rather than the design.
 *
 * The non-negotiable holds and shapes the whole list: **money never buys
 * stars, streaks, or scores.** Coins aren't money — they're earned by
 * speaking, one per day — but the rule behind it still applies. Nothing
 * here buys a number. Freezes buy *convenience* (a day you protected,
 * which is why a frozen day still doesn't count toward the streak), and
 * poses buy *nothing at all*, which is what makes them the safest thing
 * in the shop.
 *
 * Prices anchor to #78: one coin a day, so 14 = about two weeks of
 * practice. That was fixed before the shop existed precisely so the
 * first item couldn't be trivially affordable on day one.
 */

export type ShopKind = "utility" | "cosmetic";

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  kind: ShopKind;
  blurb: string;
}

/** Ledger reason for a purchase. Matches the `^shop:[a-z0-9_-]+$` guard. */
export function reasonFor(item: ShopItem): string {
  return `shop:${item.id}`;
}

export const SHOP: ShopItem[] = [
  {
    id: "streak_freeze",
    name: "Streak freeze",
    price: 14,
    kind: "utility",
    blurb:
      "Covers one missed day automatically. Two is the most you can hold.",
  },
  {
    id: "pose_speaking",
    name: "Demos, mid-sentence",
    price: 8,
    kind: "cosmetic",
    blurb: "Swaps the Demos on your floor card for the speaking pose.",
  },
  {
    id: "pose_workout",
    name: "Demos, in training",
    price: 8,
    kind: "cosmetic",
    blurb: "The gym pose, for the floor card.",
  },
  {
    id: "pose_celebrate",
    name: "Demos, celebrating",
    price: 12,
    kind: "cosmetic",
    blurb: "The one he normally saves for a streak milestone.",
  },
];

export function itemById(id: string): ShopItem | undefined {
  return SHOP.find((i) => i.id === id);
}

/** The pose a bought cosmetic maps to on the home card. */
export const POSE_ART: Record<string, string> = {
  pose_speaking: "/demos-speaking.webp",
  pose_workout: "/demos-workout.webp",
  pose_celebrate: "/demos-celebrate.webp",
};

/** The floor card's Demos when nothing has been bought or equipped. */
export const DEFAULT_POSE_ART = "/demos.webp";

/**
 * What the floor card should draw.
 *
 * Guarded by ownership rather than trusting the stored id: prefs live in
 * localStorage, so a hand-edited value must fall back to the default
 * rather than unlocking art. The ledger is the source of truth for what
 * was bought; the pref only picks between things it proves.
 */
export function poseArt(
  equipped: string | null,
  owned: Owned
): string {
  if (!equipped) return DEFAULT_POSE_ART;
  if (!owned.ids.has(equipped)) return DEFAULT_POSE_ART;
  return POSE_ART[equipped] ?? DEFAULT_POSE_ART;
}

export interface Owned {
  /** Item ids bought at least once. */
  ids: Set<string>;
  /** Freezes bought, which the freeze balance has to know about. */
  freezes: number;
}

/**
 * What's owned, read off the ledger rather than a separate table — same
 * property that makes coins safe to re-sync: derived, never incremented,
 * so a dropped write heals instead of double-granting.
 */
export function ownedFrom(
  ledger: { kind: string; reason: string }[]
): Owned {
  const ids = new Set<string>();
  let freezes = 0;
  for (const row of ledger) {
    if (row.kind !== "spent" || !row.reason.startsWith("shop:")) continue;
    const id = row.reason.slice(5);
    ids.add(id);
    if (id === "streak_freeze") freezes++;
  }
  return { ids, freezes };
}

/**
 * Can this be bought right now? Cosmetics are once-only; freezes are
 * capped by how many you can equip, so the shop refuses the sale rather
 * than taking coins for something that evaporates.
 */
export function canBuy(
  item: ShopItem,
  balance: number,
  owned: Owned,
  freezesEquipped: number,
  maxFreezes: number
): { ok: boolean; reason?: string } {
  if (item.kind === "cosmetic" && owned.ids.has(item.id)) {
    return { ok: false, reason: "Owned" };
  }
  if (item.id === "streak_freeze" && freezesEquipped >= maxFreezes) {
    return {
      ok: false,
      reason: `You're holding the maximum ${maxFreezes}`,
    };
  }
  if (balance < item.price) {
    return { ok: false, reason: `${item.price - balance} more to go` };
  }
  return { ok: true };
}
