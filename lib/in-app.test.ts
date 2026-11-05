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

  it("knows Messenger's on both phones, never as Facebook", () => {
    const ios =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/458.0.0.41.109;FBBV/658745839;FBDV/iPhone16,2;FBMD/iPhone;FBSN/iOS;FBSV/18.7;FBSS/3;FBCR/;FBID/phone;FBLC/en_AU;FBOP/5]";
    const android =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.58 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/460.0.0.48.109;]";
    expect(inAppBrowser(ios)).toBe("Messenger");
    expect(inAppBrowser(android)).toBe("Messenger");
    expect(inAppLine(inAppBrowser(ios)!)).toMatch(/inside Messenger\./);
    // Facebook's own browser is still Facebook.
    expect(inAppBrowser("Mozilla/5.0 (Linux; Android 14; wv) Chrome/130.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0.0.48.109;]")).toBe("Facebook");
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
