/**
 * The picture's reads, from the phone (#488). The rules are in
 * lib/picture.ts; the photo's own reads and writes are #485's
 * (lib/avatar-client.ts); the choice is saved through lib/pose-save.ts.
 * What is new here is the one read a picture adds: which poses the coin
 * ledger proves were bought, held for the visit like the photo's link
 * (lib/held.ts), so a tab that opens on a worn pose draws it at once and
 * checks it behind.
 *
 * Only a paid pose has to be proved (`needsLedger`), and only a list of
 * choices has to name them all, so Today's corner never reads the
 * ledger for a photo or an initial. A purchase drops what was held
 * (`forgetBalance`), so the pose just bought is in the next list.
 */

import { fetchWholeLedger } from "./client-data";
import { POSES_KEY, held, heldMark, hold, once } from "./held";
import { readPrefs } from "./prefs";
import { POSE_STAGE, ownedFrom } from "./shop";

/** The paid poses this visit last read as bought; undefined unread. */
export function heldOwnedPoses(): ReadonlySet<string> | undefined {
  return held<ReadonlySet<string>>(POSES_KEY);
}

/** The paid poses the whole ledger proves (a spend at the catalog price). Throws on a failed read. */
export function fetchOwnedPoses(): Promise<ReadonlySet<string>> {
  return once(POSES_KEY, async () => {
    const mark = heldMark();
    const rows = await fetchWholeLedger();
    const poses = new Set([...ownedFrom(rows).ids].filter((id) => id in POSE_STAGE));
    return hold<ReadonlySet<string>>(POSES_KEY, poses, mark);
  });
}

type Broke = (url: string) => void;
const broke = new Set<Broke>();

/**
 * A photo's link would not load in a coin (PictureCoin's img). Every
 * picture on screen hears it, so whichever coin saw it first (Today's
 * corner, a row of the choices), the hook that drew it reads a fresh
 * link (lib/picture.ts `afterBrokenPhoto`).
 */
export function photoBroke(url: string): void {
  for (const listen of broke) listen(url);
}

/** Hear a photo that would not load; the return stops hearing. */
export function onPhotoBroke(listen: Broke): () => void {
  broke.add(listen);
  return () => void broke.delete(listen);
}

/** This phone's copy of the choice, for the first paint: the account's wins when it lands. */
export function deviceChoice(): string | null {
  return readPrefs().pose;
}
