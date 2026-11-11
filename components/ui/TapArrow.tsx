import { IconOnward } from "@/components/Icon";

/**
 * The arrow at the end of a tap that moves you on (#437, direction 10,
 * Timothy: "10 for feedback"). A 36px disc in the label's colour with
 * the arrow in the fill's, so it stands on ink and on a card's tint and
 * turns with the theme (`.tap-arrow-disc`, globals.css). The last child
 * of a button wearing `ACTION_ARROW_CLASS` (lib/ui.ts), after its words.
 *
 * A picture of what the words already say, so it is hidden from a
 * screen reader, and it is not a second target: the whole pill is the
 * tap. No hooks and no state, so a server page can draw it too.
 */
export function TapArrow() {
  return (
    <span aria-hidden className="tap-arrow-disc">
      <IconOnward size={16} />
    </span>
  );
}
