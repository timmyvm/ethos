/**
 * The keyboard, named the way the person's own keyboard names it (#438):
 * a shortcut shown on screen reads ⌘ on a Mac and Ctrl everywhere else.
 * Asked after mount, never on the server, which cannot know.
 */

/** Whether this is an Apple keyboard, from what the browser will say. */
export function isAppleKeyboard(nav: { platform?: string; userAgent?: string } | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  if (!nav) return false;
  return /mac|iphone|ipad|ipod/i.test(`${nav.platform ?? ""} ${nav.userAgent ?? ""}`);
}

/** The modifier's label: "⌘" on a Mac, "Ctrl" elsewhere. */
export function modLabel(apple: boolean): string {
  return apple ? "⌘" : "Ctrl";
}

/** A shortcut as it is printed: "⌘K" on a Mac, "Ctrl K" elsewhere. */
export function shortcutLabel(key: string, apple: boolean): string {
  return apple ? `⌘${key}` : `Ctrl ${key}`;
}

/** The platform's own modifier is down, and no other: ⌘ on a Mac, Ctrl elsewhere. */
export function modOnly(e: { metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }, apple: boolean): boolean {
  if (e.altKey || e.shiftKey) return false;
  return apple ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
}

/**
 * Whether a key press belongs to something being typed: a field, a
 * select, anything editable. A shortcut never fires over one.
 */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as (Element & { isContentEditable?: boolean }) | null;
  if (!el || typeof el.tagName !== "string") return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag !== "input") return false;
  const type = (el.getAttribute("type") ?? "text").toLowerCase();
  return !["button", "checkbox", "radio", "range", "submit", "reset", "file", "color"].includes(type);
}
