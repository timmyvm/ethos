"use client";

import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { AnswerPicker } from "@/components/settings/AnswerPicker";
import { PAGE_CLASS } from "@/components/settings/Rows";
import { GOALS } from "@/content/portfolio";
import type { Answers, GoalId } from "@/lib/answers";

const read = (a: Answers): GoalId | null => a.goal;
const write = (_a: Answers, id: GoalId): Partial<Answers> => ({ goal: id });

/**
 * Goal (#479): what the introduction asked you want this for. It names
 * your plan's headline and picks the boss it points you at
 * (content/portfolio.ts GOALS).
 */
export default function GoalPage() {
  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="Goal" back={{ href: "/settings/profile", label: "Profile" }} />
      <AnswerPicker title="What you want this for" options={GOALS} read={read} write={write} />
    </main>
  );
}
