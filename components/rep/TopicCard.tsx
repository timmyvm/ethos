"use client";

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { artBox, objectSrc } from "@/lib/home";
import { ART_BOUNDS } from "@/lib/lesson-art-bounds";
import { DURATION, EASE_OUT } from "@/lib/motion";
import type { PracticeFamily } from "@/lib/practice-family";
import { prefersReducedMotion } from "@/lib/prefs";
import { SPRING, springEasing, springMs } from "@/lib/spring";

/** Clear space between the object's box and the words, either side. */
const CLEAR = 8;
/** The smallest the object stands at where the band is short (a 375x667
 *  phone's band holds about 80): below it, it is not drawn. */
const MIN_BOX = 72;

/*
 * Start carries the card (E51, B02). Today's Start runs its navigation
 * inside a view transition whose update resolves when this card is on
 * the page with its object settled (`topicCardArrival`). Where the
 * browser has no view transitions, Today leaves its card's rect in
 * sessionStorage ("ethos.cardFrom") and this card starts from it and
 * springs home (`flipFrom`).
 */
let arrived: (() => void) | null = null;

/** Resolves when the next topic card has mounted and settled (1.5s at most). */
export function topicCardArrival(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(t);
      arrived = null;
      resolve();
    };
    const t = setTimeout(done, 1500);
    arrived = done;
  });
}

/** Where Today's card and object stood when Start was pressed. */
export const CARD_FROM_KEY = "ethos.cardFrom";
export interface CardFrom {
  card: { x: number; y: number; w: number; h: number };
  object: { x: number; y: number; w: number; h: number } | null;
  at: number;
}

function readCardFrom(): CardFrom | null {
  try {
    const raw = sessionStorage.getItem(CARD_FROM_KEY);
    sessionStorage.removeItem(CARD_FROM_KEY);
    if (!raw) return null;
    const from = JSON.parse(raw) as CardFrom;
    return Date.now() - from.at < 1500 ? from : null;
  } catch {
    return null;
  }
}

/** The transform that puts `el` where `r` was. */
function fromRect(el: Element, r: CardFrom["card"]) {
  const now = el.getBoundingClientRect();
  if (now.width === 0 || now.height === 0) return null;
  const sx = r.w / now.width;
  const sy = r.h / now.height;
  return { dx: r.x - now.left, dy: r.y - now.top, sx, sy };
}

/**
 * What you are about to talk about, as the hero (feedback round, 25 Sep).
 *
 * The topic is the biggest thing on the screen, in display type on the
 * practice's own colour (D50): the trait family Today's card wore when
 * Start was pressed (`.family-fill`, the same layer and tokens as
 * `.home-hero`), white words at radius 28, so the day's colour carries
 * through the app's most important transition. A practice that
 * measures no one trait (the boss, a game) stands on the sky stage.
 *
 * Its top band holds the glass object Today's card held (E51,
 * `recordingObject`), at the card's top right, 16px in, in a 112px box
 * (96 under 360). The object is sized by the box its visible pixels
 * fill (lib/lesson-art-bounds.ts), as Today's is, and it stands only
 * where the band has the room: the box clears the eyebrow's words and
 * the topic's first line by 8px, stepping down to as little as 72px
 * where the band is short (a 375x667 phone), or it is not drawn. On
 * Record it scales to 0.6 on the card's own shrink spring and fades in
 * 120ms, before the topic's compact lines reach its corner.
 *
 * Demos is not on it: he arrives as the listener when Record is
 * pressed (D51), so the prompt is the one thing to read while idle.
 */
