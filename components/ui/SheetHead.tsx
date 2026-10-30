"use client";

import { useOverlayClose } from "@/components/ui/Overlay";

/**
 * The top of an information sheet (D15): the grabber, and Done at the
 * top right in the same row. Four sheets closed four ways (a full-width
 * Done at the foot, a Done beside the mark, a terracotta Done, the
 * paywall's "Not yet"); every sheet that informs now closes the way the
 * manage sheet did, where an iOS sheet keeps it. The paywall sells, so
 * it keeps "Not yet" under its tap.
 *
 * Done is Outfit 17/600 in ink, white on the plum sheets, with a 44px
 * hit area; it plays the sheet's own exit (useOverlayClose), the one
 * Escape and the scrim play. The row carries no margin of its own past
 * the sheet's top: the sheet's padding is the parent's.
 */
export function SheetHead({
  onClose,
  plum = false,
  label = "Done",
}: {
  onClose: () => void;
  /** On a plum sheet (.card-premium): a cream grabber and a white Done. */
  plum?: boolean;
  label?: string;
}) {
  const close = useOverlayClose(onClose);
  return (
    <div className="relative -mr-3 flex min-h-11 items-center justify-end">
      <div
        aria-hidden
        className={`absolute left-1/2 top-0 h-1 w-10 -translate-x-1/2 rounded-full ${
          plum ? "bg-cream/30" : "bg-stone-300"
        } -ml-1.5`}
      />
      <button
        type="button"
        onClick={close}
        data-look="sheet-done"
        className={`press font-display min-h-11 min-w-11 rounded-control px-3 text-detail font-semibold ${
          plum ? "text-white" : "text-ink"
        }`}
      >
        {label}
      </button>
    </div>
  );
}
