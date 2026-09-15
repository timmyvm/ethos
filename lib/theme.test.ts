import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PREFS, readPrefs, writePrefs } from "@/lib/prefs";
import { themeBootScript } from "@/components/Theme";

/**
 * Light is the app (DECISIONS #284).
 *
 * The bug this exists to stop is a quiet one: the theme had three
 * values, the third was "follow the OS", and it was the default. A
 * phone on auto-dark therefore decided what Ethos looked like, so the
 * cream ground the whole visual system is built on was not what most
 * people opened. Dark is still there and still complete; it is a switch
 * you throw on a device, not an inference from it.
 *
 * Source-level where the value is a default rather than a computation:
 * the failure mode is a file drifting back to the old shape, not a
 * function returning the wrong number.
 */

/** Enough localStorage to read and write prefs. The suite runs in node. */
function stubStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

/** Enough document for the inline boot script: one root, one meta. */
function stubDocument() {
  const attrs = new Map<string, string>();
  return {
    documentElement: {
      setAttribute: (k: string, v: string) => void attrs.set(k, v),
      getAttribute: (k: string) => attrs.get(k) ?? null,
    },
    querySelector: () => null,
  };
}

const globals = globalThis as Record<string, unknown>;
const had = { localStorage: globals.localStorage, document: globals.document, matchMedia: globals.matchMedia };

beforeEach(() => {
  globals.localStorage = stubStorage();
});

afterAll(() => {
  globals.localStorage = had.localStorage;
  globals.document = had.document;
  globals.matchMedia = had.matchMedia;
});

describe("light is the default room", () => {
  it("defaults to light", () => {
    expect(DEFAULT_PREFS.theme).toBe("light");
    expect(readPrefs().theme).toBe("light");
  });

  it("keeps dark once this device chooses it", () => {
    writePrefs({ theme: "dark" });
    expect(readPrefs().theme).toBe("dark");
  });

  it("reads a stored 'system' from before #284 as light", () => {
    localStorage.setItem("ethos.prefs", JSON.stringify({ theme: "system" }));
    expect(readPrefs().theme).toBe("light");
  });

  it("reads a nonsense stored theme as light", () => {
    localStorage.setItem("ethos.prefs", JSON.stringify({ theme: "sepia" }));
    expect(readPrefs().theme).toBe("light");
  });

  it("leaves every other stored preference alone", () => {
    localStorage.setItem(
      "ethos.prefs",
      JSON.stringify({ theme: "system", haptics: false, reminderHour: 7 })
    );
    const prefs = readPrefs();
    expect(prefs.haptics).toBe(false);
    expect(prefs.reminderHour).toBe(7);
  });
});

describe("the OS never votes on colour", () => {
  it("keeps the query out of the boot script and the component", () => {
    expect(themeBootScript).not.toContain("prefers-color-scheme");
    expect(readFileSync("components/Theme.tsx", "utf8")).not.toContain(
      "prefers-color-scheme"
    );
  });

  it("boots light for a device that has never chosen", () => {
    // The inline script runs before hydration, so it is the one place
    // the default is decided for real.
    const doc = stubDocument();
    globals.document = doc;
    globals.matchMedia = () => ({ matches: false });
    new Function(themeBootScript)();
    expect(doc.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("boots dark for a device that chose dark", () => {
    localStorage.setItem("ethos.prefs", JSON.stringify({ theme: "dark" }));
    const doc = stubDocument();
    globals.document = doc;
    globals.matchMedia = () => ({ matches: false });
    new Function(themeBootScript)();
    expect(doc.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("still lets the OS answer the motion question", () => {
    // #221's rule is untouched: colour is ours, movement is a request
    // the OS is allowed to make.
    const doc = stubDocument();
    globals.document = doc;
    globals.matchMedia = () => ({ matches: true });
    new Function(themeBootScript)();
    expect(doc.documentElement.getAttribute("data-motion")).toBe("reduce");
  });
});

describe("the screens that carry the decision", () => {
  it("offers two choices in Settings, not three", () => {
    const settings = readFileSync("app/settings/page.tsx", "utf8");
    expect(settings).toContain('(["light", "dark"] as Theme[])');
    expect(settings).not.toContain('"system"');
  });

  it("tells the native layer which room it is in", () => {
    // Without this a phone on auto-dark paints dark scrollbars, a dark
    // caret and dark pickers onto the cream page.
    const css = readFileSync("app/globals.css", "utf8");
    const dark = css.indexOf(':root[data-theme="dark"]');
    expect(css.slice(0, dark)).toContain("color-scheme: light");
    expect(css.slice(dark)).toContain("color-scheme: dark");
  });

  it("sends light from the server so the first byte is already right", () => {
    expect(readFileSync("app/layout.tsx", "utf8")).toContain(
      '<html lang="en" data-theme="light"'
    );
  });
});
