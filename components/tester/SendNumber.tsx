"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconCheck, IconUpload } from "@/components/Icon";
import { TEST_COPY } from "@/content/tester";
import { markSent } from "@/lib/tester-client";

/**
 * The tile's key, Send and Answer alike: grey, raised on Today's surface
 * tile, never terracotta (#402). A pill, as every 44 to 48px secondary
 * button is since round one (D11, DESIGN principle 2).
 */
export function keyClass(surface: "ground" | "tile") {
  return `press font-display inline-flex min-h-11 min-w-[96px] shrink-0 items-center justify-center gap-1.5 rounded-tap border border-edge px-4 text-row text-ink max-[359px]:min-w-[76px] ${
    surface === "tile" ? "bg-raised" : "bg-surface"
  }`;
}

/**
 * The tester number's Send (#402): the phone's share sheet with the
 * number already typed in ("My Ethos tester number is 0B5E 7A21."), so
 * sending it to Timothy is one tap and a contact; Copy where the phone
 * has no share sheet. Either way the device remembers the number went
 * (lib/tester-client.ts markSent), and Today's tile moves on to the
 * day's ask.
 *
 * A grey key, never terracotta: the screen's one tap stays its own. On
 * Today's surface tile it stands on the raised fill, or it would vanish
 * into the tile. "Sent" and "Copied" are said by a status beside the
 * key, never inside it: a live region in a button takes its name.
 */
export function SendNumber({
  number,
  surface = "ground",
  onSent,
}: {
  number: string;
  surface?: "ground" | "tile";
  onSent?: () => void;
}) {
  const [canShare, setCanShare] = useState(false);
  const [status, setStatus] = useState<"sent" | "copied" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLayoutEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const done = (kind: "sent" | "copied") => {
    markSent(number);
    setStatus(kind);
    onSent?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), 2000);
  };
  const copy = () =>
    navigator.clipboard
      ?.writeText(number)
      .then(() => done("copied"))
      .catch(() => {});
  const tap = () => {
    if (!canShare) return void copy();
    navigator
      .share({ text: TEST_COPY.share(number) })
      .then(() => done("sent"))
      .catch((e: unknown) => {
        // Closing the sheet is no answer; anything else falls back to Copy.
        if ((e as { name?: string } | null)?.name !== "AbortError") void copy();
      });
  };

  const label = status === "sent" ? TEST_COPY.sent : status === "copied" ? TEST_COPY.copied : canShare ? TEST_COPY.send : TEST_COPY.copy;
  const icon = status ? <IconCheck size={16} /> : canShare ? <IconUpload size={16} /> : null;
  return (
    <>
      <button
        type="button"
        onClick={tap}
        aria-label={canShare ? TEST_COPY.sendLabel : TEST_COPY.copyLabel}
        className={keyClass(surface)}
      >
        {/* The word never leaves the key: Send becomes Sent from 40%, and
            only the glyph fades in whole. Keying the whole content left
            an empty key for a frame on the one tap that matters. */}
        <span className="inline-flex items-center gap-1.5">
          {icon && (
            <span key={status ?? (canShare ? "share" : "copy")} className="fade-in inline-flex max-[359px]:hidden">
              {icon}
            </span>
          )}
          <span key={label} className="key-word-in">
            {label}
          </span>
        </span>
      </button>
      <span role="status" className="sr-only">
        {status === "sent" ? TEST_COPY.sent : status === "copied" ? TEST_COPY.copied : ""}
      </span>
    </>
  );
}
