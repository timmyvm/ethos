"use client";

import Image from "next/image";
import { poseSrc } from "@/components/DemosArt";
import { StatIcon } from "@/components/StatIcon";
import { POSE_STAGE } from "@/lib/shop";

/** The 56px slot every item's picture stands in, a pose's or the freeze's. */
const SLOT =
  "flex h-14 w-14 shrink-0 justify-center overflow-hidden rounded-control bg-surface dark:bg-[color-mix(in_srgb,var(--color-ink)_7%,transparent)]";

/**
 * Every item's picture in one 56px slot (you-3, you-22).
 *
 * A pose is the still You's stage draws when it is worn: the stage pose
 * from `POSE_STAGE`, its file from DemosArt's own `poseSrc`, so what the
 * Shop sells is what You wears. The Shop used to show other renders
 * ("Demos, mid-practice" held out a stopwatch and stood on You hugging an
 * alarm clock). The stage stills share one baseline, so each stands on
 * the slot's floor at the same height.
 *
 * The freeze is the 3D snowflake (#487) in the same slot as the poses:
 * the colour is in the object now, as Today's trait tiles keep theirs
 * in the mark (#359), so the slot is the poses' neutral one and the
 * Shop's four pictures stand alike. It was a line snowflake on the sky
 * tile (#315), which under an icy blue object read as blue on blue. In
 * dark the surface step is darker than the card it sits in and drew a
 * hole, so the slot takes the quiet ink fill Settings' hour set uses.
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
  return (
    <span aria-hidden className={`${SLOT} items-end`}>
      <Image
        src={poseSrc(pose, 128)}
        alt=""
        width={128}
        height={128}
        className="demos h-[52px] w-[52px] object-contain object-bottom"
      />
    </span>
  );
}
