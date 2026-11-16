/**
 * Settings, done properly (#479): what the index's rows say about the
 * page each opens, and the small rules the pages share. Pure, so the
 * words are held by `lib/settings-index.test.ts`.
 *
 * The index is a grouped list in Duolingo's order (Timothy's reference,
 * 16 Nov), drawn in Ethos's own grouped list: every row opens its own
 * page and shows the value that page holds, the way a phone's Settings
 * says "6 pm" beside Notifications.
 */

import type { Theme } from "./prefs";
import type { PlanKind } from "./plan-view";
import type { PainId } from "./answers";
import { MAX_PAINS } from "./answers";
import { GOALS, PAINS } from "@/content/portfolio";

/** Every page under /settings, in the index's order, with its title. */
export const SETTINGS_PAGES = [
  { href: "/settings/profile", title: "Profile" },
  { href: "/settings/account", title: "Account" },
  { href: "/settings/notifications", title: "Notifications" },
  { href: "/settings/plan", title: "Plan" },
  { href: "/settings/practice", title: "Practice" },
  { href: "/settings/appearance", title: "Appearance" },
  { href: "/settings/accessibility", title: "Accessibility" },
  { href: "/settings/data", title: "Privacy and data" },
  { href: "/settings/help", title: "Help" },
] as const;

/** Pages one step further in, each with its parent. */
export const SETTINGS_SUBPAGES = [
  { href: "/settings/account/email", title: "Change email", parent: "/settings/account" },
  { href: "/settings/account/password", title: "Password", parent: "/settings/account" },
  { href: "/settings/practice/focus", title: "Focus", parent: "/settings/practice" },
  { href: "/settings/profile/goal", title: "Goal", parent: "/settings/profile" },
  { href: "/settings/data/stored", title: "What Ethos keeps", parent: "/settings/data" },
] as const;

/** The reminder's row: its hour, or Off. */
export function reminderValue(hour: number | null, label: (h: number) => string): string {
  return hour === null ? "Off" : label(hour);
}

/** The plan's row: Premium or Free, or nothing while it is unknown (a dash is drawn, never Free). */
export function planWord(kind: PlanKind | null): "Premium" | "Free" | null {
  if (kind === null || kind === "unknown") return null;
  if (kind === "free" || kind === "ended") return "Free";
  return "Premium";
}

/** The theme's row: the word on its segment. */
export function themeWord(theme: Theme): string {
  return `${theme[0].toUpperCase()}${theme.slice(1)}`;
}

/** The focus's row: what the introduction heard you notice, said back ("Fillers", "Rushing"). */
export function focusWord(pain: string | null | undefined): string {
  const said = PAINS.find((p) => p.id === pain)?.said;
  return said ? `${said[0].toUpperCase()}${said.slice(1)}` : "Not set";
}

/** The goal's row: the introduction's answer, as it was offered. */
export function goalWord(goal: string | null | undefined): string {
  return GOALS.find((g) => g.id === goal)?.label ?? "Not set";
}

/**
 * A new focus: the introduction's answers keep up to three things noticed
 * and the first is the focus (lib/portfolio.ts reads `pains[0]`). Picking
 * one puts it first and keeps the others in their order behind it.
 */
export function withFocus(pains: readonly PainId[], focus: PainId): PainId[] {
  return [focus, ...pains.filter((p) => p !== focus)].slice(0, MAX_PAINS);
}

/**
 * Restore purchases is a row for the native build (an App Store plan is
 * restored through Apple), so it is drawn only inside it: the shell will
 * name itself in its user agent. Never on the web, where Stripe holds
 * the plan and the account brings it back on any device.
 */
export function restoreOffered(userAgent: string): boolean {
  return /\bEthosApp\//.test(userAgent);
}
