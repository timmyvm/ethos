import { describe, expect, it } from "vitest";
import { KEYBOARD_MIN_PX, clearOfKeys, keyboardUp } from "./keyboard-up";

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

  /* A page shown larger from the start (#451: an iPhone's text size
     followed). 390x844 laid out at 320x692.5 and shown 1.21875 times
     the size. Browsers disagree about whether the visual viewport's
     `scale` counts that, so the widths say how far the page is pinched. */
  const ZOOM = 1.21875;
  const page = { height: 692.5, width: 320, zoom: ZOOM };

  it("on a page shown larger: not up at rest, whichever way the browser reads its scale", () => {
    expect(keyboardUp({ height: 692.5, width: 320, scale: ZOOM }, page)).toBe(false);
    expect(keyboardUp({ height: 692.5, width: 320, scale: 1 }, page)).toBe(false);
  });

  it("on a page shown larger: up for the smallest keyboard, 216pt of the screen", () => {
    const inView = 692.5 - 216 / ZOOM;
    expect(keyboardUp({ height: inView, width: 320, scale: ZOOM }, page)).toBe(true);
    expect(keyboardUp({ height: inView, width: 320, scale: 1 }, page)).toBe(true);
  });

  it("on a page shown larger: the browser's bars are still not a keyboard", () => {
    expect(keyboardUp({ height: 692.5 - 80 / ZOOM, width: 320, scale: ZOOM }, page)).toBe(false);
  });

  it("on a page shown larger and pinched in: read as if unpinched", () => {
    // Pinched to twice the size: half the width and half the height in view.
    expect(keyboardUp({ height: 346.25, width: 160, scale: ZOOM * 2 }, page)).toBe(false);
    expect(keyboardUp({ height: (692.5 - 336 / ZOOM) / 2, width: 160, scale: ZOOM * 2 }, page)).toBe(true);
  });

  it("with the widths known, a pinch is told from them and not from the scale", () => {
    expect(keyboardUp({ height: 422, width: 195, scale: 1 }, { height: 844, width: 390 })).toBe(false);
  });
});


/* Settings' account forms (#479): how far the page scrolls to lift a tap above the keys. */
describe("a form's tap, clear of the keys", () => {
  it("scrolls just far enough to stand the tap 12px above the keys", () => {
    // 375x667 with a 260px keyboard: the keys start at 407; a tap ending at 452 needs 57.
    expect(clearOfKeys(452, 407)).toBe(57);
    expect(clearOfKeys(452.2, 407)).toBe(58);
  });

  it("does nothing when the tap already stands clear", () => {
    expect(clearOfKeys(380, 407)).toBe(0);
    expect(clearOfKeys(395, 407)).toBe(0);
  });
});
