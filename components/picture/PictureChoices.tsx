"use client";

import { Overlay, useOverlayClose } from "@/components/ui/Overlay";
import { SheetHead } from "@/components/ui/SheetHead";
import { TapTick } from "@/components/ui/TapTick";
import { ActionRow, CheckMark, LinkRow } from "@/components/settings/Rows";
import { PictureCoin } from "@/components/picture/PictureCoin";
import { rowPicture, type PictureState } from "@/components/picture/usePicture";
import { AVATAR_COPY } from "@/lib/avatar";
import { PICTURE_COPY, rowName, type PictureRow } from "@/lib/picture";
import { useRovingRadio } from "@/lib/use-roving-radio";

/**
 * The choices of a picture (#488), as rows of a grouped list: every
 * picture you can wear with a check on the one you wear (your photo when
 * there is one, your initial, Hello, each pose you own), then the photo's
 * own two doors (#485's picker, the only one: Add a photo, or Choose a
 * new photo and Remove photo), then the Shop. The same rows stand in
 * Settings' Profile and in the sheet You's coin opens, so both doors set
 * one thing. The caller holds the group (`.inset-group`, or Settings'
 * Section). `onPicked` runs after a row is chosen or the picker opens:
 * the sheet closes on it, the Profile page stays.
 */
export function PictureChoices({ state, onPicked }: { state: PictureState; onPicked?: () => void }) {
  const { rows, shown, letter, photo } = state;
  const pick = (row: PictureRow) => {
    state.choose(row);
    onPicked?.();
  };
  // Arrow keys move the choice and leave the sheet open; a tap picks and closes it.
  const { getItemProps } = useRovingRadio({ values: rows, value: shown, onChange: state.choose });
  return (
    <>
      <div role="radiogroup" aria-label={PICTURE_COPY.sheetTitle} data-inset="icon">
        {rows.map((row, i) => (
          <button
            key={row}
            type="button"
            role="radio"
            aria-checked={shown === row}
            data-picture-row={row}
            onClick={() => pick(row)}
            {...getItemProps(row, i)}
            className="group-row press-row flex w-full items-center gap-3.5 py-2 text-left"
          >
            <PictureCoin picture={rowPicture(row, state)} size={40} />
            {/* While the name is unread the initial's row keeps its own
                words, so "No picture" never flashes before "Your initial". */}
            <span className="font-display min-w-0 flex-1 text-row">{rowName(row, state.nameKnown ? letter : "?")}</span>
            {shown === row && <CheckMark />}
            <TapTick />
          </button>
        ))}
      </div>
      {/* More poses follow the poses; the photo's doors close the list,
          the one red word last, as a phone's own list puts it. */}
      <LinkRow href="/shop" label={PICTURE_COPY.shop} />
      <ActionRow
        label={photo ? AVATAR_COPY.choose : AVATAR_COPY.add}
        onClick={() => {
          state.pickPhoto();
          onPicked?.();
        }}
      />
      {photo && (
        <ActionRow
          label={AVATAR_COPY.remove}
          tone="destructive"
          onClick={() => {
            state.removePhoto();
            onPicked?.();
          }}
        />
      )}
    </>
  );
}

/**
 * A failed line under the picture: the photo's (with avatarRetry's one
 * door, or none) or a choice that did not reach the account.
 */
export function PictureProblem({ state, className = "mt-2" }: { state: PictureState; className?: string }) {
  if (!state.error) return null;
  return (
    <p role="alert" data-look="avatar-error" className={`${className} text-caption text-stone-500`}>
      {state.error}
      {state.retry && (
        <>
          {" "}
          <button
            type="button"
            onClick={state.retry.run}
            className="relative font-semibold text-stone-600 underline underline-offset-2 after:absolute after:-inset-x-2 after:-inset-y-[13px] after:content-['']"
          >
            {state.retry.label}
          </button>
        </>
      )}
    </p>
  );
}

/** The choices on a sheet: what You's coin opens. A pick closes it, so the card shows what was picked. */
export function PictureSheet({ state, onClose }: { state: PictureState; onClose: () => void }) {
  return (
    <Overlay label={PICTURE_COPY.sheetTitle} onClose={onClose} className="w-full max-w-[430px]">
      <div
        data-look="picture-sheet"
        className="elev-3 max-h-[92dvh] w-full max-w-[430px] overflow-y-auto overscroll-contain rounded-t-sheet bg-raised px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2"
      >
        {/* The information sheet's head (#496): the name at the left of
            Done's row, as Every number's sheet has it. */}
        <SheetHead onClose={onClose} title={PICTURE_COPY.sheetTitle} />
        <SheetChoices state={state} onClose={onClose} />
      </div>
    </Overlay>
  );
}

/** Inside the sheet, so a pick leaves the way every way out does: the sheet's own exit. */
function SheetChoices({ state, onClose }: { state: PictureState; onClose: () => void }) {
  const close = useOverlayClose(onClose);
  return (
    <div className="inset-group picture-sheet-group mt-3">
      <PictureChoices state={state} onPicked={close} />
    </div>
  );
}
