import { describe, expect, it } from "vitest";
import { KEYBOARD_MIN_PX, keyboardUp } from "./keyboard-up";

/* Whether the on-screen keyboard is up, from the part of the page still in view (#441). */
describe("the keyboard, from the visual viewport", () => {
  it("is up when it covers a keyboard's worth of the page", () => {
    // An iPhone 14: 844 tall, the keyboard and its bar take 336.
    expect(keyboardUp({ height: 508, scale: 1 }, 844)).toBe(true);
    expect(keyboardUp({ height: 844 - 216, scale: 1 }, 844)).toBe(true);
  });

  it("is not up for the browser's own bars coming and going", () => {
    expect(keyboardUp({ height: 844, scale: 1 }, 844)).toBe(false);
    expect(keyboardUp({ height: 844 - 80, scale: 1 }, 844)).toBe(false);
    expect(keyboardUp({ height: 844 - KEYBOARD_MIN_PX, scale: 1 }, 844)).toBe(false);
  });

  it("is not up because the page is pinched in", () => {
    // Zoomed to 2x, the visual viewport is half as tall and nothing covers the page.
    expect(keyboardUp({ height: 422, scale: 2 }, 844)).toBe(false);
    // Zoomed and the keyboard up.
    expect(keyboardUp({ height: 254, scale: 2 }, 844)).toBe(true);
  });

  it("is not up where the browser cannot say", () => {
    expect(keyboardUp(null, 844)).toBe(false);
    expect(keyboardUp(undefined, 844)).toBe(false);
  });
});
