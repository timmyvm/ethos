import { describe, expect, it, vi } from "vitest";
import { onLayers, openLayer, underLayer } from "@/lib/overlay-layers";

/** A node that holds exactly the nodes it is given, itself included. */
function node(...inside: object[]): Node {
  const self = {
    contains: (n: object) => n === self || inside.includes(n),
  };
  return self as unknown as Node;
}

describe("overlay layers", () => {
  it("cover nothing while none is open", () => {
    expect(underLayer(node())).toBe(false);
  });

  it("cover the page under a sheet, and not what the sheet holds", () => {
    const page = node();
    const clip = node();
    const sheet = node(clip);
    const close = openLayer(sheet);
    expect(underLayer(page)).toBe(true);
    expect(underLayer(clip)).toBe(false);
    close();
    expect(underLayer(page)).toBe(false);
  });

  it("cover a sheet under another one, and uncover it when the top one goes", () => {
    const inLower = node();
    const lower = node(inLower);
    const upper = node();
    const closeLower = openLayer(lower);
    const closeUpper = openLayer(upper);
    expect(underLayer(inLower)).toBe(true);
    closeUpper();
    expect(underLayer(inLower)).toBe(false);
    closeLower();
  });

  it("leave in any order, and a second close changes nothing", () => {
    const page = node();
    const a = openLayer(node());
    const b = openLayer(node());
    a();
    expect(underLayer(page)).toBe(true);
    b();
    b();
    expect(underLayer(page)).toBe(false);
  });

  it("tell a listener on every open and close, until it unsubscribes", () => {
    const fn = vi.fn();
    const off = onLayers(fn);
    const close = openLayer(node());
    close();
    close();
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    openLayer(node())();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
