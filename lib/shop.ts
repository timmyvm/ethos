/**
 * The shop (DECISIONS #90 reopened on Timothy's call, 11 Aug).
 *
 * It was deferred because the obvious sinks (freezes, early boss
 * access, score retries) mostly competed with Pro. Everything is free
 * right now (`entitlement.ts`), so that objection is moot, and coins
 * have been accruing with nothing to spend them on, which was always
 * the temporary state rather than the design.
 *
 * The non-negotiable holds and shapes the whole list: **money never buys
 * stars, streaks, or scores.** Coins aren't money (they're earned by
 * speaking, one per day) but the rule behind it still applies. Nothing
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

/**
 * What the Shop says about a pose, now that a pose is a picture (#488):
 * bought, it is worn as your picture, which every surface that shows a
 * picture of you draws (lib/picture.ts). Its blurb, its button before
 * and after it is worn, and the note when it is bought. It used to say
 * "Wear it on You" and "It's yours, and it's on You." while nothing on
 * You drew it (#485 took Demos off You's card).
 */
export const SHOP_PICTURE = {
  blurb: "Wear it as your picture.",
  wear: "Wear it as your picture",
  worn: "Your picture",
  bought: "It's yours, and it's your picture now.",
} as const;

export const SHOP: ShopItem[] = [
  {
    id: "streak_freeze",
    name: "Streak freeze",
    price: 14,
    kind: "utility",
    blurb:
      "Covers one missed day automatically. Three is the most you can hold.",
  },
  {
    id: "pose_speaking",
    name: "Demos, mid-sentence",
    price: 8,
    kind: "cosmetic",
    blurb: SHOP_PICTURE.blurb,
  },
  {
    /*
     * The id is a LEDGER key (it is written into the coin ledger when
     * somebody buys it), so it stays `pose_workout` for the same reason
     * routes keep "rep" (#164): nobody reads it aloud, and renaming it
     * would orphan every purchase. The art it points at is the part a
     * user sees: once a panda lifting a dumbbell (#249), then a stopwatch
     * the stage never drew, and now the alarm-clock pose, worn as a
     * picture since #488.
     */
    id: "pose_workout",
    name: "Demos, mid-practice",
    price: 8,
    kind: "cosmetic",
    blurb: SHOP_PICTURE.blurb,
  },
  {
    id: "pose_celebrate",
    name: "Demos, celebrating",
    price: 12,
    kind: "cosmetic",
    blurb: SHOP_PICTURE.blurb,
  },
];

export function itemById(id: string): ShopItem | undefined {
  return SHOP.find((i) => i.id === id);
}

/**
 * The pose a bought cosmetic is, in DemosArt's set. It stood on Today's
 * floor card until #393, then on You's stage until #485 took Demos off
 * You's card; since #488 it is worn as your picture, a bust of the pose
 * in a coin (lib/picture.ts `bustSrc`), and the Shop's slot draws that
 * same coin (`components/shop/ItemArt.tsx`), so what you buy is what
 * you wear.
 */
export type StagePose = "speaking" | "clock" | "celebrate";
export const POSE_STAGE: Record<string, StagePose> = {
  pose_speaking: "speaking",
  pose_workout: "clock", // "the alarm-clock pose", Practice's boss
  pose_celebrate: "celebrate",
};

/**
 * The equipped pose for the stage; null draws the default. Guarded by
 * ownership rather than trusting the stored id: the device's copy lives
 * in localStorage, so a hand-edited value must fall back rather than
 * unlock a pose. The ledger proves what was bought; the pref only picks
 * between things it proves.
 */
export function stagePose(equipped: string | null, owned: Owned): StagePose | null {
  if (!equipped || !owned.ids.has(equipped)) return null;
  return POSE_STAGE[equipped] ?? null;
}

export interface Owned {
  /** Item ids bought at least once. */
  ids: Set<string>;
  /** Freezes bought, which the freeze balance has to know about. */
  freezes: number;
}

/**
 * What's owned, read off the ledger rather than a separate table: same
 * property that makes coins safe to re-sync: derived, never incremented,
 * so a dropped write heals instead of double-granting.
 *
 * A spend proves a purchase only when it is for an item on sale and paid
 * its price in full. Until migration 0015, spend_coins charged whatever
 * amount the caller sent, so the ledger can hold a one-coin freeze; that
 * row proves nothing. No price has ever changed; if one rises, purchases
 * made at the old price have to keep counting here.
 */
export function ownedFrom(
  ledger: { kind: string; reason: string; amount: number }[]
): Owned {
  const ids = new Set<string>();
  let freezes = 0;
  for (const row of ledger) {
    if (row.kind !== "spent" || !row.reason.startsWith("shop:")) continue;
    const item = itemById(row.reason.slice(5));
    if (!item || row.amount < item.price) continue;
    ids.add(item.id);
    if (item.id === "streak_freeze") freezes++;
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
    return { ok: false, reason: `${maxFreezes} of ${maxFreezes} held` };
  }
  if (balance < item.price) {
    return { ok: false, reason: `${item.price - balance} more coins` };
  }
  return { ok: true };
}
