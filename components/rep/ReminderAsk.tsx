"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { IconChevron } from "@/components/Icon";
import { dayKey } from "@/lib/challenge";
import { inAppBrowser } from "@/lib/in-app";
import { readPrefs } from "@/lib/prefs";
import { saveAccountHour } from "@/lib/reminder-account";
import {
  ASK_COPY,
  askHour,
  askHours,
  askPlatform,
  askedOn,
  clearNotNow,
  declined,
  deniedLine,
  deniedTold,
  installTold,
  markAnswered,
  markAsked,
  markDeniedTold,
  markInstallTold,
  markNotNow,
  markSwitchedOff,
  markUnanswered,
  notificationState,
  reminderAsk,
  restUntil,
  settleUnanswered,
  type AskKind,
} from "@/lib/reminder-ask";
import { armedHere, armInTap, readyRegistration, type ArmResult } from "@/lib/reminders";
import { testerNote } from "@/lib/tester-signal";
import { useHourLabel } from "@/lib/time-label";

type Status = "ask" | "saving" | "saved" | "failed" | "denied" | "install" | "gone";

interface Setup {
  kind: AskKind;
  /** The hour first offered: the one already chosen, else this take's. */
  hour: number;
  /** That hour was already chosen (the introduction, Settings, the account). */
  chosen: boolean;
  ios: boolean;
  hours: number[];
}

/**
 * The reminder ask on the glance (DECISIONS #430): Demos's cue for next
 * time gives its slot to it on the person's first scored take of the
 * day, when this phone has no reminder the server holds
 * (lib/reminder-ask.ts). Grey, never the tap's fill: the screen's one tap
 * stays the way on.
 *
 * `words` is what it puts on screen, so the glance's budget can name it
 * (lib/glance.ts GLANCE_WORDS_ASK); `node` is the slot, or null.
 *
 * `hold` keeps it off screen, and unspent, while another question is
 * open: a tester's glance asks "Did 665 feel right?" first and this
 * after the answer saves, one question at a time (#430 review). Nothing
 * is marked until it shows.
 */
