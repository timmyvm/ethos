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

describe("an iPhone running Ethos from its Home Screen (#440)", () => {
  it("is its own family: there is no address bar to send anyone to", () => {
    expect(browserFamily(UA.iphone, true)).toBe("ios-installed");
    expect(browserFamily(UA.iphone, false)).toBe("ios-safari");
    // Only an iPhone or iPad: an installed desktop app keeps its browser's steps.
    expect(browserFamily(UA.chrome, true)).toBe("chromium");
  });

  it("is told to open the app again, never to find a button in a bar it does not have", () => {
    const steps = permissionSteps("ios-installed", false);
    const all = steps.join(" ");
    expect(all).not.toMatch(/address bar|aA|Website Settings|puzzle/);
    expect(steps[0]).toMatch(/Close Ethos/);
    expect(all).toMatch(/Open Ethos again/);
    expect(all).toMatch(/Tap Allow/);
    expect(all).toMatch(/Settings app → Apps → Safari → Microphone/);
    expect(permissionSteps("ios-installed", true).join(" ")).toMatch(/Camera/);
  });

  it("keeps the copy rules", () => {
    for (const video of [false, true]) {
      for (const step of permissionSteps("ios-installed", video)) {
        expect(step).not.toMatch(/—|–/);
        expect(step.length).toBeLessThan(110);
      }
    }
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
