import { IconFlask } from "@/components/Icon";
import { TEST_COPY } from "@/content/tester";

/**
 * The tester's mark (#402): "Tester" with a flask, on mint, the colour of
 * the moment testing switched on (the joined screen's stage). It labels
 * the three places the test shows itself, Today's test tile and the two
 * questions around a recording, and nowhere else. A label, never a
 * control: no hover, no press, no focus, no role, read as its word.
 */
export function TesterChip({ className = "" }: { className?: string }) {
  return (
    <span className={`tester-chip font-display text-caption font-bold leading-none ${className}`}>
      <IconFlask size={13} />
      {TEST_COPY.chip}
    </span>
  );
}
