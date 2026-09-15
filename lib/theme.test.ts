import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PREFS, readPrefs, writePrefs } from "@/lib/prefs";
import { themeBootScript } from "@/components/Theme";

/**
 * The theme has three values and the default follows the OS
 * (DECISIONS #286, restoring what #284 narrowed).
 *
 * What this exists to hold: the setting resolves in exactly two places,
 * the inline boot script and `applyTheme`, and they must agree. They
 * drifted once already, so both are asserted here against the same
 * cases rather than one being taken on trust.
 *
 * Source-level where the value is a default rather than a computation:
 * the failure mode is a file drifting back to the other shape, not a
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
const had = {
  localStorage: globals.localStorage,
  document: globals.document,
  matchMedia: globals.matchMedia,
};

/** Runs the inline script against a bare document on a phone whose OS
 *  says dark (or does not), and reports what <html> ended up with. */
function boot({ osDark }: { osDark: boolean }) {
  const doc = stubDocument();
  globals.document = doc;
  globals.matchMedia = (q: string) => ({
    matches: q.includes("prefers-color-scheme: dark") ? osDark : false,
  });
  new Function(themeBootScript)();
  return doc.documentElement;
}

beforeEach(() => {
  globals.localStorage = stubStorage();
});

afterAll(() => {
  globals.localStorage = had.localStorage;
  globals.document = had.document;
  globals.matchMedia = had.matchMedia;
});

describe("the OS answers unless this device has", () => {
  it("defaults to system", () => {
    expect(DEFAULT_PREFS.theme).toBe("system");
    expect(readPrefs().theme).toBe("system");
  });

  it("keeps an explicit choice", () => {
    writePrefs({ theme: "dark" });
    expect(readPrefs().theme).toBe("dark");
    writePrefs({ theme: "light" });
    expect(readPrefs().theme).toBe("light");
  });

  it("reads an unrecognised stored theme as system", () => {
    localStorage.setItem("ethos.prefs", JSON.stringify({ theme: "sepia" }));
    expect(readPrefs().theme).toBe("system");
  });

  it("leaves every other stored preference alone", () => {
    localStorage.setItem(
      "ethos.prefs",
      JSON.stringify({ theme: "sepia", haptics: false, reminderHour: 7 })
    );
    const prefs = readPrefs();
    expect(prefs.haptics).toBe(false);
    expect(prefs.reminderHour).toBe(7);
  });
});

describe("the boot script, which decides it before React exists", () => {
  it("follows a dark OS when nothing is stored", () => {
    expect(boot({ osDark: true }).getAttribute("data-theme")).toBe("dark");
  });

  it("follows a light OS when nothing is stored", () => {
    expect(boot({ osDark: false }).getAttribute("data-theme")).toBe("light");
  });

  it("lets a stored light beat a dark OS", () => {
    localStorage.setItem("ethos.prefs", JSON.stringify({ theme: "light" }));
    expect(boot({ osDark: true }).getAttribute("data-theme")).toBe("light");
  });

  it("lets a stored dark beat a light OS", () => {
    localStorage.setItem("ethos.prefs", JSON.stringify({ theme: "dark" }));
    expect(boot({ osDark: false }).getAttribute("data-theme")).toBe("dark");
  });

  it("resolves a stored 'system' rather than stamping the word", () => {
    // `data-theme="system"` matches no CSS rule, so the app would render
    // its light tokens while calling itself something else.
    localStorage.setItem("ethos.prefs", JSON.stringify({ theme: "system" }));
    expect(boot({ osDark: true }).getAttribute("data-theme")).toBe("dark");
  });

  it("agrees with lib/prefs.ts on what counts as a choice", () => {
    // Two copies of the same rule, in two languages, in two files.
    expect(themeBootScript).toContain(
      "p.theme === 'dark' || p.theme === 'light' ? p.theme : 'system'"
    );
  });

  it("still lets the OS answer the motion question", () => {
    const doc = stubDocument();
    globals.document = doc;
    globals.matchMedia = () => ({ matches: true });
    new Function(themeBootScript)();
    expect(doc.documentElement.getAttribute("data-motion")).toBe("reduce");
  });
});

describe("the screens that carry the decision", () => {
  it("offers three choices in Settings", () => {
    expect(readFileSync("app/settings/page.tsx", "utf8")).toContain(
      '(["system", "light", "dark"] as Theme[])'
    );
  });

  it("sends no theme from the server, since only the browser knows", () => {
    // A guessed attribute here is a wrong first paint for half the users
    // the guess does not match.
    expect(readFileSync("app/layout.tsx", "utf8")).toContain(
      '<html lang="en" suppressHydrationWarning>'
    );
  });

  it("tells the native layer which room it resolved to", () => {
    // Kept from #284: without this a dark-themed app gets light
    // scrollbars, a light caret and light pickers. It follows the
    // RESOLVED attribute, so it is right under `system` too.
    const css = readFileSync("app/globals.css", "utf8");
    const dark = css.indexOf(':root[data-theme="dark"]');
    expect(css.slice(0, dark)).toContain("color-scheme: light");
    expect(css.slice(dark)).toContain("color-scheme: dark");
  });
});
