"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Overlay, useOverlayClose } from "@/components/ui/Overlay";
import { usePaywallHeadStays } from "@/lib/paywall-head";

/**
 * The sheet's name: its head, its dialog label, and the door's visible
 * text and accessible name, one fixed string (tapOf files every open
 * under it). "The whole recording" read as the audio, which is one chip
 * away on the glance (the #427 review); the door is named for what it
 * holds (COPY-RULES): every number the take has, the coach's two among
 * them.
 */
export const SHEET_NAME = "Every number";

/**
 * "Every number" (DECISIONS #427): everything a take measured that is
 * not on the glance, in one flat scroll, opened in place from the
 * glance's door. A game's round, the coach's two, records, Hear it back,
 * every dimension with the practice's row open, Presence, the
 * transcript, and the closing note as its last word. Pulled, never
 * pushed: the glance is the finished debrief, and this is for whoever
 * wants the rest.
 *
 * The app's sheet (components/ui/Overlay.tsx): it rises on the sheet
 * spring, a finger pulls it down from anywhere not mid-scroll, Escape and
 * the scrim close it, and focus comes back to the door. Its head never
 * scrolls on a screen 640pt or taller (the paywall's rule,
 * lib/paywall-head.ts); under that only the grabber stays. The take's one
 * <audio> stays on the page under it, so a moment started on the glance
 * keeps playing here. Its foot repeats the glance's tap, so whoever reads
 * to the end goes on without closing it; the glance's own tap is under
 * the sheet, so one filled tap shows.
 */
export function WholeRecording({
  onClose,
  foot,
  children,
}: {
  onClose: () => void;
  /** The glance's tap, again. */
  foot: ReactNode;
  children: ReactNode;
}) {
  return (
    <Overlay label={SHEET_NAME} onClose={onClose} className="w-full max-w-[430px]">
      <Body onClose={onClose} foot={foot}>
        {children}
      </Body>
    </Overlay>
  );
}

function Body({ onClose, foot, children }: { onClose: () => void; foot: ReactNode; children: ReactNode }) {
  const close = useOverlayClose(onClose);
  const headStays = usePaywallHeadStays();
  const head = useRef<HTMLHeadingElement>(null);
  /* A hairline under the head once the body scrolls under it, as an iOS
     sheet's bar draws one; at the top the head and the body are one. */
  const [under, setUnder] = useState(false);
  /* Focus to the head once the sheet has taken it (Overlay focuses its
     panel on open, after this effect), so a screen reader hears the
     sheet's name first and Tab starts at Done. */
  useEffect(() => {
    const id = requestAnimationFrame(() => head.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, []);
  const title = (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <h2 ref={head} tabIndex={-1} className="detail-head min-w-0 outline-none">
        {SHEET_NAME}
      </h2>
      <button
        type="button"
        onClick={close}
        data-look="sheet-done"
        className="press font-display -mr-3 min-h-11 min-w-11 shrink-0 rounded-control px-3 text-detail font-semibold text-ink"
      >
        Done
      </button>
    </div>
  );
  return (
    <div
      data-whole-recording
      className="elev-3 flex max-h-[calc(100dvh-max(12px,env(safe-area-inset-top)))] w-full max-w-[430px] flex-col overflow-hidden rounded-t-sheet border border-b-0 border-transparent bg-ground text-ink dark:border-card-edge"
    >
      <div
        className={`shrink-0 border-b px-5 pt-2 transition-colors duration-(--duration-base) ${
          under && headStays ? "border-hairline" : "border-transparent"
        }`}
      >
        <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-stone-300" />
        {headStays ? <div className="mt-1">{title}</div> : <div className="h-2" />}
      </div>
      <div
        data-sheet-scroll
        onScroll={(e) => setUnder(e.currentTarget.scrollTop > 2)}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 pt-3 pb-8"
      >
        {!headStays && <div className="mb-3">{title}</div>}
        {children}
      </div>
      <div className="shrink-0 border-t border-hairline px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">{foot}</div>
    </div>
  );
}
