/**
 * Where a back control goes, and what it says (D18).
 *
 * Every back in the app names its parent: the Shop says "You", one
 * lesson says "Lessons", the recording says "Today". Two screens said
 * "Back" because more than one tab opens them: the trait page
 * (`/practice/[trait]`, from Today's tiles) and the unit's teaching
 * screen (`/lesson/[unit]`, from Today's Start, the Log's Go and You's
 * trait sheet). The door that opens one passes `?from=`, the way the
 * Settings doors pass `?from=settings`, and the screen reads it here.
 * With no param, each screen falls back to the tab that owns it.
 */
export const FROM = {
  today: { href: "/", label: "Today" },
  lessons: { href: "/lessons", label: "Lessons" },
  log: { href: "/history", label: "Log" },
  you: { href: "/you", label: "You" },
} as const;

export type From = keyof typeof FROM;

const known = (param: string | null | undefined): param is From =>
  typeof param === "string" && Object.prototype.hasOwnProperty.call(FROM, param);

/** The parent a `?from=` value names, or the screen's owning tab. */
export function backFrom(
  param: string | null | undefined,
  fallback: From
): (typeof FROM)[From] {
  return known(param) ? FROM[param] : FROM[fallback];
}

/** The `From` a `?from=` value names, or undefined for anything else. */
export function fromParam(param: string | null | undefined): From | undefined {
  return known(param) ? param : undefined;
}

/** `href` with `from=` added, keeping any query and hash it already has. */
export function withFrom(href: string, from: From | undefined): string {
  if (!from) return href;
  const hash = href.indexOf("#");
  const base = hash === -1 ? href : href.slice(0, hash);
  const tail = hash === -1 ? "" : href.slice(hash);
  return `${base}${base.includes("?") ? "&" : "?"}from=${from}${tail}`;
}
