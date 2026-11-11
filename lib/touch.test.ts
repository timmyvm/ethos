import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * Touch and hold (#444). The rule is CSS a phone's engine reads and
 * this container's browser mostly cannot (-webkit-touch-callout is
 * WebKit's), so its presence and its shape are held here.
 */
const css = readFileSync("app/globals.css", "utf8");
const at = css.indexOf(" * Touch and hold (#444");
// The rules alone: the comment over them may say "select" as a word.
const block = css
  .slice(css.indexOf("@layer base {", at), css.indexOf("\n}\n", css.indexOf("@layer base {", at)) + 3)
  .replace(/\/\*[\s\S]*?\*\//g, "");

describe("touch and hold", () => {
  it("lives in the base layer, so a utility can still say otherwise", () => {
    expect(at).toBeGreaterThan(-1);
    expect(block).toContain("@layer base {");
  });

  it("gives no callout on anything pressable or drawn", () => {
    const rule = block.slice(block.indexOf(":where(a, button"), block.indexOf("-webkit-touch-callout: none;"));
    for (const what of ["a", "button", "summary", "img", "svg", '[role="button"]', '[role="option"]']) {
      expect(rule, what).toContain(what);
    }
  });

  it("never touches a field: typing, pasting and selecting stay the phone's", () => {
    expect(block).not.toMatch(/\binput\b|\btextarea\b|\bselect\b(?!\s*:)/);
  });

  it("selects no control's label and none of the screen's own furniture", () => {
    expect(block).toMatch(/:where\(nav, \.large-title, \.screen-bar[^)]*\)\s*\{\s*-webkit-user-select: none;\s*user-select: none;/);
  });

  it("keeps what was said, and a link in a sentence, as text", () => {
    expect(block).toMatch(/:where\(\.tw\),\s*:where\(p\) :where\(a\)\s*\{\s*-webkit-user-select: text;\s*user-select: text;/);
    expect(block).toMatch(/:where\(p\) :where\(a\),\s*:where\(img\[data-keeps\]\)\s*\{\s*-webkit-touch-callout: default;/);
  });

  it("leaves the progress card a picture that can be saved", () => {
    expect(readFileSync("components/ShareCard.tsx", "utf8")).toContain('data-keeps=""');
  });
});
