import { useCallback, useEffect, useState } from "react";

/**
 * An hour of the day, said the way this device says it (you-21,
 * recording-21, intro-b-19): "9 pm" in Melbourne, "21" in Berlin, "9 PM"
 * in New York. Intl picks the words, so the app never decides whether a
 * person reads a 12 or a 24 hour clock.
 *
 * The server cannot know the device's locale, and a label that differs
 * between the server's HTML and the first client render is a hydration
 * error (#418). So `useHourLabel` says the padded 24 hour form ("21:00"),
 * which reads in every locale, until the component has mounted, and the
 * device's own form after that. Both renders agree, then it settles.
 */

/** "9 pm", "21", "9 PM": the device's hour for `h` (0 to 23). */
export function formatHour(h: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "numeric" }).format(new Date(2000, 0, 1, h));
}

/** The locale-free form both renders can agree on: "09:00", "21:00". */
export function padHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/**
 * A labeller for hours: `padHour` until mounted, `formatHour` after.
 *
 *   const hour = useHourLabel();
 *   <span>{hour(21)}</span>   // "21:00" on the server, "9 pm" on the device
 */
export function useHourLabel(): (h: number) => string {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return useCallback((h: number) => (mounted ? formatHour(h) : padHour(h)), [mounted]);
}
