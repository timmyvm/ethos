/**
 * Which browser's permission furniture to describe when the mic (or
 * camera) is blocked. The steps differ enough that generic advice
 * ("check your settings") reads as a shrug, and a blocked mic is a
 * moment the user is already annoyed.
 */

export type BrowserFamily =
  | "ios-safari"
  | "safari"
  | "firefox"
  | "chromium"
  | "unknown";

export function browserFamily(ua: string): BrowserFamily {
  const u = ua.toLowerCase();
  const apple =
    /iphone|ipad|ipod/.test(u) ||
    // iPadOS reports itself as a Mac with touch; Macs don't have touch.
    (u.includes("macintosh") && typeof navigator !== "undefined" &&
      (navigator.maxTouchPoints ?? 0) > 1);
  if (apple) return "ios-safari";
  if (u.includes("firefox")) return "firefox";
  if (u.includes("safari") && !u.includes("chrome") && !u.includes("chromium")) {
    return "safari";
  }
  if (u.includes("chrome") || u.includes("chromium") || u.includes("edg")) {
    return "chromium";
  }
  return "unknown";
}

/** Step-by-step re-enable instructions, one list per family. */
export function permissionSteps(
  family: BrowserFamily,
  video: boolean
): string[] {
  const device = video ? "Microphone and Camera" : "Microphone";
  switch (family) {
    case "ios-safari":
      return [
        `Tap the aA (or puzzle) button in the address bar`,
        `Choose Website Settings`,
        `Set ${device} to Allow`,
        `If it isn't listed there: Settings app → Safari → ${device}`,
      ];
    case "safari":
      return [
        `In the menu bar, choose Safari → Settings for This Website`,
        `Set ${device} to Allow`,
        `Reload the page`,
      ];
    case "firefox":
      return [
        `Click the permissions icon left of the address bar`,
        `Remove the block next to ${device}`,
        `Reload the page and allow when asked`,
      ];
    case "chromium":
      return [
        `Click the icon left of the address bar`,
        `Open Site settings`,
        `Set ${device} to Allow`,
        `Come back and check again`,
      ];
    default:
      return [
        `Open your browser's site settings for this page`,
        `Set ${device} to Allow`,
        `Reload and try again`,
      ];
  }
}
