/**
 * The command menu's keys, without the menu (#508, the speed audit's
 * fix 18). components/CommandMenu.tsx is in every page's layout and
 * needs only two answers on every key press: whether this screen answers
 * the menu at all, and which tab a digit opens. They lived in
 * lib/commands.ts beside the menu's whole list, which imports every
 * lesson and through them the 365 topics, so every page carried them for
 * a sheet a phone never opens. The list stays there, loaded with the
 * sheet (components/CommandSheet.tsx); these two live here, on the tab
 * bar's hrefs alone.
 */
import { TAB_HREFS } from "./tabs";

/**
 * Screens that keep the keyboard for themselves: a recording, a walk,
 * the introduction, the camera, a form, and the pages that are not the
 * app (marketing, the workbench). The same screens the tab bar leaves
 * (components/Nav.tsx's BARE; a test holds the two together), except a
 * stored recording, which is a page to read.
 */
export const HELD_SCREENS = [
  "/rep",
  /* Say it better's test (#507): a line is being recorded. */
  "/say/test",
  "/lesson",
  "/practice",
  "/workbench",
  "/hostile",
  "/calibrate",
  "/welcome",
  "/tester",
  "/active",
  "/about",
  "/privacy",
  "/terms",
  "/boss",
  "/signup",
  "/signin",
  "/auth",
] as const;

/** Whether the menu and its shortcuts answer on this screen. */
export function commandsAllowed(path: string): boolean {
  if (/^\/rep\/[\w-]+$/.test(path)) return true;
  return !HELD_SCREENS.some((s) => path === s || path.startsWith(`${s}/`));
}

/** The tab a bare digit opens: "1" to "5", in the bar's order (the menu prints the same keys). */
export function tabForKey(key: string): string | null {
  if (!/^[1-9]$/.test(key)) return null;
  return TAB_HREFS[Number(key) - 1] ?? null;
}
