import { describe, expect, it } from "vitest";
import { holdAwake, type AwakeEnv } from "./wake-lock";

/** A browser that counts what was asked of it. */
function fakeEnv(opts: { refuse?: boolean; none?: boolean } = {}) {
  const state = { asked: 0, released: 0, visible: true, listeners: new Set<() => void>() };
  const env: AwakeEnv = {
    locker: opts.none
      ? undefined
      : {
          request: async () => {
            state.asked += 1;
            if (opts.refuse) throw new Error("NotAllowedError");
            return {
              release: async () => {
                state.released += 1;
              },
            };
          },
        },
    visible: () => state.visible,
    onVisibility: (fn) => {
      state.listeners.add(fn);
      return () => state.listeners.delete(fn);
    },
  };
  const show = (visible: boolean) => {
    state.visible = visible;
    for (const fn of [...state.listeners]) fn();
  };
  return { env, state, show };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

/* The screen stays awake for a take (#440). */
describe("holding the screen awake", () => {
  it("asks once, and lets go once", async () => {
    const { env, state } = fakeEnv();
    const release = holdAwake(env);
    await settle();
    expect(state.asked).toBe(1);
    release();
    release();
    await settle();
    expect(state.released).toBe(1);
    expect(state.listeners.size).toBe(0);
  });

  it("asks again when the page is shown again, because a hidden page loses its lock", async () => {
    const { env, state, show } = fakeEnv();
    const release = holdAwake(env);
    await settle();
    show(false);
    show(true);
    await settle();
    expect(state.asked).toBe(2);
    release();
    await settle();
    // Only the lock it still holds is released; the browser took the first.
    expect(state.released).toBe(1);
  });

  it("never asks while the page is hidden", async () => {
    const { env, state, show } = fakeEnv();
    state.visible = false;
    const release = holdAwake(env);
    await settle();
    expect(state.asked).toBe(0);
    show(true);
    await settle();
    expect(state.asked).toBe(1);
    release();
  });

  it("does not ask twice for one showing", async () => {
    const { env, state, show } = fakeEnv();
    const release = holdAwake(env);
    show(true);
    show(true);
    await settle();
    expect(state.asked).toBe(1);
    release();
  });

  it("a lock that arrives after the take ended is released at once", async () => {
    const { env, state } = fakeEnv();
    const release = holdAwake(env);
    release();
    await settle();
    expect(state.asked).toBe(1);
    expect(state.released).toBe(1);
  });

  it("is nothing at all where the browser has no wake lock, or refuses one", async () => {
    const none = fakeEnv({ none: true });
    const off = holdAwake(none.env);
    await settle();
    expect(none.state.listeners.size).toBe(0);
    off();

    const refused = fakeEnv({ refuse: true });
    const release = holdAwake(refused.env);
    await settle();
    expect(refused.state.asked).toBe(1);
    release();
    await settle();
    expect(refused.state.released).toBe(0);
    expect(holdAwake(null)).toBeTypeOf("function");
  });
});
