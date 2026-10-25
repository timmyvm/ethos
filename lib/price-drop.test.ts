import { describe, expect, it } from "vitest";
import type { BillingRow } from "./client-data";
import { LADDER_SEEN_KEY, planView } from "./plan-view";
import { browserSeenStore, markCheckoutSeen, readSeen, takeDrop, writeSeen, type SeenStore } from "./price-drop";

/**
 * The drop's memory: once per new month, never on first sight, never
 * for month 1, and storage that misbehaves reads as first sight.
 */
const TODAY = new Date(2026, 9, 25);

function memory(initial: string | null = null): SeenStore & { value: string | null; writes: number } {
  const m = {
    value: initial,
    writes: 0,
    get: () => m.value,
    set: (v: string) => {
      m.value = v;
      m.writes += 1;
    },
  };
  return m;
}

const row = (over: Partial<BillingRow> = {}): BillingRow => ({
  status: "active",
  ladder_month: 4,
  price_cents: 999,
  next_price_cents: 899,
  current_period_end: new Date(2026, 10, 25, 12).toISOString(),
  cancel_at_period_end: false,
  ...over,
});
const view = (over: Partial<BillingRow> = {}) => planView(null, row(over), TODAY);

describe("takeDrop", () => {
  it("stores the month silently on first sight", () => {
    const store = memory();
    expect(takeDrop(view(), store)).toBe(false);
    expect(store.value).toBe("4");
  });

  it("celebrates a new month once, then never again for it", () => {
    const store = memory("3");
    expect(takeDrop(view(), store)).toBe(true);
    expect(store.value).toBe("4");
    expect(takeDrop(view(), store)).toBe(false);
    expect(store.writes).toBe(1);
  });

  it("is once across the two pages that ask (Today, then You)", () => {
    const store = memory("3");
    const today = takeDrop(view(), store);
    const you = takeDrop(view(), store);
    expect([today, you]).toEqual([true, false]);
  });

  it("never celebrates month 1, and the checkout return remembers it", () => {
    const store = memory();
    markCheckoutSeen(store);
    expect(store.value).toBe("1");
    expect(takeDrop(view({ ladder_month: 1, price_cents: 1299, next_price_cents: 1199 }), store)).toBe(false);
    expect(takeDrop(view({ ladder_month: 2, price_cents: 1199, next_price_cents: 1099 }), store)).toBe(true);
  });

  it("stores a month that went down (a new plan) without a word", () => {
    const store = memory("6");
    expect(takeDrop(view({ ladder_month: 2, price_cents: 1199 }), store)).toBe(false);
    expect(store.value).toBe("2");
  });

  it("stays quiet past the floor, where the price holds", () => {
    const store = memory("7");
    expect(takeDrop(view({ ladder_month: 8, price_cents: 699, next_price_cents: 699 }), store)).toBe(false);
    expect(store.value).toBe("8");
  });

  it("celebrates a plan that skipped a month on this device, once", () => {
    const store = memory("2");
    expect(takeDrop(view({ ladder_month: 5, price_cents: 899 }), store)).toBe(true);
    expect(store.value).toBe("5");
  });

  it("touches nothing for a plan that is not live", () => {
    const store = memory("3");
    expect(takeDrop(planView(null, null, TODAY), store)).toBe(false);
    expect(takeDrop(view({ status: "canceled" }), store)).toBe(false);
    expect(takeDrop(view({ status: "incomplete", ladder_month: 0 }), store)).toBe(false);
    expect(takeDrop(planView(null, undefined, TODAY), store)).toBe(false);
    expect(store.writes).toBe(0);
  });

  it("still celebrates a drop on a plan that is ending or being retried", () => {
    expect(takeDrop(view({ cancel_at_period_end: true }), memory("3"))).toBe(true);
    expect(takeDrop(view({ status: "past_due" }), memory("3"))).toBe(true);
  });
});

describe("a store that misbehaves", () => {
  it("reads junk as first sight, and stores over it", () => {
    for (const junk of ["", "abc", "-2", "3.5", "NaN"]) {
      const store = memory(junk);
      expect(readSeen(store)).toBeNull();
      expect(takeDrop(view(), store)).toBe(false);
      expect(store.value).toBe("4");
    }
  });

  it("survives a store that throws on read and on write", () => {
    const broken: SeenStore = {
      get: () => {
        throw new Error("SecurityError");
      },
      set: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(readSeen(broken)).toBeNull();
    expect(() => writeSeen(4, broken)).not.toThrow();
    expect(takeDrop(view(), broken)).toBe(false);
  });

  it("never writes a month that is not a whole number", () => {
    const store = memory();
    writeSeen(Number.NaN, store);
    writeSeen(-1, store);
    writeSeen(2.5, store);
    expect(store.writes).toBe(0);
  });

  it("guards the real localStorage when there is no window", () => {
    expect(browserSeenStore.get()).toBeNull();
    expect(() => browserSeenStore.set("4")).not.toThrow();
  });

  it("keeps the key the spec names", () => {
    expect(LADDER_SEEN_KEY).toBe("ethos.ladder.seen");
  });
});
