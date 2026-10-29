import type { ComponentProps } from "react";
import { DemosArt } from "@/components/DemosArt";

/**
 * Demos in the introduction: his entrance (the pop, then his pose's own
 * loop on the still) and nothing after it. Everywhere else he stands at
 * 120px or more his idle clip plays over the still (#316); here it began
 * once the entrance had settled and read as a second, different
 * animation starting (notes1, Timothy: "Lets js have the chopping image
 * animation"). Every Demos on /welcome goes through this, so no screen
 * of the walk can bring the clip back (lib/welcome-idle.test.ts renders
 * it to check).
 */
export function IntroDemos(props: Omit<ComponentProps<typeof DemosArt>, "idle">) {
  return <DemosArt {...props} idle={false} />;
}
