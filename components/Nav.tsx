"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  IconGames,
  IconLessons,
  IconLog,
  IconToday,
  IconYou,
} from "@/components/Icon";
import { prefersReducedMotion } from "@/lib/prefs";
import {
  SPRING,
  animateSpring,
  releaseVelocity,
  rubberband,
} from "@/lib/spring";
import { TAB_HREFS } from "@/lib/tabs";

/**
 * Bottom nav.
 *
 * It was label-only, on the argument that an icon row competes with the
 * rep card for attention. It doesn't — the icons are stone line marks at
 * 21px, the same weight as the words under them, while the floor card
 * carries a 26px headline and the only filled colour on the screen. What
 * the icons buy is the thing labels alone can't: a shape to aim at.
 * Four words in identical grey are four identical targets, and the tab
 * bar is the one control people hit without reading (DECISIONS #152).
 *
 * Instrument grammar (#201): the bar sits on the raised paper behind a
 * hairline; the active tab is ink at 800, inactive tabs faint — no
 * accent colour, no pill, no indicator bar. The one terracotta on a
 * screen is its tap, and a tab you are already on is not one.
 */
/*
 * Path lost its tab when the merge finished (DECISIONS #155): home has
 * carried the whole road since #141, so the tab was a second door to
 * the same room. Duolingo's precedent, from the other direction: their
 * 2022 redesign folded the tree INTO home and cut a tab doing it. The
 * freed slot is Games (#157), in Elevate's word for the same surface.
 */
/*
 * "Games" became "Tools" on 27 Aug (#184): with upload-and-analyze in
 * the menu the tab stopped being only games, and Tools is the honest
 * name for a room of lessons, bosses and analyzers. The /games route and
 * the icon identifiers keep their names: nobody reads code aloud and
 * bookmarks live (#164's rule).
 *
 * "Tools" became "Practice" on 16 Sep (#294), Timothy's call after the
 * review said nothing on the tab is a tool. The route and the icon
 * identifiers keep their names, as before.
 */
/*
 * Lessons took the second slot on 14 Sep (#275). It had been Today's
 * room since the shift: `/lessons` was reachable only through one text
 * link at the foot of the trait strip, and the tab bar highlighted
 * Today while you stood in it. Fifteen lessons behind a footer link is
 * a wardrobe, not a section.
 *
 * Five tabs at 390px is 74.8px each, comfortably over the 44px target
 * floor. The register has no truncate, so every label here stays one
 * short word: a second word wraps and the whole bar grows a line.
 *
 * At 320px a tab was 61px and PRACTICE at 11px with the register's
 * 0.10em tracking wanted about 66, so it ran into its neighbours
 * ("LESSONSPRACTICE", review 25 Sep). The labels are sentence case
 * now (`.nav-label`, Outfit 11/600, round 2), "Practice" is about 45px,
 * and under 360px the capsule gives up 8px of its stand-off a side, so
 * the narrowest tab is 56px and every word stays whole.
 *
 * The hrefs come from lib/tabs.ts, which PageTransition reads as well.
 */
const TABS = [
  { href: "/", label: "Today", Icon: IconToday },
  { href: "/lessons", label: "Lessons", Icon: IconLessons },
  { href: "/games", label: "Practice", Icon: IconGames },
  { href: "/history", label: "Log", Icon: IconLog },
  { href: "/you", label: "You", Icon: IconYou },
] satisfies readonly {
  href: (typeof TAB_HREFS)[number];
  label: string;
  Icon: (p: { size?: number; active?: boolean }) => React.ReactElement;
}[];

/**
 * Screens that own the whole viewport: the floor, onboarding, marketing,
 * and the account screens — a tab bar under a sign-up form invites people
 * to wander off mid-form. The unit intro (#210) joins them for the same
 * reason the recording screen is here: it is one instruction and one
 * button, and a tab row under the button is three ways to not press it.
 */
const BARE = [
  "/rep",
  "/lesson",
  /* A trait lesson is the same shape as a unit intro and belongs here
     for the same reason: one instruction, one button (#258). */
  "/practice",
  /* The design workbench is not an app screen at all (#255). */
  "/workbench",
  "/hostile",
  "/calibrate",
  "/welcome",
  "/about",
  "/privacy",
  "/terms",
  "/boss",
  "/signup",
  "/signin",
  "/auth",
];

/**
 * Detail screens BENEATH a tab that hide the bar, matched on the tab's
 * route plus a slash so the tab itself keeps it. One lesson (round 2,
 * B2's offer): it is a detail screen with its own Start at the foot,
 * and a tab row under that Start is five ways to not press it. Its way
 * back is the BackLink to Lessons (lib/way-out.test.ts).
 */
