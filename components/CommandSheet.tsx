"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IconSearch } from "@/components/Icon";
import { applyTheme } from "@/components/Theme";
import { Overlay, useOverlayClose } from "@/components/ui/Overlay";
import { heldReps } from "@/lib/client-data";
import { findCommands, groupCommands, type Command } from "@/lib/commands";
import { todayHref } from "@/lib/home";
import { writePrefs } from "@/lib/prefs";

/**
 * The command menu (#438): one field over every page and action.
 *
 * A sheet like every other sheet (Overlay: Escape, the scrim, a pull
 * down, focus held and handed back), at one height, so the field never
 * moves while the list under it changes. The field is a combobox and
 * the list its listbox: the arrows move the lit row, Enter opens it,
 * and focus never leaves the field. A row that has a key of its own
 * prints it. A pointer lights the row it is over; a click opens it.
 */
export function CommandSheet({
  onClose,
  closeRef,
}: {
  onClose: () => void;
  /** Filled with the sheet's own way out while it is open, for the keys that opened it. */
  closeRef?: React.RefObject<(() => void) | null>;
}) {
  return (
    /* The panel takes the column's width itself: a sheet sizes to its
       content, and a list of short names is narrower than the column. */
    <Overlay label="Search Ethos" onClose={onClose} className="w-full max-w-[430px]">
      <Menu onClose={onClose} closeRef={closeRef} />
    </Overlay>
  );
}

function Menu({ onClose, closeRef }: { onClose: () => void; closeRef?: React.RefObject<(() => void) | null> }) {
  const router = useRouter();
  const close = useOverlayClose(onClose);
  useEffect(() => {
    if (!closeRef) return;
    closeRef.current = close;
    return () => {
      closeRef.current = null;
    };
  }, [close, closeRef]);
  const field = useRef<HTMLInputElement>(null);
  const listbox = useRef<HTMLDivElement>(null);
  const id = useId();
  const [query, setQuery] = useState("");
  const found = useMemo(() => findCommands(query), [query]);
  const groups = useMemo(() => groupCommands(found), [found]);
  const [lit, setLit] = useState(0);
  const at = Math.min(lit, Math.max(0, found.length - 1));
  const active = found[at] ?? null;

  /* The sheet takes focus for itself as it opens (Overlay); the field
     takes it a beat later, so a letter typed lands in it. */
  useEffect(() => {
    const t = setTimeout(() => field.current?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(t);
  }, []);

  // The lit row stays in view as the arrows move it.
  useEffect(() => {
    if (!active) return;
    listbox.current?.querySelector<HTMLElement>(`[data-command="${CSS.escape(active.id)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (c: Command) => {
    if (c.theme) {
      writePrefs({ theme: c.theme });
      applyTheme(c.theme);
    } else {
      const href = c.today ? todayHref(heldReps() ?? []) : c.href;
      if (href) router.push(href);
    }
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const n = found.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (n > 0) setLit((at + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
    } else if (e.key === "Home" && n > 0 && query === "") {
      e.preventDefault();
      setLit(0);
    } else if (e.key === "End" && n > 0 && query === "") {
      e.preventDefault();
      setLit(n - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active) run(active);
    }
  };

  return (
    <div className="command-sheet elev-3 flex w-full flex-col rounded-t-sheet bg-raised">
      <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-stone-300" />
      <div className="command-field">
        <span className="text-stone-400">
          <IconSearch size={20} />
        </span>
        <input
          ref={field}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-activedescendant={active ? `${id}-${active.id}` : undefined}
          aria-autocomplete="list"
          aria-label="Search pages and actions"
          placeholder="Search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLit(0);
          }}
          onKeyDown={onKeyDown}
          className="command-input"
        />
        <button type="button" onClick={close} className="command-esc press" aria-label="Close">
          <kbd aria-hidden className="keycap">
            esc
          </kbd>
        </button>
      </div>
      <div ref={listbox} id={`${id}-list`} role="listbox" aria-label="Pages and actions" className="command-list">
        {found.length === 0 ? (
          <p role="status" className="px-3 py-6 text-center text-body text-stone-500">
            Nothing called “{query.trim()}”.
          </p>
        ) : (
          groups.map((g, gi) => (
            <div key={`${g.group}-${gi}`} role="group" aria-label={g.group}>
              <p aria-hidden className="eyebrow command-group">
                {g.group}
              </p>
              {g.rows.map((c) => (
                <div
                  key={c.id}
                  id={`${id}-${c.id}`}
                  role="option"
                  aria-selected={c === active}
                  data-command={c.id}
                  data-trait={c.trait}
                  className="command-row"
                  onPointerMove={() => c !== active && setLit(found.indexOf(c))}
                  onClick={() => run(c)}
                >
                  {c.trait && <span aria-hidden className="trait-dot" />}
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  {c.key && (
                    <kbd className="keycap" aria-label={`Shortcut ${c.key}`}>
                      {c.key}
                    </kbd>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
