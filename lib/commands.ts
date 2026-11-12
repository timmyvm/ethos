/**
 * The command menu's list (#438): every page and action a keyboard can
 * reach by name. ⌘K (Ctrl K off a Mac) opens it; a few letters find a
 * lesson, a trait, a setting; Enter goes. The five tabs also answer to
 * the digits 1 to 5, in the bar's own order, from any screen that shows
 * the bar.
 *
 * Pure data and pure functions, so the list, its search and its rules
 * are tested without a browser (lib/commands.test.ts). The sheet is
 * components/CommandMenu.tsx.
 */

import { LESSONS } from "@/content/lessons";
import { TRAIT, TRAITS, type TraitId } from "@/content/traits";
import type { Theme } from "./prefs";
import { TAB_HREFS } from "./tabs";

export type CommandGroup = "Start" | "Go to" | "Lessons" | "Traits" | "Practice" | "Appearance" | "About Ethos";

export interface Command {
  id: string;
  title: string;
  group: CommandGroup;
  /** Where it goes. */
  href?: string;
  /** What it does instead of going somewhere. */
  theme?: Theme;
  /** Today's own practice, from the log this visit holds (lib/home.ts `todayHref`). */
  today?: true;
  /** The key that does it from any screen with the tab bar, never over a field. */
  key?: string;
  /** The trait a lesson or a trait row wears. */
  trait?: TraitId;
  /** Words it also answers to, never shown. */
  also?: string;
}

/** The tabs, in the bar's order, as the bar names them (components/Nav.tsx; a test holds the two together). */
export const TAB_LABELS = ["Today", "Lessons", "Practice", "Log", "You"] as const;

const tabs: Command[] = TAB_HREFS.map((href, i) => ({
  id: `tab:${href}`,
  title: TAB_LABELS[i],
  group: "Go to",
  href,
  key: String(i + 1),
  also: ["home", "", "games", "history recordings", "profile account me"][i],
}));

export const COMMANDS: readonly Command[] = [
  { id: "today", title: "Start today's practice", group: "Start", today: true, also: "record speak" },
  ...tabs,
  { id: "go:settings", title: "Settings", group: "Go to", href: "/settings", also: "reminder theme account preferences" },
  { id: "go:shop", title: "Shop", group: "Go to", href: "/shop", also: "coins poses freeze" },
  { id: "go:words", title: "Your words", group: "Go to", href: "/words", also: "saved swaps thesaurus" },
  ...LESSONS.map(
    (l): Command => ({
      id: `lesson:${l.id}`,
      title: l.title,
      group: "Lessons",
      href: `/lessons/${l.id}`,
      trait: l.trait,
      also: TRAIT[l.trait].name,
    })
  ),
  ...TRAITS.map(
    (t): Command => ({ id: `trait:${t.id}`, title: t.name, group: "Traits", href: `/practice/${t.id}`, trait: t.id })
  ),
  { id: "practice:boss", title: "Cold Topic", group: "Practice", href: "/boss", also: "boss weekly read explain" },
  { id: "practice:hostile", title: "Hostile Q&A", group: "Practice", href: "/hostile", also: "questions claim interrogation" },
  { id: "practice:upload", title: "Upload a recording", group: "Practice", href: "/upload", also: "file meeting" },
  { id: "theme:system", title: "Theme: System", group: "Appearance", theme: "system", also: "appearance auto" },
  { id: "theme:light", title: "Theme: Light", group: "Appearance", theme: "light", also: "appearance" },
  { id: "theme:dark", title: "Theme: Dark", group: "Appearance", theme: "dark", also: "appearance night" },
  { id: "about", title: "About", group: "About Ethos", href: "/about" },
  { id: "privacy", title: "Privacy", group: "About Ethos", href: "/privacy" },
  { id: "terms", title: "Terms", group: "About Ethos", href: "/terms" },
];

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * What a query finds, best first. Every word typed must start a word of
 * the row (its title, its group, its trait, its other names), so "pa"
 * finds Pausing and Pace and not "Up" or "space". A title that starts
 * with the query leads, then a title holding it, then the rest. A group
 * stays whole: groups are ordered by their best row, and rows inside a
 * group by how well they match, so no head is ever printed twice. The
 * list's own order breaks every tie, so an empty query is the list.
 */
export function findCommands(query: string, list: readonly Command[] = COMMANDS): Command[] {
  const q = fold(query);
  if (!q) return [...list];
  const terms = q.split(" ");
  const scored: { c: Command; score: number; at: number }[] = [];
  list.forEach((c, at) => {
    const title = fold(c.title);
    const words = `${title} ${fold(c.group)} ${fold(c.also ?? "")}`.split(" ");
    if (!terms.every((t) => words.some((w) => w.startsWith(t)))) return;
    const inTitle = terms.every((t) => title.split(" ").some((w) => w.startsWith(t)));
    scored.push({ c, at, score: title.startsWith(q) ? 0 : inTitle ? 1 : 2 });
  });
  const best = new Map<CommandGroup, { score: number; at: number }>();
  for (const s of scored) {
    const b = best.get(s.c.group);
    if (!b || s.score < b.score || (s.score === b.score && s.at < b.at)) best.set(s.c.group, { score: s.score, at: s.at });
  }
  return scored
    .sort((a, b) => {
      const ga = best.get(a.c.group)!;
      const gb = best.get(b.c.group)!;
      if (a.c.group !== b.c.group) return ga.score - gb.score || ga.at - gb.at;
      return a.score - b.score || a.at - b.at;
    })
    .map((s) => s.c);
}

/** The rows as they are drawn: each group's head over its rows, in the order found. */
export function groupCommands(found: readonly Command[]): { group: CommandGroup; rows: Command[] }[] {
  const out: { group: CommandGroup; rows: Command[] }[] = [];
  for (const c of found) {
    const last = out[out.length - 1];
    if (last && last.group === c.group) last.rows.push(c);
    else out.push({ group: c.group, rows: [c] });
  }
  return out;
}

/**
 * Screens that keep the keyboard for themselves: a recording, a walk,
 * the introduction, the camera, a form, and the pages that are not the
 * app (marketing, the workbench). The same screens the tab bar leaves
 * (components/Nav.tsx's BARE; a test holds the two together), except a
 * stored recording, which is a page to read.
 */
const HELD_SCREENS = [
  "/rep",
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

/** The tab a bare digit opens: "1" to "5", in the bar's order. */
export function tabForKey(key: string): string | null {
  return COMMANDS.find((c) => c.key === key && c.href)?.href ?? null;
}
