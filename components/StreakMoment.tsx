"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import { IconFreeze } from "@/components/Icon";
import { FooterShelf } from "@/components/ui/FooterShelf";
import { TapTick } from "@/components/ui/TapTick";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { buzz, prefersReducedMotion } from "@/lib/prefs";
import { playSound } from "@/lib/sound";
import { SPRING, springEasing, springMs } from "@/lib/spring";
import {
  freezeLine,
  keptLine,
  markMomentShown,
  momentTimeline,
  odometer,
  streakLabel,
  streakLine,
  type StreakMomentView,
} from "@/lib/streak-moment";
import { ACTION_CLASS } from "@/lib/ui";
import { StatIcon } from "@/components/StatIcon";

const WEEKDAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * The streak's moment (DECISIONS #480): one full screen between the
 * results of the take that made today count and the place the exit was
 * going. Timothy, 16 Nov, with Duolingo's streak screens as the
 * reference: "after u complete a lesson have a fire icon turn bright
 * orange and add a ticker that increases from day > day after so 3 > 4".
 *
 * Ours, in Ethos's system: the plain ground, one flat flame (no glow, no
 * Demos: the number is the event), the count in Outfit 800 at the
 * largest number step, this week's row from Today's Days spoken tile,
 * one line, and the page's one tap. On its clock (lib/streak-moment.ts
 * `momentTimeline`): the screen arrives with the flame unlit and the
 * count at yesterday's number; the flame lights as its sound starts
 * (#505: the flame catching, the chime climbing, the odometer's clicks);
 * on the chime's landing note the count rolls to today's like an odometer
 * (only the places that change turn, #226) and today's day fills; then
 * the line. Every movement is a Web Animation started on the first
 * frame, so a camera can pause and seek it. Reduced motion draws the
 * end: the flame lit, today's count, the day filled, no roll; the sound
 * still plays (it has its own switch).
 *
 * Nothing waits on it: Continue is live from the first frame.
 */
export function StreakMoment({
  moment,
  onContinue,
}: {
  moment: StreakMomentView;
  onContinue: () => void;
}) {
  // Read once: the moment must not change course midway.
  const calm = useMemo(() => prefersReducedMotion(), []);
  const time = useMemo(() => momentTimeline(moment.milestone), [moment.milestone]);
  const root = useRef<HTMLElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const places = useMemo(() => odometer(moment.from, moment.to), [moment.from, moment.to]);
  const line = streakLine(moment.to);
  /* Under the week, what carried the run to today: a freeze, or the two
     recordings that kept yesterday (closure.md row 14). Never both: a
     kept day is never a frozen one. */
  const under = freezeLine(moment.bridged) ?? keptLine(moment.kept);

  /* Shown is shown, once a day on this phone, whatever is tapped. */
  useEffect(() => {
    markMomentShown(moment.day);
  }, [moment.day]);

  /* The line names the screen for a screen reader the moment it opens:
     the count it lands on, whatever the digits are doing. */
  useEffect(() => {
    head.current?.focus({ preventScroll: true });
  }, []);

  /* The sound starts as the flame lights; the haptic lands with the roll.
     Its own sound whatever else the take played (#505: each moment has
     one), laid on the audio clock in the commit, where the flame's own
     clock starts, so a busy first frame cannot pull them apart. Mount
     only: a re-render never rings it again. */
  useLayoutEffect(() => {
    const ring = playSound(moment.milestone ? "streak-milestone" : "streak", { delayS: calm ? 0 : time.lightAt / 1000 });
    return () => ring?.drop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const land = calm ? null : setTimeout(() => buzz(30), time.rollAt);
    return () => {
      if (land) clearTimeout(land);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The clock, laid on before the first paint so nothing shows its end
     state for a frame. Every part holds its start until its delay comes.
     A part that ends where its CSS already stands (faded in, scale 1, at
     centre) lets go when it ends (`fill: backwards`); held at its end, a
     transform kept today's block on its own layer, snapped a pixel short
     of its slot, and a 1px sand seam stood at its right edge (the #480
     review). Only the unlit flame (faded out) and the digits (turned)
     hold their end. */
  useLayoutEffect(() => {
    const el = root.current;
    if (calm || !el) return;
    const playing: Animation[] = [];
    const run = (selector: string, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      el.querySelectorAll<HTMLElement>(selector).forEach((n) =>
        playing.push(n.animate(frames, { fill: "backwards", ...options }))
      );
    };
    const ease = { duration: DURATION.base, easing: EASE_OUT };
    run("[data-arrive]", [{ opacity: 0 }, { opacity: 1 }], ease);
    run("[data-flame='unlit']", [{ opacity: 1 }, { opacity: 0 }], { ...ease, delay: time.lightAt, fill: "both" });
    run(
      "[data-flame='lit']",
      [
        { opacity: 0, transform: "scale(0.72)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { delay: time.lightAt, duration: springMs(SPRING.thrown), easing: springEasing(SPRING.thrown) }
    );
    run("[data-turn]", [{ transform: "translateY(0)" }, { transform: "translateY(-50%)" }], {
      fill: "both",
      delay: time.rollAt,
      duration: time.rollMs,
      easing: springEasing(SPRING.base),
    });
    /* A place arriving from nothing (9 to 10) is drawn from the start, so
       yesterday's number stands off centre by half of it until the roll
       brings today's in: the count slides back to centre as it turns. */
    const arriving = [...el.querySelectorAll<HTMLElement>("[data-arriving]")].reduce((w, n) => w + n.offsetWidth, 0);
    if (arriving > 0) {
      run("[data-count]", [{ transform: `translateX(${-arriving / 2}px)` }, { transform: "translateX(0)" }], {
        delay: time.rollAt,
        duration: time.rollMs,
        easing: springEasing(SPRING.base),
      });
    }
    run(
      "[data-fill]",
      [
        { opacity: 0, transform: "scale(0.5)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { delay: time.rollAt, duration: springMs(SPRING.snappy), easing: springEasing(SPRING.snappy) }
    );
    run(
      "[data-line]",
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { ...ease, delay: time.lineAt }
    );
    /* A remount (React's development double run) starts the clock once. */
    return () => playing.forEach((a) => a.cancel());
  }, [calm, time]);

  const spoken = moment.week.filter((d) => d.mark === "spoken").length;
  const frozen = moment.week.map((d, i) => (d.mark === "frozen" ? WEEKDAY[i] : null)).filter(Boolean);
  const kept = moment.week.map((d, i) => (d.mark === "kept" ? WEEKDAY[i] : null)).filter(Boolean);
  const weekName = `This week: ${spoken} day${spoken === 1 ? "" : "s"} spoken${
    frozen.length ? `, ${frozen.join(" and ")} on a freeze` : ""
  }${kept.length ? `, ${kept.join(" and ")} covered by two recordings` : ""}`;

  return (
    <main
      ref={root}
      data-streak-moment=""
      data-from={moment.from}
      data-to={moment.to}
      data-light-at={time.lightAt}
      data-roll-at={time.rollAt}
      data-roll-ms={time.rollMs}
      data-end-ms={time.end}
      className="flex min-h-dvh flex-col bg-ground px-5 pt-[env(safe-area-inset-top)]"
    >
      {/* The free height is the flame's (#496, the morning tour: about
          200pt of bare ground stood over the flame and again over
          Continue). Four bands share the rest, each at most 64 with the
          shelf's own 16 under the last (`.streak-gap`), and whatever is
          left goes to the flame, up to 380pt. The count grows with the
          screen too (`.streak-count`). */}
      <div data-arrive="" className="streak-stage flex flex-1 flex-col items-center text-center">
        <span aria-hidden className="streak-gap" data-gap="top" />
        {/* The flat flame, drawn inline at the slot's size: the unlit one
            (the same drawing in its grey tones) fades as the lit one
            springs in over it. */}
        <div aria-hidden className="streak-flame-slot">
          <div className="streak-flame">
            {!calm && (
              <span data-flame="unlit">
                <StatIcon kind="streak" lit={false} size={380} />
              </span>
            )}
            <span data-flame="lit">
              <StatIcon kind="streak" size={380} />
            </span>
          </div>
        </div>
        <span aria-hidden className="streak-gap" data-gap="count" />

        {/* The one line, "4 days running": the count large, where it
            rolls, over the words that finish it, which come in once it
            has turned. A screen reader hears the line once, whole. */}
        <h1 ref={head} tabIndex={-1} className="flex flex-col items-center outline-none">
          <span className="sr-only" data-streak-line="">
            {line}
          </span>
          {/* Its places set its width's ceiling (`--places`, .streak-count):
              a thousand days at 160 would stand wider than the column. */}
          <span aria-hidden className="streak-count text-num-xl" style={{ "--places": places.length } as CSSProperties}>
            {calm ? (
              /* Today's count at rest, in the same one-line places the
                 roll turns in, so the screen stands the same with or
                 without motion. */
              <span data-count="" className="inline-flex">
                {String(moment.to)
                  .split("")
                  .map((d, i) => (
                    <span key={i} className="streak-place">
                      <span>
                        <span>{d}</span>
                      </span>
                    </span>
                  ))}
              </span>
            ) : (
              <span data-count="" className="inline-flex">
                {places.map((p, i) =>
                  p.turns ? (
                    <span key={i} className="streak-place" data-arriving={p.was === "" ? "" : undefined}>
                      <span data-turn="">
                        <span>{p.was}</span>
                        <span>{p.now}</span>
                      </span>
                    </span>
                  ) : (
                    <span key={i} className="streak-place">
                      <span>
                        <span>{p.now}</span>
                      </span>
                    </span>
                  )
                )}
              </span>
            )}
          </span>
          <span aria-hidden data-line="" className="font-display mt-1 text-title">
            {streakLabel(moment.to)}
          </span>
        </h1>

        <span aria-hidden className="streak-gap" data-gap="week" />
        <div role="img" aria-label={weekName} className="streak-week">
          {moment.week.map((d, i) => (
            <span key={i} className="flex flex-col items-center gap-1.5">
              <span className="streak-day w-full" data-day={d.today ? "today" : d.mark}>
                {d.mark === "frozen" && <IconFreeze size={16} />}
                {d.today && <span data-fill="" />}
              </span>
              <span className={`font-display text-suffix ${d.today ? "font-extrabold text-ink" : "font-bold text-stone-400"}`}>
                {d.label}
              </span>
            </span>
          ))}
        </div>

        {under && (
          <p data-line="" data-under-week={moment.kept ? "kept" : "freeze"} className="mt-4 text-body text-stone-500 text-pretty">
            {under}
          </p>
        )}
        <span aria-hidden className="streak-gap" data-gap="foot" />
      </div>

      <FooterShelf hairline={false}>
        <button
          type="button"
          data-continue=""
          onClick={() => {
            buzz(8);
            onContinue();
          }}
          className={`${ACTION_CLASS} relative`}
        >
          Continue
          {/* An iPhone's tick under the tap (#449). */}
          <TapTick />
        </button>
      </FooterShelf>
    </main>
  );
}
