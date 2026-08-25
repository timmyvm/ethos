import { describe, expect, it } from "vitest";
import { browserFamily, permissionSteps } from "./permission-help";

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  chrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  firefox:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
};

describe("browserFamily", () => {
  it("tells the families apart by their tells", () => {
    expect(browserFamily(UA.iphone)).toBe("ios-safari");
    expect(browserFamily(UA.macSafari)).toBe("safari");
    expect(browserFamily(UA.chrome)).toBe("chromium");
    expect(browserFamily(UA.edge)).toBe("chromium");
    expect(browserFamily(UA.firefox)).toBe("firefox");
    expect(browserFamily("curl/8.0")).toBe("unknown");
  });
});

describe("permissionSteps", () => {
  it("every family gets concrete steps, never an empty shrug", () => {
    for (const f of [
      "ios-safari",
      "safari",
      "firefox",
      "chromium",
      "unknown",
    ] as const) {
      const steps = permissionSteps(f, false);
      expect(steps.length).toBeGreaterThanOrEqual(3);
      expect(steps.join(" ")).toContain("Microphone");
    }
  });

  it("names the camera too when video mode asked for it", () => {
    expect(permissionSteps("chromium", true).join(" ")).toContain("Camera");
  });
});
