"use client";

import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { AnswerPicker } from "@/components/settings/AnswerPicker";
import { PAGE_CLASS } from "@/components/settings/Rows";
import { PAINS } from "@/content/portfolio";
import type { Answers, PainId } from "@/lib/answers";
import { withFocus } from "@/lib/settings-index";

const read = (a: Answers): PainId | null => a.pains[0] ?? null;
const write = (a: Answers, id: PainId): Partial<Answers> => ({ pains: withFocus(a.pains, id) });

/**
 * Focus (#479): the first thing the introduction heard you notice, the
 * one the app leads with. Picking another puts it first and keeps the
 * other answers behind it (`withFocus`).
 */
export default function FocusPage() {
  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="Focus" back={{ href: "/settings/practice", label: "Practice" }} />
      <AnswerPicker title="What you notice most" options={PAINS} read={read} write={write} />
    </main>
  );
}
