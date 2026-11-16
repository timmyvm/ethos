"use client";

import { StatIcon } from "@/components/StatIcon";
import { PictureCoin } from "@/components/picture/PictureCoin";
import { POSE_STAGE } from "@/lib/shop";

/** The 56px slot every item's picture stands in, a pose's or the freeze's. */
const SLOT =
  "flex h-14 w-14 shrink-0 justify-center overflow-hidden rounded-control bg-surface dark:bg-[color-mix(in_srgb,var(--color-ink)_7%,transparent)]";

/**
 * Every item's picture in one 56px place (you-3, you-22).
 *
 * A pose is sold as what it becomes once worn (#488): your picture, a
 * bust of Demos in that pose in his sky coin, drawn by the same
 * PictureCoin that You's card, Today's corner and Settings draw, so what
 * the Shop sells is exactly what you wear. It was the pose's full figure
 * on a grey slot while the pose stood on You's stage (#395), and then a
 * full figure for a picture that no longer existed (#485).
 *
 * The freeze is the 3D snowflake (#487) in the square slot: a thing you
 * hold, not a picture of you. In dark the surface step is darker than
 * the card it sits in and drew a hole, so the slot takes the quiet ink
 * fill Settings' hour set uses.
 */
export function ItemArt({ id }: { id: string }) {
  const pose = POSE_STAGE[id];
  if (!pose) {
    return (
      <span aria-hidden className={`${SLOT} items-center`}>
        <StatIcon kind="freeze" size={44} />
      </span>
    );
  }
  return <PictureCoin picture={{ kind: "pose", id, pose }} size={56} />;
}
