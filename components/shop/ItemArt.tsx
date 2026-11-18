"use client";

import { StatIcon } from "@/components/StatIcon";
import { PictureCoin } from "@/components/picture/PictureCoin";
import { POSE_STAGE } from "@/lib/shop";

/** The 56px slot every item's picture stands in, a pose's or the freeze's: no fill of its own. */
const SLOT = "flex h-14 w-14 shrink-0 items-center justify-center";

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
 * The freeze is the 3D snowflake (#487), standing bare in the same 56
 * slot: a thing you hold, not a picture of you, so no coin, and no tile
 * either (#496, the morning tour: a filled grey square beside the
 * poses' sky coins read as a placeholder; the 3D object is its own
 * ground, as it is on You's numbers and Today's chip).
 */
export function ItemArt({ id }: { id: string }) {
  const pose = POSE_STAGE[id];
  if (!pose) {
    return (
      <span aria-hidden data-art="freeze" className={SLOT}>
        <StatIcon kind="freeze" size={56} />
      </span>
    );
  }
  return <PictureCoin picture={{ kind: "pose", id, pose }} size={56} />;
}
