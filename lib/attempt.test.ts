import { describe, expect, it } from "vitest";
import { createAttempts } from "./attempt";

/**
 * A request a person can walk away from (the paywall's Start, the manage
 * sheet's portal rows): "Not yet", Escape or "I have a code" while it is
 * out must mean the browser never leaves for Stripe when it answers.
 */
describe("an abandonable request", () => {
  it("is live until something newer starts or it is abandoned", () => {
    const a = createAttempts();
    const first = a.start();
    expect(a.live(first)).toBe(true);
    const second = a.start();
    expect(a.live(first)).toBe(false);
    expect(a.live(second)).toBe(true);
  });

  it("dies when the person walks away, so its answer is dropped", () => {
    const a = createAttempts();
    const id = a.start();
    a.abandon();
    expect(a.live(id)).toBe(false);
  });

  it("lets a fresh start after an abandon go through", () => {
    const a = createAttempts();
    a.start();
    a.abandon();
    const again = a.start();
    expect(a.live(again)).toBe(true);
  });
});
