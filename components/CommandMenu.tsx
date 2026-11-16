"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { commandsAllowed, tabForKey } from "@/lib/commands";
import { isAppleKeyboard, isTyping, modOnly, shortcutLabel } from "@/lib/keys";
import { underLayer } from "@/lib/overlay-layers";

/* The sheet and its list load on the first open: a phone, which has no
   ⌘K to press, never fetches them. */
const CommandSheet = dynamic(() => import("@/components/CommandSheet").then((m) => m.CommandSheet), { ssr: false });

/**
 * The command menu's door (#438): the keys that open it, and the one
 * hint that says it is there.
 *
 * ⌘K (Ctrl K off a Mac) opens a search of every page and action, from
 * any screen that shows the tab bar, a lesson's page or a stored
 * recording. The screens that keep the keyboard for themselves (a
 * recording, a walk, the introduction, a form) do not answer it
 * (lib/commands.ts `commandsAllowed`). The digits 1 to 5 open the five
 * tabs in the bar's order, the shortcut the menu prints beside each;
 * a digit never fires over a field, under a sheet, or with a modifier.
 *
 * A phone has no keyboard to hold, so it sees nothing new: the hint is
 * drawn only where a fine pointer can hover and the window is wider
 * than the app's column has any use for.
 */
export function CommandMenu() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /** Whether the sheet has ever opened: it stays loaded after. */
  const [loaded, setLoaded] = useState(false);
  /** null on the server and until mounted: the key's name is the keyboard's own. */
  const [apple, setApple] = useState<boolean | null>(null);
  const allowed = commandsAllowed(path);
  /** The open sheet's own way out (its exit plays, then it unmounts): the keys close it the way Escape does. */
  const closeSheet = useRef<(() => void) | null>(null);

  useEffect(() => setApple(isAppleKeyboard()), []);
  // A screen that holds the keyboard closes a menu left open on the way in.
  useEffect(() => {
    if (!allowed) setOpen(false);
  }, [allowed]);

  const show = useCallback(() => {
    setLoaded(true);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (apple === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      if (e.key.toLowerCase() === "k" && modOnly(e, apple)) {
        if (!allowed) return;
        e.preventDefault();
        if (open) closeSheet.current?.();
        else show();
        return;
      }
      // A tab by its number: bare, never over a field or under a sheet.
      if (!allowed || open || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isTyping(e.target) || underLayer(document.body)) return;
      const href = tabForKey(e.key);
      if (!href || href === path) return;
      e.preventDefault();
      // The tab lands on its own place (#443, components/Nav.tsx).
      router.push(href, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allowed, apple, open, path, router, show]);

  return (
    <>
      {allowed && !open && apple !== null && (
        <button type="button" className="command-hint press" onClick={show} aria-keyshortcuts={apple ? "Meta+K" : "Control+K"}>
          Search
          <kbd aria-hidden className="keycap">
            {shortcutLabel("K", apple)}
          </kbd>
        </button>
      )}
      {loaded && open && <CommandSheet closeRef={closeSheet} onClose={() => setOpen(false)} />}
    </>
  );
}
