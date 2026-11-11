"use client";

import { useTapTick } from "@/lib/tap-tick";

/**
 * The tick under a tap, on an iPhone (#449, lib/tap-tick.ts).
 *
 * Put it inside a button as its last child. Where the phone can tick and
 * Haptics is on, it draws a transparent label over the whole button,
 * wired to a hidden native switch. The person's own tap lands on the
 * label; the label hands it to the switch as a trusted click, the switch
 * toggles, and iOS plays its tick. The tap still bubbles from the label
 * to the button, so the button's `onClick` runs as it always did, once:
 * the switch's own click stops where it is.
 *
 * Rules it lives by:
 *  - A button, never a link: a label inside an `<a>` keeps the link from
 *    going anywhere.
 *  - The button must be positioned (`relative`): the label covers it.
 *  - Not on a disabled button. A label is not disabled with its button,
 *    and a control that does nothing must not tick.
 *  - The switch keeps its native look (no `appearance: none`): WebKit
 *    plays nothing for a switch that has been restyled. It is hidden
 *    with `visibility`, which leaves it native.
 *
 * Nothing here is for assistive tech or a keyboard: the label is
 * `aria-hidden`, the switch is out of the tab order, and the button
 * under them is still the control. VoiceOver, Voice Control and Return
 * all press the button itself, with no tick, which is how the system's
 * own buttons behave under them.
 */
export function TapTick() {
  const on = useTapTick();
  if (!on) return null;
  return (
    <label aria-hidden="true" data-tap-tick="" className="tap-tick">
      <input
        type="checkbox"
        tabIndex={-1}
        // React has no name for it yet; the attribute is what WebKit reads.
        {...{ switch: "" }}
        onClick={(e) => e.stopPropagation()}
      />
    </label>
  );
}
