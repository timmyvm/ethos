/**
 * The app inside another app's browser (#412). Testers open the link
 * Timothy sends in an Instagram group chat, and it opens in Instagram's
 * own browser: a web view with a tighter memory budget than Safari, its
 * own storage (a sign-in there is not Safari's, and the app can clear
 * it), and a camera and mic it asks for again. Vincent made both his
 * recordings there and the second was cut off at 4.5 seconds. The
 * recording screen says so and how to leave; nothing is blocked.
 */
const APPS: [RegExp, string][] = [
  [/\bInstagram\b/, "Instagram"],
  [/\bFBAN\/|\bFBAV\/|\bFB_IAB\b/, "Facebook"],
  [/\bMessenger\b|\bFBAN\/Messenger/, "Messenger"],
  [/musical_ly|BytedanceWebview|\bTikTok\b/, "TikTok"],
  [/\bSnapchat\b/, "Snapchat"],
];

/** The app whose browser this is, or null in a real browser. */
export function inAppBrowser(ua: string): string | null {
  for (const [re, name] of APPS) if (re.test(ua)) return name;
  return null;
}

/** What the recording screen says under the toggle. */
export function inAppLine(app: string): string {
  return `Recording is steadier in your browser than inside ${app}. Open the ••• menu and choose your browser.`;
}
