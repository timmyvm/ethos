"use client";

import Image from "next/image";
import { poseSrc } from "@/components/DemosArt";
import { IconFreeze } from "@/components/Icon";
import { POSE_STAGE } from "@/lib/shop";

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
 * The freeze is the sky tile itself (#315: protection you hold, never
 * sage), not a tile in a tile. In dark the surface step is darker than
 * the card it sits in and drew a hole, so the tile takes the quiet ink
 * fill Settings' hour set uses.
 */
export function ItemArt({ id }: { id: string }) {
  const pose = POSE_STAGE[id];
  if (!pose) {
    return (
      <span aria-hidden className="you-freeze h-14 w-14">
        <IconFreeze size={22} />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-14 w-14 shrink-0 items-end justify-center overflow-hidden rounded-control bg-surface dark:bg-[color-mix(in_srgb,var(--color-ink)_7%,transparent)]"
    >
      <Image
        src={poseSrc(pose)}
        alt=""
        width={128}
        height={128}
        className="demos h-[52px] w-[52px] object-contain object-bottom"
      />
    </span>
  );
}
