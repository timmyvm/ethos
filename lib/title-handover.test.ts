import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HANDOVER_DEPTH, lineFoot, titleHandedOver } from "./title-handover";

const root = join(__dirname, "..");
const css = readFileSync(join(root, "app/globals.css"), "utf8");
const header = readFileSync(join(root, "components/ui/ScreenHeader.tsx"), "utf8");

/** The first scroll at which the bar carries the small title, for a title whose box starts `top` down the page. */
function firstHandover(top: number, height: number, pad: string, barBottom: number): number {
  for (let y = 0; y < 400; y++) if (titleHandedOver(top - y + height, pad, barBottom)) return y;
  return -1;
}

describe("the large title hands over on its line, not its box", () => {
  it("reads the line's foot as the box's bottom less its padding", () => {
    expect(lineFoot(142, "6px")).toBe(136);
    expect(lineFoot(142, 6)).toBe(136);
    expect(lineFoot(136, "0px")).toBe(136);
    // A value that is not a length (never computed, but never NaN either).
    expect(lineFoot(136, "")).toBe(136);
  });

  it("hands over once the line is 6px under the bar's foot", () => {
    expect(HANDOVER_DEPTH).toBe(6);
    // The bar's foot at 56 (Today's 56px bar): the line's foot at 62 is
    // 6px under it, not yet past; at 61 the title has gone.
    expect(titleHandedOver(68, "6px", 56)).toBe(false);
    expect(titleHandedOver(67, "6px", 56)).toBe(true);
    expect(titleHandedOver(62, "0px", 56)).toBe(false);
    expect(titleHandedOver(61, "0px", 56)).toBe(true);
  });

  it("hands Today's padded greeting over at the scroll an unpadded one would (390x844)", () => {
    // The greeting's clip room: padding over and under, pulled back by as
    // much margin, so the line stands where it did and the box is taller.
    const rule = css.match(/\.home \.large-title \{[^}]*\}/)?.[0] ?? "";
    const pad = rule.match(/padding-block:\s*(\d+)px/)?.[1];
    expect(pad, "Today's greeting pads its line for its clip").toBeDefined();
    expect(rule).toMatch(new RegExp(`margin-block:\\s*-${pad}px`));
    // Measured at 390x844 (scrollY 0): the box runs 90 to 142, its 40px
    // line 96 to 136; the bar's foot is at 56.
    const padded = firstHandover(90, 40 + 2 * Number(pad), `${pad}px`, 56);
    const plain = firstHandover(96, 40, "0px", 56);
    expect(plain).toBe(75);
    expect(padded).toBe(plain);
    // Read on the box, it came 6px of scroll late (81), the greeting
    // faded under the frost and the bar empty all that way.
    expect(firstHandover(90, 52, "0px", 56)).toBe(81);
  });

  it("is what ScreenHeader reads, with the heading's computed bottom padding", () => {
    expect(header).toContain('from "@/lib/title-handover"');
    expect(header).toMatch(/setCollapsed\(titleHandedOver\(rect\.bottom, getComputedStyle\(h\)\.paddingBottom, barBottom\)\)/);
    expect(header).not.toMatch(/rect\.bottom\s*-\s*6\s*</);
  });
});
