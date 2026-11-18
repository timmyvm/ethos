"use client";

import dynamic from "next/dynamic";
import { afterFirstScreen } from "@/lib/first-draw";

/*
 * The paywall and the month's price-drop sheet, loaded when first asked
 * for rather than with the page (#508, the speed audit's fix 18). Today,
 * the Log, You, Practice, the recorder, a stored recording and the boss
 * all drew them only on a tap or a moment, yet carried their code (the
 * sheet, the stair, the plan card, the overlay: about 34 KB raw) in the
 * code a phone parses before anything is live. The code is fetched once
 * the screen's numbers are drawn and the phone is idle, so the first tap
 * still opens the sheet at once; a tap before that waits on its fetch.
 * Their props are the components' own.
 */
const loadPaywall = () => import("@/components/Paywall").then((m) => m.Paywall);
const loadDrop = () => import("@/components/premium/Moments").then((m) => m.PriceDropSheet);

export const Paywall = dynamic(loadPaywall, { ssr: false });
export const PriceDropSheet = dynamic(loadDrop, { ssr: false });

if (typeof window !== "undefined") {
  afterFirstScreen(() => {
    void loadPaywall().catch(() => {});
  }, 5000);
}
