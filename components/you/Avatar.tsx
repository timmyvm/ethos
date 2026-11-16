"use client";

import { useState, type ReactNode } from "react";
import { IconCamera } from "@/components/Icon";
import { PictureCoin } from "@/components/picture/PictureCoin";
import { PictureProblem, PictureSheet } from "@/components/picture/PictureChoices";
import { usePicture } from "@/components/picture/usePicture";
import { PICTURE_COPY } from "@/lib/picture";

/**
 * Your picture on You's card (#485, one picture since #488): the 64px
 * coin beside the name, drawing the one picture every surface draws
 * (components/picture/usePicture.tsx): your photo, Demos in a pose you
 * own, or your initial. A camera badge at its foot says it takes a
 * photo.
 *
 * A tap opens the choices on a sheet, the same rows Settings' Profile
 * lists, so both doors set one thing: a picture to wear, Add a photo
 * (the phone's own picker), or Choose a new photo and Remove photo. A
 * picked photo shows at once, dimmed, while it saves.
 *
 * A hook, because its three parts stand in three places: the coin in the
 * card's row, a failure's line under the card, and the sheet over the
 * page.
 */
export function useYouAvatar({
  name,
  nameKnown,
}: {
  name: string | null;
  nameKnown: boolean;
}): { coin: ReactNode; problem: ReactNode; sheet: ReactNode } {
  const state = usePicture({ name, nameKnown, choices: true });
  const [open, setOpen] = useState(false);

  const coin = (
    <>
      <button
        type="button"
        data-look="avatar"
        aria-label={PICTURE_COPY.change}
        aria-haspopup="dialog"
        aria-busy={state.saving || undefined}
        onClick={() => setOpen(true)}
        className="press relative shrink-0 rounded-full"
      >
        <PictureCoin picture={state.picture} size={64} dim={state.saving}>
          <span className="you-avatar-badge">
            <IconCamera size={14} />
          </span>
        </PictureCoin>
      </button>
      {state.input}
    </>
  );

  return {
    coin,
    problem: <PictureProblem state={state} />,
    sheet: open ? <PictureSheet state={state} onClose={() => setOpen(false)} /> : null,
  };
}
