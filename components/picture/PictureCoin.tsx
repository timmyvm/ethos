"use client";

import { useRef, useState } from "react";
import { IconYou } from "@/components/Icon";
import { bustSrc, type Picture } from "@/lib/picture";

/** What a picture is, as one string: its change is what the coin animates. */
function pictureKey(picture: Picture): string | null {
  switch (picture.kind) {
    case "photo":
      return `photo:${picture.url}`;
    case "pose":
      return `pose:${picture.pose}`;
    case "initial":
      return `initial:${picture.letter ?? ""}`;
    default:
      return null;
  }
}

/**
 * A picture of the person, in its coin (#488): the one drawing every
 * surface uses, so You's card (64), Settings' index (56), Today's
 * corner (44) and each row of the choices (40) can never draw the same
 * person three ways again.
 *
 *  - the photo, cut to the circle, with its own hairline so a white
 *    photo keeps its edge on a white card;
 *  - Demos's bust (lib/picture.ts `bustSrc`) on his sky, the app icon's
 *    ground: a face in a coin, not a full figure;
 *  - the initial, Outfit 800, on a step of ink over whatever it sits on,
 *    or a person's outline when there is no name;
 *  - nothing while the picture is unread, so a letter never swaps for
 *    the photo it already had.
 *
 * The first picture drawn is simply there; one that replaces it after
 * (a row picked on the sheet, a photo kept) grows in (`.picture-swap`).
 *
 * A picture, never a control: the door that holds it (a link to You, the
 * button that opens the choices) names it. `dim` is a photo still
 * saving.
 */
export function PictureCoin({
  picture,
  size,
  dim = false,
  className = "",
  children,
}: {
  picture: Picture;
  size: number;
  dim?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState<string | null>(null);
  const last = useRef<string | null>(null);
  const swapped = useRef(false);
  const key = pictureKey(picture);
  if (key !== null) {
    if (last.current !== null && last.current !== key) swapped.current = true;
    last.current = key;
  }
  const swap = swapped.current ? "picture-swap" : "";
  const url = picture.kind === "photo" ? picture.url : picture.kind === "pose" ? bustSrc(picture.pose) : null;
  return (
    <span
      aria-hidden
      data-picture={picture.kind}
      className={`picture-coin ${className}`}
      style={{ "--coin": `${size}px` } as React.CSSProperties}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed link, the phone's own copy, or a 256px cut
        <img
          key={url}
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={() => setLoaded(url)}
          className={`dur-base transition-opacity ${swap} ${picture.kind === "photo" && loaded !== url && !url.startsWith("blob:") ? "opacity-0" : ""} ${dim ? "opacity-60" : ""}`}
        />
      ) : picture.kind === "initial" ? (
        picture.letter ? (
          <span key={key} className={swap || "fade-in"}>
            {picture.letter}
          </span>
        ) : (
          <span key={key} className={`${swap || "fade-in"} text-stone-500`}>
            <IconYou size={Math.round(size * 0.44)} />
          </span>
        )
      ) : null}
      {children}
    </span>
  );
}
