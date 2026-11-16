import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TapTick } from "@/components/ui/TapTick";
import { iosMajor, tapTickOffered } from "./tap-tick";

const iphone = (os: string, version = "18.0") =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS ${os} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Mobile/15E148 Safari/604.1`;
const IPAD = "Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36";
const CHROME_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.0.0 Mobile/15E148 Safari/604.1";

describe("iosMajor", () => {
  it("reads the version a Safari user agent states", () => {
    expect(iosMajor(iphone("18_0"))).toBe(18);
    expect(iosMajor(iphone("17_4_1", "17.4"))).toBe(17);
    expect(iosMajor(iphone("26_3", "26.3"))).toBe(26);
  });

  it("the string iOS 26 freezes at 18_6 is still 18", () => {
    expect(iosMajor(iphone("18_6", "26.1"))).toBe(18);
  });

  it("is null where there is no iOS to read", () => {
    expect(iosMajor(ANDROID)).toBeNull();
    expect(iosMajor("")).toBeNull();
  });
});

describe("tapTickOffered (#449)", () => {
  it("an iPhone on iOS 18 or later, with no vibration to ask for", () => {
    expect(tapTickOffered({ ua: iphone("18_0"), vibrates: false })).toBe(true);
    expect(tapTickOffered({ ua: iphone("18_6", "26.5"), vibrates: false })).toBe(true);
    expect(tapTickOffered({ ua: iphone("27_0", "27.0"), vibrates: false })).toBe(true);
  });

  it("every browser on an iPhone is WebKit underneath, Chrome included", () => {
    expect(tapTickOffered({ ua: CHROME_IOS, vibrates: false })).toBe(true);
  });

  it("not iOS 17: the switch is there from 17.4, its haptic from 18", () => {
    expect(tapTickOffered({ ua: iphone("17_4", "17.4"), vibrates: false })).toBe(false);
    expect(tapTickOffered({ ua: iphone("16_7", "16.6"), vibrates: false })).toBe(false);
  });

  it("not an iPad, which has no Taptic Engine, in either of its two disguises", () => {
    expect(tapTickOffered({ ua: IPAD, vibrates: false })).toBe(false);
    expect(tapTickOffered({ ua: IPAD_DESKTOP, vibrates: false })).toBe(false);
  });

  it("never where the Vibration API exists: buzz() does it there, patterns and all", () => {
    expect(tapTickOffered({ ua: ANDROID, vibrates: true })).toBe(false);
    expect(tapTickOffered({ ua: iphone("18_6"), vibrates: true })).toBe(false);
  });

  it("not a desktop, and not nothing", () => {
    expect(tapTickOffered({ ua: IPAD_DESKTOP, vibrates: false })).toBe(false);
    expect(tapTickOffered({ ua: "", vibrates: false })).toBe(false);
  });
});

describe("TapTick, as the server and the stylesheet see it (#449)", () => {
  it("is not in the server's page: the overlay arrives after hydration, on the phones that tick", () => {
    expect(renderToStaticMarkup(createElement("button", null, "Record", createElement(TapTick)))).toBe(
      "<button>Record</button>"
    );
  });

  const css = readFileSync("app/globals.css", "utf8");
  const rule = (selector: string): string => {
    const at = css.indexOf(`\n${selector} {`);
    if (at < 0) throw new Error(`${selector} has no rule`);
    return css.slice(at, css.indexOf("\n}", at));
  };

  it("the label covers its button and takes its shape", () => {
    const label = rule(".tap-tick");
    expect(label).toMatch(/position: absolute;/);
    expect(label).toMatch(/inset: 0;/);
    expect(label).toMatch(/border-radius: inherit;/);
    expect(label).toMatch(/touch-action: manipulation;/);
  });

  it("the switch is hidden by visibility and keeps its native look, or WebKit plays nothing", () => {
    const input = rule(".tap-tick > input");
    expect(input).toMatch(/visibility: hidden;/);
    expect(input).not.toMatch(/appearance/);
    expect(input).not.toMatch(/display: none/);
    expect(input).not.toMatch(/opacity/);
  });

  it("the button under it is positioned in the base layer, so a position utility still wins", () => {
    expect(css).toMatch(/@layer base \{\s*:where\(button\):has\(> \.tap-tick\) \{\s*position: relative;\s*\}\s*\}/);
  });

  it("only buttons carry one: a label inside a link keeps the link from going anywhere", () => {
    const files = [
      "app/rep/page.tsx",
      "app/hostile/page.tsx",
      "app/shop/page.tsx",
      "app/boss/page.tsx",
      "app/settings/page.tsx",
      "components/home/HomeHero.tsx",
      "components/TopicRoulette.tsx",
    ];
    let seen = 0;
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      let from = 0;
      for (;;) {
        const at = src.indexOf("<TapTick />", from);
        if (at < 0) break;
        seen += 1;
        // The nearest element still open above it is a <button>.
        const before = src.slice(0, at);
        const opened = Math.max(before.lastIndexOf("<button"), before.lastIndexOf("<a "), before.lastIndexOf("<Link"));
        expect(before.slice(opened, opened + 7), `${file} at ${at}`).toBe("<button");
        from = at + 1;
      }
    }
    expect(seen).toBeGreaterThanOrEqual(10);
  });
});
