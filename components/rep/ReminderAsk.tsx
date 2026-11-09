"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { IconChevron } from "@/components/Icon";
import { ErrorLine } from "@/components/ui/ErrorState";
import { dayKey } from "@/lib/challenge";
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
  markAsked,
  markDeniedTold,
  markInstallTold,
  markNotNow,
  markSwitchedOff,
  notificationState,
  reminderAsk,
  restUntil,
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
 * (lib/reminder-ask.ts). Grey, never terracotta: the screen's one tap
 * stays the way on.
 *
 * `words` is what it puts on screen, so the glance's budget can name it
 * (lib/glance.ts GLANCE_WORDS_ASK); `node` is the slot, or null.
 */
export function useGlanceReminder({
  scored,
  firstToday,
  startedAt,
}: {
  scored: boolean;
  firstToday: boolean;
  /** When this take started (ms), for the hour it offers. */
  startedAt: number;
}): { kind: AskKind | null; words: string; node: ReactNode } {
  const hourLabel = useHourLabel();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [status, setStatus] = useState<Status>("ask");
  const [hour, setHour] = useState(0);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);

  /* Decided once, after mount: everything it reads is this phone's. */
  useEffect(() => {
    const prefs = readPrefs();
    const today = dayKey(new Date());
    const plat = askPlatform();
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
    });
    if (!kind) return;
    const h = askHour(new Date(startedAt || Date.now()), prefs.reminderHour, prefs);
    setSetup({ kind, hour: h, chosen: prefs.reminderHour === h, ios: plat.ios, hours: askHours(prefs) });
    setHour(h);
    setStatus(kind);
    markAsked(today);
    if (kind === "install") {
      markInstallTold();
      // No reminder can be armed in this tab: the hour goes on the
      // account, for the installed app (signed in) to offer back.
      void saveAccountHour(h, { onlyIfUnset: true });
      testerNote("Reminder: Home Screen steps shown");
    }
    if (kind === "denied") {
      markDeniedTold();
      testerNote("Reminder: blocked line shown");
    }
    if (kind === "ask") {
      // The registration the tap subscribes on, ready before the tap.
      void readyRegistration().then(setReg);
    }
    // Once, on mount: the take does not change under the results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setStatus("saving");
    void armInTap(h, reg, (x) => saveAccountHour(x)).then((r) => settle(h, r));
  };
  const notNow = () => {
    markNotNow(dayKey(new Date()));
    setStatus("gone");
    testerNote("Reminder: not now");
  };

  if (!setup || status === "gone") return { kind: null, words: "", node: null };
  const label = hourLabel(hour);
  const question = setup.chosen ? ASK_COPY.chosen(hourLabel(setup.hour)) : ASK_COPY.fresh;

  let words = "";
  let node: ReactNode = null;
  if (status === "ask" || status === "saving") {
    words = `${question} ${ASK_COPY.button(label)} ${ASK_COPY.notNow}`;
    node = (
      <div data-reminder-ask className="mt-1.5 flex flex-col items-center font-display">
        <p className="font-body text-detail leading-[24px] font-normal text-stone-500">{question}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
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
              className="press min-h-11 pl-4 pr-2.5 text-row"
            >
              {ASK_COPY.button(label)}
            </button>
            <label className="press relative flex min-h-11 w-10 items-center justify-center border-l border-edge text-stone-500 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-ink">
              <span className="sr-only">{ASK_COPY.picker}</span>
              <IconChevron size={18} />
              <select
                data-reminder-hour
                value={hour}
                disabled={status === "saving"}
                onChange={(e) => setHour(Number(e.target.value))}
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              >
                {setup.hours.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={notNow}
            disabled={status === "saving"}
            className="press min-h-11 rounded-tap px-3 text-link text-stone-500"
          >
            {ASK_COPY.notNow}
          </button>
        </div>
      </div>
    );
  } else if (status === "saved") {
    words = ASK_COPY.saved(label);
    node = (
      <p data-reminder-ask role="status" className="mt-0.5 text-detail leading-[24px] font-normal text-stone-500">
        {ASK_COPY.saved(label)}
      </p>
    );
  } else if (status === "failed") {
    words = `${ASK_COPY.failed} ${ASK_COPY.retry}`;
    node = (
      <div data-reminder-ask className="mt-1.5 flex justify-center">
        <ErrorLine onRetry={remind} className="text-body">
          {ASK_COPY.failed}
        </ErrorLine>
      </div>
    );
  } else if (status === "denied") {
    words = deniedLine(setup.ios);
    node = (
      <p data-reminder-ask role="status" className="mt-1 text-body text-pretty text-stone-500">
        {deniedLine(setup.ios)}
      </p>
    );
  } else if (status === "install") {
    words = `${ASK_COPY.install} ${ASK_COPY.installSteps}`;
    node = (
      <p data-reminder-ask className="mt-1 text-body text-pretty text-stone-500">
        {ASK_COPY.install} <span className="font-semibold text-stone-600">{ASK_COPY.installSteps}</span>
      </p>
    );
  }
  return { kind: setup.kind, words, node };
}