export function useGlanceReminder({
  scored,
  firstToday,
  startedAt,
  compact = false,
  hold = false,
}: {
  scored: boolean;
  firstToday: boolean;
  /** When this take started (ms), for the hour it offers. */
  startedAt: number;
  /**
   * The glance also holds a tester's question: under 700pt Demos stands
   * beside a narrow bubble, so the tap there is a line of its own words,
   * not a pill (the pill wrapped "Remind me at 3 / pm" and scrolled).
   */
  compact?: boolean;
  /** Another question is open on the glance: wait until it is answered. */
  hold?: boolean;
}): { kind: AskKind | null; words: string; node: ReactNode } {
  const hourLabel = useHourLabel();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [status, setStatus] = useState<Status>("ask");
  const [hour, setHour] = useState(0);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);
  const [shown, setShown] = useState(false);

  /* Decided once, after mount: everything it reads is this phone's. */
  useEffect(() => {
    const prefs = readPrefs();
    const today = dayKey(new Date());
    const plat = askPlatform();
    // A showing on an earlier day that got no tap was a Not now.
    settleUnanswered(today);
    const kind = reminderAsk({
      scored,
      firstToday,
      armed: armedHere(prefs),
      declined: declined(),
      notifications: notificationState(),
      push: plat.push,
      ios: plat.ios,
      standalone: plat.standalone,
      askedOn: askedOn(),
      today,
      restUntil: restUntil(),
      installTold: installTold(),
      deniedTold: deniedTold(),
      inApp: inAppBrowser(navigator.userAgent) !== null,
    });
    if (!kind) return;
    const h = askHour(new Date(startedAt || Date.now()), prefs.reminderHour, prefs);
    setSetup({ kind, hour: h, chosen: prefs.reminderHour === h, ios: plat.ios, hours: askHours(prefs) });
    setHour(h);
    setStatus(kind);
    if (kind === "ask") {
      // The registration the tap subscribes on, ready before the tap.
      void readyRegistration().then(setReg);
    }
    // Once, on mount: the take does not change under the results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Marked when it first shows, not when it is decided: a held ask that
     never showed has not spent the day. No hour goes on the account from
     the Safari tab (#430 review): nobody chose it there, and the
     installed app read it back as "picked". */
  useEffect(() => {
    if (!setup || hold || shown) return;
    setShown(true);
    const today = dayKey(new Date());
    markAsked(today);
    if (setup.kind === "ask") markUnanswered(today);
    if (setup.kind === "install") {
      markInstallTold();
      testerNote("Reminder: Home Screen steps shown");
    }
    if (setup.kind === "denied") {
      markDeniedTold();
      testerNote("Reminder: blocked line shown");
    }
  }, [setup, hold, shown]);

  const settle = useCallback((h: number, r: ArmResult) => {
    if (r.ok) {
      clearNotNow();
      markSwitchedOff(false);
      setStatus("saved");
      testerNote(`Reminder: saved for ${h}:00`);
    } else if (r.why === "denied") {
      markDeniedTold();
      setStatus("denied");
      testerNote("Reminder: denied");
    } else if (r.why === "dismissed") {
      setStatus("ask");
      testerNote("Reminder: prompt dismissed");
    } else {
      setStatus("failed");
      testerNote(`Reminder: failed, ${r.why}${r.status ? ` ${r.status}` : ""}`);
    }
  }, []);

  /* The tap: armInTap is called before anything is awaited, so the
     subscribe that raises the iPhone's Allow prompt is inside it. */
  const remind = () => {
    const h = hour;
    markAnswered();
    setStatus("saving");
    void armInTap(h, reg, (x) => saveAccountHour(x)).then((r) => settle(h, r));
  };
  const notNow = () => {
    markNotNow(dayKey(new Date()));
    setStatus("gone");
    testerNote("Reminder: not now");
  };

  if (!setup || hold || status === "gone") return { kind: null, words: "", node: null };
  const label = hourLabel(hour);
  const question = setup.chosen ? ASK_COPY.chosen : ASK_COPY.fresh;

  let words = "";
  let node: ReactNode = null;
  if (status === "ask" || status === "saving") {
    words = `${question} ${ASK_COPY.button(label)} ${ASK_COPY.notNow}`;
    /* The hour, as the phone's own picker; `reach` grows its target to 44pt where the glyph is small. */
    const picker = (className: string, size: number, reach = "inset-0") => (
      <label className={`press relative flex items-center justify-center text-stone-500 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-ink ${className}`}>
        <span className="sr-only">{ASK_COPY.picker}</span>
        <IconChevron size={size} />
        <select
          data-reminder-hour
          value={hour}
          disabled={status === "saving"}
          onChange={(e) => setHour(Number(e.target.value))}
          className={`absolute ${reach} cursor-pointer appearance-none opacity-0`}
        >
          {setup.hours.map((h) => (
            <option key={h} value={h}>
              {hourLabel(h)}
            </option>
          ))}
        </select>
      </label>
    );
    node = (
      <div data-reminder-ask className="mt-1.5 flex flex-col items-center font-display [@media(max-height:599px)]:mt-0 [@media(min-height:600px)_and_(max-height:700px)]:mt-1">
        {/* A phone under 700pt keeps the tap and drops the question: the
            tap already says it, and Demos keeps his 88 (the review's floor). */}
        <p className="font-body text-detail leading-[24px] font-normal text-stone-500 [@media(max-height:700px)]:hidden">{question}</p>
        <div
          className={`mt-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 [@media(max-height:700px)]:mt-0 ${
            compact ? "[@media(max-height:700px)]:hidden" : ""
          }`}
        >
          {/* One pill read as one sentence: the tap, and the hour it names
              as a picker (the phone's own wheel), split by a hairline. */}
          <div
            className={`flex items-stretch overflow-hidden rounded-tap border border-edge bg-surface ${
              status === "saving" ? "opacity-60" : ""
            }`}
          >
            <button
              type="button"
              data-reminder-remind
              onClick={remind}
              disabled={status === "saving"}
              aria-busy={status === "saving"}
              className="press min-h-11 whitespace-nowrap pl-4 pr-2.5 text-row"
            >
              {ASK_COPY.button(label)}
            </button>
            {picker("min-h-11 w-10 border-l border-edge", 18)}
          </div>
          <button
            type="button"
            onClick={notNow}
            disabled={status === "saving"}
            className="press min-h-11 whitespace-nowrap rounded-tap px-3 text-link text-stone-500"
          >
            {ASK_COPY.notNow}
          </button>
        </div>
        {compact && (
          /* The narrow bubble beside Demos: the same two taps as words in
             his line's grey, each with a 44pt reach of its own. */
          /* On the bubble's own text edge, as its line is (#430 review);
             under 600pt there is no bubble and the line is centred. */
          <p className={`hidden flex-wrap items-center justify-start gap-x-3 self-stretch [@media(max-height:599px)]:justify-center font-body text-detail leading-[24px] text-stone-500 [@media(max-height:599px)]:leading-[20px] [@media(max-height:700px)]:flex ${status === "saving" ? "opacity-60" : ""}`}>
            <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
              <button
                type="button"
                onClick={remind}
                disabled={status === "saving"}
                aria-busy={status === "saving"}
                className="relative font-semibold text-stone-600 underline underline-offset-2 after:absolute after:-inset-x-1 after:-inset-y-[10px] after:content-['']"
              >
                {ASK_COPY.button(label)}
              </button>
              {picker("h-6 w-6 [@media(max-height:599px)]:h-5", 16, "-inset-[10px]")}
            </span>
            {/* The cue's weight: the decline never reads louder than the accept. */}
            <button
              type="button"
              onClick={notNow}
              disabled={status === "saving"}
              className="relative whitespace-nowrap font-normal text-stone-500 after:absolute after:-inset-x-2 after:-inset-y-[10px] after:content-['']"
            >
              {ASK_COPY.notNow}
            </button>
          </p>
        )}
      </div>
    );
  } else if (status === "saved") {
    words = ASK_COPY.saved(label);
    node = (
      <p data-reminder-ask role="status" className="mt-0.5 [@media(max-height:700px)]:mt-0 text-detail leading-[24px] font-normal text-stone-500">
        {ASK_COPY.saved(label)}
      </p>
    );
  } else if (status === "failed") {
    words = `${ASK_COPY.failed} ${ASK_COPY.retry}`;
    /* The cue's own size, so the slot reads as one voice in every state;
       Try again is a new tap, so it can raise the prompt again. */
    node = (
      <p data-reminder-ask role="alert" className="mt-0.5 [@media(max-height:700px)]:mt-0 text-detail leading-[24px] font-normal text-stone-500">
        {ASK_COPY.failed}{" "}
        <button
          type="button"
          onClick={remind}
          className="relative font-semibold text-stone-600 underline underline-offset-2 after:absolute after:-inset-x-2 after:-inset-y-[10px] after:content-['']"
        >
          {ASK_COPY.retry}
        </button>
      </p>
    );
  } else if (status === "denied") {
    words = deniedLine(setup.ios);
    node = (
      <p data-reminder-ask role="status" className="mt-0.5 [@media(max-height:700px)]:mt-0 text-detail leading-[24px] font-normal text-pretty text-stone-500">
        {deniedLine(setup.ios)}
      </p>
    );
  } else if (status === "install") {
    words = `${ASK_COPY.install} ${ASK_COPY.installSteps}`;
    node = (
      <p data-reminder-ask className="mt-0.5 [@media(max-height:700px)]:mt-0 text-detail leading-[24px] font-normal text-pretty text-stone-500">
        {ASK_COPY.install} <span className="font-semibold text-stone-600">{ASK_COPY.installSteps}</span>
      </p>
    );
  }
  return { kind: setup.kind, words, node };
}
