import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EthosScore, OUT_OF } from "@/components/ui/EthosScore";
import { Trend } from "@/components/ui/TrendMark";

/*
 * #493, the morning tour (docs/look/tour/): the Ethos number was drawn
 * three ways ("665 /1000", "Your Ethos 662 / 1000", "616 your Ethos
 * /1000") and its change four ("▲ 3 since last time", "▲ +51 since day
 * one", "▲ +1", "▼ 6.5"). One score line and one change, everywhere.
 */
const text = (html: string) => html.replace(/<[^>]+>/g, "");

describe("the Ethos number, one drawing (#493)", () => {
  it("is the number, then /1000 as one word", () => {
    expect(OUT_OF).toBe("/1000");
    const html = renderToStaticMarkup(createElement(EthosScore, { value: 662, size: "hero" }));
    expect(text(html)).toBe("662/1000");
    expect(html).toContain('data-score');
    expect(html).not.toMatch(/\/ 1000|your Ethos/);
  });

  it("an unknown number is a dash, never zero", () => {
    const html = renderToStaticMarkup(createElement(EthosScore, { value: null, size: "hero", onStage: true }));
    expect(text(html)).toBe("—/1000");
    expect(html).not.toContain("data-score");
  });

  it("says what it is to a screen reader only where no eyebrow does", () => {
    const html = renderToStaticMarkup(createElement(EthosScore, { value: 665, size: "xl", srLabel: "Your Ethos" }));
    expect(html).toMatch(/class="sr-only">Your Ethos</);
  });

  it("every screen that shows it draws it through EthosScore, with no label beside it", () => {
    for (const file of ["components/RepResult.tsx", "components/log/LogStage.tsx", "app/rep/page.tsx"]) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toMatch(/<EthosScore/);
      expect(src, file).not.toMatch(/>\s*\/ ?1000\s*</);
      expect(src, file).not.toMatch(/your Ethos <span/);
      expect(src, file).not.toMatch(/\{" · your baseline"\}|&& " · your baseline"/);
    }
  });
});

describe("a change, one way (#493)", () => {
  const said = (delta: number, against?: string) =>
    text(renderToStaticMarkup(createElement(Trend, { delta, against })));

  it("is the triangle and the size with no sign, then what it is against", () => {
    expect(said(51, "since day one")).toBe("▲Up 51 since day one");
    expect(said(-6, "since last time")).toBe("▼Down 6 since last time");
    expect(said(1)).toBe("▲Up 1");
    expect(said(51, "since day one")).not.toMatch(/\+|−|-/);
  });

  it("the stage and the results write no sign after the arrow", () => {
    const results = readFileSync("components/RepResult.tsx", "utf8");
    expect(results).not.toMatch(/delta > 0 \? "\+"/);
    expect(results).toMatch(/<Trend /);
    /* The Log's stage (#506) writes its one change as a pill: the mark,
       then the size, never a sign. */
    const stage = readFileSync("components/log/LogStage.tsx", "utf8");
    expect(stage).not.toMatch(/delta > 0 \? "\+"/);
    expect(stage).toMatch(/<TrendMark up=\{delta > 0\} \/>\s*<\/span>\s*\{Math\.abs\(delta\)\}/);
  });
});

/*
 * The #493 review: two more places drew a number out of 1000 their own
 * way. Presence, on the results sheet and a stored video take, read "720
 * your Presence /1000", the label-beside form #493 took off the Ethos
 * number; Today's This week tile read "Ethos Index" over "662" and
 * "−28 this week, +51 since day one", a fifth spelling of a change.
 */
describe("Presence, the same drawing (#493 review)", () => {
  it("Presence: its eyebrow over the score line, the change under it with no sign", async () => {
    const { PresenceScore } = await import("@/components/PresenceCard");
    const up = text(renderToStaticMarkup(createElement(PresenceScore, { score: 720, previous: 680, premium: true, onUpgrade: () => {} })));
    expect(up).toBe("Your Presence720/1000▲Up 40 since last video");
    const door = renderToStaticMarkup(createElement(PresenceScore, { score: 720, previous: null, premium: false, onUpgrade: () => {} }));
    expect(text(door)).toMatch(/^Your PresencePremium.*···\/1000Measured on this device\. Tap to read it\.$/);
    for (const html of [door]) expect(html).not.toMatch(/your Presence/);
  });

  /* Today's This week tile left with #500 (Today is one card), and with
     it the fifth place the number was drawn. */
});
