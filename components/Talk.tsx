"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { playTalk } from "@/lib/intro-sound";
import { planTalk, type TalkPlan } from "@/lib/talk";

/**
 * Demos talking in the introduction (#501, Timothy, 18 Nov: "it needs
 * more pop in the text sound"). What he says lands a word at a time, each
 * word springing up into its place (`.talk-word`, globals.css) with a
 * blip under it (lib/intro-sound.ts), and he bobs while he says it. The
 * timing is lib/talk.ts: quick, about a second a line at most.
 *
 * A tap anywhere finishes the line at once, and so does a key: nobody
 * waits on him. The tap still does what it was for (an answer picked,
 * Next pressed); this only stops the words arriving.
 *
 * Every word is in the DOM from the first frame at no opacity, so the
 * bubble is its final size before the first word shows and nothing
 * under it moves. Assistive tech gets each line once, whole, from a
 * `.sr-only` copy beside the aria-hidden words (as `Says` does,
 * intro-a-25). Reduced motion lands every word at once with one blip.
 */

export function motionReduced(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.motion === "reduce";
}

/**
 * Plays a plan: how many words have landed, whether he is still talking,
 * and a way to finish it now. Mounted once per utterance: give the
 * component that holds it a `key` per thing said, and a new thing said
 * starts from its first word.
 */
export function useTalk(lines: readonly string[], lead: number, sound = true) {
  const key = lines.join("\n");
  const [reduced] = useState(motionReduced);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the text is the key
  const plan = useMemo(() => planTalk(lines, { lead, reduced }), [key, lead, reduced]);
  const total = plan.at.length;
  const [shown, setShown] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const ids: number[] = [];
    /* One timer per moment something lands, set from the line's start, so
       a late frame never pushes the rest of the line later. */
    const moments = new Map<number, number>();
    plan.at.forEach((at, i) => moments.set(at, i + 1));
    moments.forEach((n, at) => ids.push(window.setTimeout(() => setShown((s) => Math.max(s, n)), at)));
    if (sound) plan.blips.forEach((at) => ids.push(window.setTimeout(playTalk, at)));
    timers.current = ids;
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [plan, sound]);

  const finish = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setShown(total);
  }, [total]);

  const talking = shown < total;

  /* A tap or a key anywhere finishes him. Capture, so it lands before the
     control it was for has re-rendered anything. */
  useEffect(() => {
    if (!talking) return;
    const done = () => finish();
    document.addEventListener("pointerdown", done, true);
    document.addEventListener("keydown", done, true);
    return () => {
      document.removeEventListener("pointerdown", done, true);
      document.removeEventListener("keydown", done, true);
    };
  }, [talking, finish]);

  return { plan, shown, talking, finish };
}

/** One line of a plan: its words, the first `shown - from` of them landed. */
export function TalkWords({ words, from, shown }: { words: readonly string[]; from: number; shown: number }) {
  return (
    <span aria-hidden>
      {words.map((w, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          {/* `says-word` too: the walk's gate and its CSS for a page a
              swipe brought in find a said word by that name. */}
          <span className="says-word talk-word" data-on={from + i < shown ? "" : undefined}>
            {w}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

/**
 * Lines Demos says, one plan across them: the first as the heading
 * (`as="h1"`) or a paragraph, the rest as paragraphs under it.
 * `ariaHidden` hides them all and leaves out the copies, where the line
 * is announced somewhere else (the bubble's live region).
 */
export function TalkLines({
  lines,
  lead,
  firstAs = "p",
  classes,
  ariaHidden = false,
  sound = true,
  onTalking,
}: {
  lines: readonly string[];
  lead: number;
  firstAs?: "p" | "h1";
  /** Each line's classes, by position. */
  classes: readonly (string | undefined)[];
  ariaHidden?: boolean;
  sound?: boolean;
  /** He started or stopped talking: his art moves while he does. */
  onTalking?: (talking: boolean) => void;
}) {
  const { plan, shown, talking } = useTalk(lines, lead, sound);
  const said = useRef(onTalking);
  useEffect(() => {
    said.current = onTalking;
  });
  useEffect(() => {
    said.current?.(talking);
  }, [talking]);
  useEffect(() => () => said.current?.(false), []);

  let from = 0;
  const kept = lines.filter((l) => l.trim().length > 0);
  return (
    <>
      {plan.lines.map((words, k) => {
        const start = from;
        from += words.length;
        const Tag = k === 0 ? firstAs : "p";
        return (
          <Tag key={k} className={classes[k]} aria-hidden={ariaHidden || undefined}>
            {!ariaHidden && <span className="sr-only">{kept[k]}</span>}
            <TalkWords words={words} from={start} shown={shown} />
          </Tag>
        );
      })}
    </>
  );
}

/**
 * His body while he talks: a quick bob from the feet, on the `.demos-talk`
 * layer of the DemosArt inside `host` (components/DemosArt.tsx), and back
 * to rest from wherever it was when he stops. Transform only, by the Web
 * Animations API so it never fights the arrival, the nod or the pose
 * loop, each of which has its own layer. Still under reduced motion.
 */
export function useTalkMotion(host: RefObject<HTMLElement | null>, talking: boolean) {
  const anim = useRef<Animation | null>(null);
  useEffect(() => {
    const el = host.current?.querySelector<HTMLElement>(".demos-talk");
    if (!el || typeof el.animate !== "function" || motionReduced()) return;
    if (talking) {
      if (anim.current) return;
      anim.current = el.animate(
        [{ transform: "translateY(0) scale(1, 1)" }, { transform: "translateY(-3.5%) scale(0.985, 1.03)" }],
        { duration: 170, iterations: Infinity, direction: "alternate", easing: "ease-in-out" }
      );
      return;
    }
    const a = anim.current;
    if (!a) return;
    anim.current = null;
    const at = getComputedStyle(el).transform;
    a.cancel();
    if (at && at !== "none") el.animate([{ transform: at }, { transform: "none" }], { duration: 160, easing: "ease-out" });
  }, [talking, host]);
  useEffect(
    () => () => {
      anim.current?.cancel();
      anim.current = null;
    },
    []
  );
}

/** A wrapper whose DemosArt talks while `talking`. */
export function Talker({ talking, className, children }: { talking: boolean; className?: string; children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  useTalkMotion(host, talking);
  return (
    <div ref={host} className={className} data-talking={talking ? "" : undefined}>
      {children}
    </div>
  );
}

export type { TalkPlan };
