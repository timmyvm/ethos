"use client";

import { BENEFITS } from "@/components/Paywall";
import { PremiumMark } from "@/components/PremiumMark";
import { Overlay } from "@/components/ui/Overlay";
import { SheetHead } from "@/components/ui/SheetHead";

/** The sheet's head, a title with no full stop (COPY-RULES). */
export const HAVE_TITLE = "What Premium gives you";

/**
 * What an account that has Premium has (#485): the door behind "Yay!
 * You've got Premium 🎉" on You, Timothy's "Explore ->". The paywall's
 * own list, word for word and glyph for glyph (Paywall's BENEFITS), so
 * the two never say different things, on a neutral sheet: someone who
 * has the tier is not being sold it, so nothing here is plum but the
 * mark that names it, and there is no price and no tap. It informs, so
 * it closes with Done at its top right (D15).
 */
export function PremiumHave({ onClose }: { onClose: () => void }) {
  return (
    <Overlay label={HAVE_TITLE} onClose={onClose} className="w-full max-w-[430px]">
      <div
        data-look="premium-have"
        className="elev-3 w-full max-w-[430px] rounded-t-sheet bg-raised px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2"
      >
        <SheetHead onClose={onClose} />
        <PremiumMark variant="chip" />
        <h2 className="font-display mt-2 text-title font-extrabold text-balance">{HAVE_TITLE}</h2>
        <ul className="mt-4 space-y-3 text-body leading-snug">
          {BENEFITS.map(({ Glyph, text }, i) => (
            <li key={i} className="flex items-start gap-3">
              <span aria-hidden className="mt-px shrink-0 text-plum-700">
                <Glyph size={18} />
              </span>
              <span className="min-w-0 text-balance">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </Overlay>
  );
}
