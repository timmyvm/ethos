import { describe, expect, it } from "vitest";
import { isAppleKeyboard, isTyping, modLabel, modOnly, shortcutLabel } from "./keys";

/*
 * The keyboard as the person's own keyboard names it (#438): ⌘ on a Mac,
 * Ctrl elsewhere, and a shortcut that never fires over something being
 * typed.
 */
describe("the keyboard's name", () => {
  it("knows an Apple keyboard from what the browser says", () => {
    expect(isAppleKeyboard({ platform: "MacIntel", userAgent: "" })).toBe(true);
    expect(isAppleKeyboard({ platform: "", userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)" })).toBe(true);
    expect(isAppleKeyboard({ platform: "Win32", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" })).toBe(false);
    expect(isAppleKeyboard({ platform: "Linux x86_64", userAgent: "X11; Linux" })).toBe(false);
    expect(isAppleKeyboard(undefined)).toBe(false);
  });

  it("prints the modifier and a shortcut the platform's way", () => {
    expect(modLabel(true)).toBe("⌘");
    expect(modLabel(false)).toBe("Ctrl");
    expect(shortcutLabel("K", true)).toBe("⌘K");
    expect(shortcutLabel("K", false)).toBe("Ctrl K");
  });
});

describe("the platform's modifier, alone", () => {
  const none = { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };

  it("is ⌘ on a Mac and Ctrl elsewhere", () => {
    expect(modOnly({ ...none, metaKey: true }, true)).toBe(true);
    expect(modOnly({ ...none, ctrlKey: true }, false)).toBe(true);
    expect(modOnly({ ...none, ctrlKey: true }, true)).toBe(false);
    expect(modOnly({ ...none, metaKey: true }, false)).toBe(false);
  });

  it("never with Shift or Alt beside it, and never bare", () => {
    expect(modOnly({ ...none, metaKey: true, shiftKey: true }, true)).toBe(false);
    expect(modOnly({ ...none, ctrlKey: true, altKey: true }, false)).toBe(false);
    expect(modOnly(none, true)).toBe(false);
    expect(modOnly(none, false)).toBe(false);
  });
});

describe("whether a key belongs to something being typed", () => {
  const el = (tagName: string, attrs: Record<string, string> = {}, isContentEditable = false) =>
    ({ tagName, isContentEditable, getAttribute: (name: string) => attrs[name] ?? null }) as unknown as EventTarget;

  it("a text field, a textarea, a select, anything editable", () => {
    expect(isTyping(el("INPUT"))).toBe(true);
    expect(isTyping(el("INPUT", { type: "search" }))).toBe(true);
    expect(isTyping(el("INPUT", { type: "email" }))).toBe(true);
    expect(isTyping(el("TEXTAREA"))).toBe(true);
    expect(isTyping(el("SELECT"))).toBe(true);
    expect(isTyping(el("DIV", {}, true))).toBe(true);
  });

  it("not a button, a switch, a slider, a link or the page", () => {
    expect(isTyping(el("BUTTON"))).toBe(false);
    expect(isTyping(el("INPUT", { type: "checkbox" }))).toBe(false);
    expect(isTyping(el("INPUT", { type: "range" }))).toBe(false);
    expect(isTyping(el("A"))).toBe(false);
    expect(isTyping(el("BODY"))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});
