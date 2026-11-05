import { describe, expect, it } from "vitest";
import { inAppBrowser, inAppLine } from "./in-app";

describe("the app inside another app's browser (#412)", () => {
  it("knows Instagram's browser, Vincent's", () => {
    const vincent =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 453.0.0.39.58 (iPhone17,1; iOS 26_5_2; en_AU; en; scale=3.00; 1206x2622; IAB)";
    expect(inAppBrowser(vincent)).toBe("Instagram");
  });

  it("knows Facebook's and TikTok's", () => {
    expect(inAppBrowser("Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]")).toBe("Facebook");
    expect(inAppBrowser("Mozilla/5.0 (Linux; Android 14) musical_ly_2023")).toBe("TikTok");
  });

  it("leaves Safari, Chrome and the home-screen app alone", () => {
    expect(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1")).toBeNull();
    expect(inAppBrowser("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36")).toBeNull();
    expect(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148")).toBeNull();
  });

  it("speaks plainly", () => {
    const s = inAppLine("Instagram");
    expect(s).not.toMatch(/—|–/);
    expect(s).not.toMatch(/\b(gym|workout|drill|rep|training)\b/i);
  });
});
