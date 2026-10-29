"use client";

import Link from "next/link";
import { IconYou } from "@/components/Icon";
import { initialOf } from "@/lib/home";

/**
 * Who this is, in the bar's corner (#393, the references' opening: the
 * fintech card's and the smart home's avatar over "Hi, Nicole"). A
 * 44px coin with the name's initial, or the You mark without a name,
 * and a door to You. While the name is being read it holds its place
 * with nothing in it, so a letter never swaps for the glyph.
 */
export function AvatarCoin({ name, known }: { name: string | null; known: boolean }) {
  const letter = initialOf(name);
  return (
    <Link href="/you" aria-label="You" className="home-avatar press ml-3">
      {known && (
        <span aria-hidden className={letter ? "fade-in" : "fade-in text-stone-500"}>
          {letter ?? <IconYou size={22} />}
        </span>
      )}
    </Link>
  );
}
