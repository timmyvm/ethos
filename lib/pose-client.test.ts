import { describe, expect, it } from "vitest";
import { poseCapableIn } from "./pose-client";

/*
 * The mode toggle answers from this rule, not from a download (#216).
 * Whatever else changes in the loader, "can this browser do it" has to
 * stay a question that costs nothing to ask.
 */
describe("poseCapableIn", () => {
  const capable = { hasWindow: true, hasUserMedia: true, hasWasm: true };

  it("says yes when the camera API and WASM are both present", () => {
    expect(poseCapableIn(capable)).toBe(true);
  });

  it("says no on the server", () => {
    expect(poseCapableIn({ ...capable, hasWindow: false })).toBe(false);
  });

  it("says no without a camera API to read from", () => {
    expect(poseCapableIn({ ...capable, hasUserMedia: false })).toBe(false);
  });

  it("says no without WASM, which the runtime cannot do without", () => {
    expect(poseCapableIn({ ...capable, hasWasm: false })).toBe(false);
  });
});
