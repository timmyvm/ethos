"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The paywall's way back (docs/ladder-spec.md, "Needs an account"). A
 * plan needs a real account, so the sheet sends someone to /signup or
 * /signin with `next=` set to the page they were on plus `paywall=1`,
 * and that page reopens the sheet when they land back on it. Checkout's
 * back arrow comes home the same way.
 *
 * The pages that open the paywall mount `usePaywallReturn`; the auth
 * screens read `next` through `useNextPath` and carry it through the
 * inbox link and Google's round trip (lib/auth.ts `withNext`), and the
 * pages those land on send them on with `onwardLink`. Both read the URL after
 * mount, never during render, so nothing here touches the server render.
 */

/** The query flag that reopens the sheet. */
export const PAYWALL_PARAM = "paywall";

/**
 * A path this app may send somebody to after signing in: same-origin and
 * absolute, with no scheme, no `//host`, no backslash or control
 * character, and never an auth screen (which would loop). Null for
 * anything else.
 */
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 512) return null;
  try {
    const base = "https://ethos.invalid";
    const url = new URL(path, base);
    if (url.origin !== base) return null;
    if (/^\/(signin|signup|auth)(\/|$)/.test(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** `path` with `paywall=1` set, keeping its other query and its hash. */
export function withPaywall(path: string): string {
  const url = new URL(path, "https://ethos.invalid");
  url.searchParams.set(PAYWALL_PARAM, "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `path` without the flag, for the URL a page keeps once the sheet is open. */
export function withoutPaywall(path: string): string {
  const url = new URL(path, "https://ethos.invalid");
  url.searchParams.delete(PAYWALL_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The door to an auth screen that comes back to `next`: `/signup?next=%2Fgames%3Fpaywall%3D1`. */
export function authHref(screen: "signup" | "signin", next: string | null): string {
  const safe = next ? safeNextPath(next) : null;
  return safe ? `/${screen}?next=${encodeURIComponent(safe)}` : `/${screen}`;
}

/** True when a path asks for the paywall to reopen. */
export function asksForPaywall(path: string): boolean {
  try {
    return new URL(path, "https://ethos.invalid").searchParams.get(PAYWALL_PARAM) === "1";
  } catch {
    return false;
  }
}

/**
 * The safe `next` in a query string or a path with one ("?next=…", or
 * the "/signup?next=…" a Google attempt began on), or null.
 */
export function nextFrom(search: string | null | undefined): string | null {
  if (!search) return null;
  try {
    const q = search.includes("?") ? search.slice(search.indexOf("?") + 1) : search;
    return safeNextPath(new URLSearchParams(q).get("next"));
  } catch {
    return null;
  }
}

/**
 * The tap at the end of an account page (a confirmed email, a password
 * set, Google done): on to the page that asked, named for the sheet it
 * reopens, or the floor when nothing asked.
 */
export function onwardLink(next: string | null): { href: string; label: string } {
  const safe = next ? safeNextPath(next) : null;
  if (!safe) return { href: "/", label: "Back to the floor" };
  return { href: safe, label: asksForPaywall(safe) ? "Back to Premium" : "Carry on" };
}

/**
 * Reopens the paywall on a page someone came back to with `paywall=1`:
 * once, after mount, and then takes the flag out of the address with
 * `history.replaceState`, so a reload or a shared link does not open it
 * again. `open` is the page's own setter, e.g.
 * `usePaywallReturn(() => setPaywall({ reason: "Premium" }))`.
 */
export function usePaywallReturn(open: () => void): void {
  const opener = useRef(open);
  opener.current = open;
  useEffect(() => {
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (!asksForPaywall(here)) return;
    try {
      window.history.replaceState(window.history.state, "", withoutPaywall(here));
    } catch {
      // A browser that refuses the rewrite still opens the sheet.
    }
    opener.current();
  }, []);
}

/**
 * The auth screens' `next`, read after mount and checked by
 * `safeNextPath`: null until then, and for anything unsafe.
 */
export function useNextPath(): string | null {
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    setNext(safeNextPath(new URLSearchParams(window.location.search).get("next")));
  }, []);
  return next;
}