const DETAIL = ["/lessons"];

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const glass = useRef<HTMLDivElement>(null);
  const well = useRef<HTMLSpanElement>(null);
  /*
   * The lens (apple-design §2, §5, §6). Press anywhere on the capsule
   * and the well answers on the press, not the release; slide along it
   * and the well stays under the thumb 1:1, resisting past either end;
   * let go and it settles on the tab under the thumb, at the speed it
   * was going. A tap is still just a link.
   */
  const lens = useRef<{
    id: number;
    x0: number;
    from: number;
    x: number;
    moved: boolean;
    samples: { t: number; y: number }[];
  } | null>(null);
  const suppressClick = useRef(false);
  const [pressed, setPressed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const hidden =
    BARE.some((b) => path === b || path.startsWith(`${b}/`)) ||
    DETAIL.some((d) => path.startsWith(`${d}/`));
  /*
   * Coming back to a tab from a screen without the bar (a lesson, a
   * recording), the bar rises back in with the page's push rather than
   * appearing whole under it (round 2: one lesson hides it now, so
   * Lessons and its lesson trade it on every visit). Set while
   * rendering, React's pattern for state that follows a prop; a cold
   * load starts visible and never plays it.
   */
  const [lastHidden, setLastHidden] = useState(hidden);
  const [returned, setReturned] = useState(false);
  if (hidden !== lastHidden) {
    setLastHidden(hidden);
    setReturned(!hidden);
  }

  if (hidden) return null;

  const current = TABS.findIndex((t) =>
    t.href === "/" ? path === "/" : path.startsWith(t.href)
  );

  /** One tab's width in px: the well's travel per step. The layout
   *  width, fractional and unscaled: offsetWidth rounds (a 67.6px tab
   *  read as 68 settles the well 1.2px past its tab, then jumps back)
   *  and a rect would include the press's swell. */
  const step = () =>
    well.current ? parseFloat(getComputedStyle(well.current).width) || 0 : 0;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (current < 0 || !well.current) return;
    suppressClick.current = false;
    const from =
      new DOMMatrixReadOnly(getComputedStyle(well.current).transform).m41 || 0;
    lens.current = {
      id: e.pointerId,
      x0: e.clientX,
      from,
      x: from,
      moved: false,
      samples: [{ t: e.timeStamp, y: from }],
    };
    setPressed(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const l = lens.current;
    const el = well.current;
    if (!l || l.id !== e.pointerId || !el) return;
    const dx = e.clientX - l.x0;
    if (!l.moved) {
      // Ten pixels of intent (§10) before a press becomes a slide.
      if (Math.abs(dx) < 10) return;
      l.moved = true;
      l.x0 += Math.sign(dx) * 10;
      el.getAnimations().forEach((a) => a.cancel());
      try {
        glass.current?.setPointerCapture(e.pointerId);
      } catch {
        // A pointer the browser no longer tracks; the slide works without it.
      }
      setDragging(true);
    }
    const max = step() * (TABS.length - 1);
    const raw = l.from + (e.clientX - l.x0);
    l.x =
      raw < 0 ? rubberband(raw, step()) : raw > max ? max + rubberband(raw - max, step()) : raw;
    l.samples.push({ t: e.timeStamp, y: l.x });
    if (l.samples.length > 8) l.samples.shift();
    el.style.transform = `translateX(${l.x}px)`;
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const l = lens.current;
    if (!l || l.id !== e.pointerId) return;
    lens.current = null;
    setPressed(false);
    const el = well.current;
    if (!l.moved || !el) return;
    setDragging(false);
    suppressClick.current = true;
    const w = step();
    const velocity = releaseVelocity(l.samples);
    // The tab under the thumb, not the one momentum would reach: this
    // is a picker, and the finger's position is the choice (a sheet
    // projects, §6; a selector that overshoots the tab you let go on
    // takes the choice away). The speed still carries into the settle.
    const target = Math.max(0, Math.min(TABS.length - 1, Math.round(l.x / w)));
    void animateSpring(el, {
      axis: "x",
      from: l.x,
      to: target * w,
      velocity,
      spring: Math.abs(velocity) > 600 ? SPRING.thrown : SPRING.base,
      reduced: prefersReducedMotion(),
    }).then(() => {
      // Back to the percentage React writes, so a resize keeps it true.
      if (well.current) well.current.style.transform = `translateX(${target * 100}%)`;
    });
    if (target !== current) router.push(TABS[target].href);
  }

  function onPointerCancel() {
    lens.current = null;
    setPressed(false);
    setDragging(false);
    if (well.current) well.current.style.transform = `translateX(${current * 100}%)`;
  }

  /*
   * Glass (Timothy, 26 Sep: "new modern glass nav"): a floating bar over
   * the page, blurred, with one lit well that slides to the tab you are
   * on. Each mark carries its word under it again (round 2, wellspoken
   * home s13, Imprint's Home and Me): icons alone made five shapes to
   * learn, and four of them (a sun, a grid, a die, a list) name nothing
   * a first-time user can guess. The mark is still what the thumb aims
   * at (#152); the word is what makes the aim mean something. The word
   * is the link's name, so it is not said twice.
   */
  return (
    <nav
      aria-label="Sections"
      className={`nav-dock fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 px-5 ${
        returned ? "nav-return" : ""
      }`}
    >
      <div
        ref={glass}
        className="nav-glass relative flex h-[var(--nav-h)] items-stretch"
        data-pressed={pressed || undefined}
        data-dragging={dragging || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={(e) => {
          // The release that ended a slide is not also a tap.
          if (suppressClick.current) {
            e.preventDefault();
            suppressClick.current = false;
          }
        }}
      >
        {current >= 0 && (
          <span
            ref={well}
            aria-hidden
            className="nav-well"
            style={{ transform: `translateX(${current * 100}%)` }}
          />
        )}
        {TABS.map((t, i) => {
          const active = i === current;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              draggable={false}
              className={`nav-tab relative z-[1] flex min-w-0 flex-1 flex-col items-center justify-center rounded-full ${
                active ? "text-ink" : "text-stone-500"
              }`}
            >
              {/* Filled on the tab you are on (#290). */}
              <t.Icon size={22} active={active} />
              <span className="nav-label">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