export function TopicCard({
  eyebrow,
  topic,
  family,
  art,
  compact = false,
}: {
  eyebrow: string;
  topic: string;
  family: PracticeFamily;
  /** The lesson object to stand in the top band, idle only. */
  art?: string | null;
  /** While the clock runs: the same card, a size down, at the top. */
  compact?: boolean;
}) {
  const card = useRef<HTMLElement>(null);
  const zone = useRef<HTMLSpanElement>(null);
  const brow = useRef<HTMLSpanElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  /* Whether the band has the room, measured before paint, and the box
     it has room for: the full 112 (96 under 360), or down to 72 where
     the band is shorter. */
  const [fits, setFits] = useState(false);
  const [boxPx, setBoxPx] = useState<number | null>(null);
  const [measured, setMeasured] = useState(!art);
  const [loaded, setLoaded] = useState(false);

  useLayoutEffect(() => {
    /* Measured while idle only: on Record the object leaves on the
       card's spring, and a card shrinking under it is not a reason to
       cut it. */
    if (!art || compact) return;
    const el = card.current;
    const measure = () => {
      const z = zone.current?.getBoundingClientRect();
      const h = head.current?.getBoundingClientRect();
      const e = brow.current?.getBoundingClientRect();
      if (!z || !h || !e || z.width === 0) return;
      const b = ART_BOUNDS[art];
      const w = b ? b.r - b.l : 0.43;
      const t = b ? b.b - b.t : 0.84;
      /* The box the band holds: the full box, or what is left over the
         topic's first line (the box is pinned top right, so its top and
         right edges never move). */
      const full = window.matchMedia("(max-width: 359px)").matches ? 96 : 112;
      const size = Math.min(full, Math.floor(h.top - CLEAR - z.top));
      /* The visible object's width inside the box, centred across it. */
      const shown = Math.min(1, w / t) * size;
      const left = z.right - size + (size - shown) / 2;
      setFits(size >= MIN_BOX && e.right + CLEAR <= left);
      setBoxPx(size < full ? size : null);
      setMeasured(true);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (el) ro.observe(el);
    if (head.current) ro.observe(head.current);
    return () => ro.disconnect();
  }, [art, compact]);

  /* Record: the object scales to 0.6 and fades on the card's own shrink
     spring (app/rep/page.tsx glides the card on SPRING.base), into the
     card's corner. Reduced motion: a 200ms fade. */
  useLayoutEffect(() => {
    const el = img.current;
    if (!el) return;
    if (!compact) {
      el.getAnimations().forEach((a) => a.cancel());
      return;
    }
    const reduced = prefersReducedMotion();
    if (reduced) {
      el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: DURATION.base,
        easing: EASE_OUT,
        fill: "forwards",
      });
      return;
    }
    /* The fade runs on its own short clock (120ms, ease-out, so all but
       gone by 80): the topic steps down to its compact size at once,
       and at the spring's pace its lines printed over the half-faded
       glass for the first frames (R2F-05). The shrink keeps the spring. */
    el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: DURATION.fast,
      easing: EASE_OUT,
      fill: "forwards",
    });
    el.animate([{ transform: "scale(1)" }, { transform: "scale(0.6)" }], {
      duration: springMs(SPRING.base),
      easing: springEasing(SPRING.base),
      fill: "forwards",
    });
  }, [compact]);

  /* Arrived: on the page, measured, and its object drawn if it has
     one, so the view transition's new state is the card as it rests. */
  const settled = measured && (!art || !fits || loaded);
  useLayoutEffect(() => {
    if (settled) arrived?.();
  }, [settled]);

  /* No view transitions: start where Today's card stood and spring home
     on the base spring, the radius held at 28 while the card scales; the
     object flies from Today's corner on the same spring, joining the
     card's clock when its file lands. Reduced motion: a 200ms fade. The
     card moves from its first measured frame, so it never shows at rest
     first and then jumps back. */
  const flight = useRef<{
    from: CardFrom;
    c: DOMRect;
    f: NonNullable<ReturnType<typeof fromRect>>;
    anim: Animation;
  } | null>(null);
  const flipped = useRef(false);
  useLayoutEffect(() => {
    if (!measured || flipped.current || compact) return;
    flipped.current = true;
    const from = readCardFrom();
    const el = card.current;
    if (!from || !el) return;
    if (prefersReducedMotion()) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION.base, easing: EASE_OUT });
      return;
    }
    const c = el.getBoundingClientRect();
    const f = fromRect(el, from.card);
    if (!f) return;
    el.style.transformOrigin = "0 0";
    const anim = el.animate(
      [
        {
          transform: `translate(${f.dx}px, ${f.dy}px) scale(${f.sx}, ${f.sy})`,
          borderRadius: `${28 / f.sx}px / ${28 / f.sy}px`,
        },
        { transform: "none", borderRadius: "28px" },
      ],
      { duration: springMs(SPRING.base), easing: springEasing(SPRING.base) }
    );
    void anim.finished.then(() => el.style.removeProperty("transform-origin"), () => {});
    /* The card's box scales unevenly (Today's is taller), so its words
       take the inverse on the same spring and keep their shape (R4:
       the eyebrow and the topic were drawn 22% tall for 300ms). They
       still ride where the card puts them. */
    for (const words of [brow.current?.parentElement, head.current]) {
      if (!words) continue;
      words.style.transformOrigin = "0 0";
      const own = words.animate(
        [{ transform: `scale(${1 / f.sx}, ${1 / f.sy})` }, { transform: "none" }],
        { duration: springMs(SPRING.base), easing: springEasing(SPRING.base) }
      );
      void own.finished.then(() => words.style.removeProperty("transform-origin"), () => {});
    }
    flight.current = { from, c, f, anim };
  }, [measured, compact]);

  useLayoutEffect(() => {
    const o = img.current;
    const fl = flight.current;
    if (!loaded || !o || !fl || !fl.from.object || fl.anim.playState === "finished") return;
    /* Solved against the card's transform at its start, so the two
       composed put the object on Today's; started at the card's own
       time, so they move as one. */
    const at = Number(fl.anim.currentTime ?? 0);
    const ob = o.getBoundingClientRect();
    if (ob.width === 0) return;
    /* `ob` was read with the card mid-flight: undo the card's transform
       at that moment to find the object's resting box. */
    const { from, c, f } = fl;
    const rest = (() => {
      const m = new DOMMatrix(getComputedStyle(card.current!).transform);
      const inv = m.inverse();
      const p = inv.transformPoint(new DOMPoint(ob.left - c.left, ob.top - c.top));
      return { left: p.x + c.left, top: p.y + c.top, width: ob.width / m.a, height: ob.height / m.d };
    })();
    const t = from.object!;
    const sx = t.w / rest.width / f.sx;
    const sy = t.h / rest.height / f.sy;
    const dx = (t.x - f.dx - c.left) / f.sx + c.left - rest.left;
    const dy = (t.y - f.dy - c.top) / f.sy + c.top - rest.top;
    o.style.transformOrigin = "0 0";
    const own = o.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: "none" }],
      { duration: springMs(SPRING.base), easing: springEasing(SPRING.base) }
    );
    own.currentTime = at;
    /* Record's shrink scales it into the card's corner again. */
    void own.finished.then(() => o.style.removeProperty("transform-origin"), () => {});
  }, [loaded]);

  /* A cached file can finish before React sees its load event. */
  const imgRef = useCallback((node: HTMLImageElement | null) => {
    img.current = node;
    if (node?.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  const show = Boolean(art) && fits;
  return (
    <section
      ref={card}
      aria-label="Your topic"
      data-family={family}
      /* Today's card moves into this one (E51): one name, both screens. */
      style={{ viewTransitionName: "practice-card" }}
      /* Idle, it stands as tall as the room allows (Today's card is
         376): the eyebrow at the top, the topic at the foot, and the
         idle screen's free height in the card rather than over it. The
         recording screen's column gives it that height, 168 to 300.
         Under 600pt tall (320x568) it is as tall as its words, so
         Record rises into view (F12). */
      className={`family-fill vt-shared flex flex-col p-5 ${
        compact ? "" : "min-h-[168px] flex-1 justify-between pb-6 [@media(max-height:600px)]:min-h-0"
      }`}
    >
      {art && (
        /* The object's box: 112px, 16px in from the top and the right
           (96 under 360). The picture inside is sized and stood by its
           visible pixels (`artBox`), centred across the box, its top on
           the box's top, as Today's card stands its object. */
        <span
          ref={zone}
          aria-hidden
          className="pointer-events-none absolute right-4 top-4 size-[112px] max-[359px]:size-[96px]"
          style={
            {
              ...artBox(art),
              "--s": "min(calc(100% / var(--art-h)), calc(100% / var(--art-w)))",
              ...(boxPx !== null ? { width: boxPx, height: boxPx } : {}),
            } as CSSProperties
          }
        >
          {show && (
            // eslint-disable-next-line @next/next/no-img-element -- lesson art is a plain img (#274)
            <img
              ref={imgRef}
              src={objectSrc(art, true)}
              alt=""
              width={112}
              height={112}
              draggable={false}
              onLoad={() => setLoaded(true)}
              data-loaded={loaded || undefined}
              className="topic-art vt-shared absolute max-w-none origin-top-right select-none opacity-0 transition-opacity dur-max ease-out drop-shadow-[0_14px_18px_rgb(8_20_70/0.38)] data-[loaded]:opacity-100 dark:drop-shadow-[0_14px_18px_rgb(0_0_0/0.5)]"
              style={{
                viewTransitionName: "practice-object",
                width: "var(--s)",
                height: "var(--s)",
                top: "calc(var(--s) * var(--art-t) * -1)",
                left: "calc(50% - var(--s) * var(--art-w) / 2 - var(--s) * var(--art-l))",
              }}
            />
          )}
        </span>
      )}
      {/* PRINCIPLES 4: an eyebrow inside a card is sentence case, here
          in the card's own ink rather than the old amber. */}
      <div className="eyebrow relative text-[var(--stage-ink)]">
        <span
          ref={brow}
          className="vt-shared inline-block"
          style={compact ? undefined : { viewTransitionName: "practice-eyebrow" }}
        >
          {eyebrow}
        </span>
      </div>
      {/* recording-14: balanced in both sizes, so the last word never
          stands alone ("next / sentence."). recording-16: the padding is
          the same in both states, so on Record only the type steps down
          while the card glides up. */}
      <h1
        ref={head}
        className={`relative font-display text-balance ${
          compact
            ? "mt-1.5 text-lead font-bold leading-snug"
            : "mt-2 text-title font-extrabold leading-[1.18]"
        }`}
      >
        <span className="vt-shared block" style={compact ? undefined : { viewTransitionName: "practice-topic" }}>
          {topic}
        </span>
      </h1>
    </section>
  );
}
