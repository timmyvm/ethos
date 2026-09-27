"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconBack } from "@/components/Icon";

/**
 * The top of every tab and every screen one step off it: a large title
 * that hands over to a small one in a frosted bar as it scrolls away
 * (the apple-design skill: §12 materials, §16 wayfinding, familiarity).
 *
 * Every screen used to set its own title: 24/800 here, 26/700 there, a
 * wordmark on Today, a text "← You" link on Settings. Things that look
 * the same must live in the same place, so there is one of these, and
 * the answer to "where am I?" is always the same size in the same spot.
 *
 *  - At rest the bar is empty and clear: the large title IS the header.
 *  - The moment content passes under it, the bar becomes material
 *    (blur, a tint of the ground, and a soft fade at its lower edge
 *    instead of a hairline, §12's scroll edge effect).
 *  - Once the large title is gone, its small twin fades up in the bar,
 *    so the name of the screen never leaves it.
 *  - Pulled past the top (iOS rubber-banding), the large title swells a
 *    little from its leading edge, the way the system's does.
 *
 * It sits inside the screen's `main` (px-5 pt-7) and reaches out to its
 * edges itself, so a screen adopts it by replacing its h1 and nothing
 * else.
 */
export function ScreenHeader({
  title,
  eyebrow,
  dated = false,
  back,
  trailing,
  barTrailing,
}: {
  title: string;
  /** A line above the title, as Apple's apps put the date over Today. */
  eyebrow?: React.ReactNode;
  /**
   * Today's date as the eyebrow. Written after mount, in the device's
   * own zone and words: the server cannot know either, and a date that
   * disagrees between the two is a hydration error. The line holds its
   * height meanwhile so nothing moves when it lands.
   */
  dated?: boolean;
  /** A screen one step in: where back goes and what it is called. */
  back?: { href: string; label: string };
  /** Beside the large title, baseline-aligned (chips, a balance). */
  trailing?: React.ReactNode;
  /** In the bar's right slot, always visible (a Settings button). */
  barTrailing?: React.ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    if (!dated) return;
    setDate(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    );
  }, [dated]);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const h = heading.current;
      const b = bar.current;
      if (!h || !b) return;
      const y = window.scrollY;
      const barBottom = b.getBoundingClientRect().bottom;
      const rect = h.getBoundingClientRect();
      setEdge(y > 2);
      setCollapsed(rect.bottom - 6 < barBottom);
      // Overscroll only exists on a rubber-banding browser; elsewhere
      // scrollY never goes negative and this is always 1.
      const swell = y < 0 ? Math.min(1.1, 1 - y / 900) : 1;
      h.style.transform = swell === 1 ? "" : `scale(${swell})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div
        ref={bar}
        className="screen-bar"
        data-edge={edge || undefined}
        data-collapsed={collapsed || undefined}
      >
        <div className="screen-bar-side">
          {back && (
            <Link href={back.href} className="screen-bar-back press">
              <IconBack size={22} />
              <span>{back.label}</span>
            </Link>
          )}
        </div>
        <div className="screen-bar-title" aria-hidden>
          {title}
        </div>
        <div className="screen-bar-side justify-end">{barTrailing}</div>
      </div>
      <div className="large-title-row">
        <div className="min-w-0">
          {dated ? (
            <div className="large-title-eyebrow">{date ?? "\u00a0"}</div>
          ) : (
            eyebrow && <div className="large-title-eyebrow">{eyebrow}</div>
          )}
          <h1 ref={heading} className="large-title">
            {title}
          </h1>
        </div>
        {trailing && <div className="large-title-trailing">{trailing}</div>}
      </div>
    </>
  );
}

/**
 * The same way back as the bar's, for a screen whose title lives in
 * its own card (a lesson, a stored recording): the chevron and the
 * name of where it goes, never a text arrow.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="screen-bar-back press -ml-2.5">
      <IconBack size={22} />
      <span>{label}</span>
    </Link>
  );
}
