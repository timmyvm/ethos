"use client";

import Link from "next/link";
import { PictureCoin } from "@/components/picture/PictureCoin";
import { usePicture } from "@/components/picture/usePicture";

/**
 * Who this is, in the bar's corner (#393, the references' opening: the
 * fintech card's and the smart home's avatar over "Hi, Nicole"), and a
 * door to You. Since #488 it draws the person's one picture, the same
 * one You's card and Settings draw: the photo, Demos in a pose they
 * wear, or the initial (components/picture/usePicture.tsx). While the
 * picture is being read it holds its place with nothing in it, so a
 * letter never swaps for the photo.
 */
export function AvatarCoin({ name, known }: { name: string | null; known: boolean }) {
  const { picture } = usePicture({ name, nameKnown: known });
  return (
    <Link href="/you" aria-label="You" className="home-avatar press ml-3">
      <PictureCoin picture={picture} size={44} />
    </Link>
  );
}
