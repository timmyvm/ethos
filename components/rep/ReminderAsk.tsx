"use client";

import { useEffect, useState } from "react";
import { Overlay, useOverlayClose } from "@/components/ui/Overlay";
import { dayKey } from "@/lib/challenge";
import { readPrefs, writePrefs } from "@/lib/prefs";
import { markAsked } from "@/lib/reminder-ask";
import { armReminder } from "@/lib/reminders";
import { useHourLabel } from "@/lib/time-label";

/** The sheet's name and its one line. */
export const REMINDER_ASK = "Remind you tomorrow?";

/**
 * The when-plan (DECISIONS #136). Implementation intentions, a concrete
 * when rather than a pledge, are the largest effect in the onboarding
 * research pass (d = 0.65, Gollwitzer & Sheeran), and the tap doubles
 * as the notification-permission primer: the browser's dialog only ever
 * appears after a time is picked, so the reminder is theirs, not ours.
 */
export const PLAN_HOURS = [
  { h: 8, name: "Morning" },
  { h: 12, name: "Lunch" },
  { h: 18, name: "Evening" },
];

/** How long the line after a pick stays before the exit goes on. */
const SAID_MS = 1200;

/**
 * The pick, moved out of the last step's Tomorrow section unchanged
 * (#427): the hour is saved, then the browser's permission is asked,
 * then the reminder is armed for tomorrow.
 */
export function useReminderPick(streak: number) {
  const [hour, setHour] = useState<number | null>(() => readPrefs().reminderHour);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [picked, setPicked] = useState(false);

  async function pick(h: number) {
    writePrefs({ reminderHour: h });
    setHour(h);
    setPicked(true);
    if (typeof Notification === "undefined") {
      setGranted(false);
      return;
    }
    const p =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    setGranted(p === "granted");
    if (p === "granted") {
      await armReminder({ streak, didToday: true });
    }
  }

  return { hour, granted, picked, pick };
}

/**
 * The reminder ask on the way out (DECISIONS #427): a short sheet over
 * the glance on an exit that leaves, once a day on this device, only
 * where notifications can work (lib/reminder-ask.ts). Three hours as the
 * answer rows Tomorrow drew, and Not now; no Demos and no terracotta,
 * since the tap that was pressed is the screen's one tap. After a pick
 * the line says what happens, then the exit goes on to where it was
 * going; Not now, Escape or the scrim go straight on.
 */
export function ReminderAsk({ streak, onDone }: { streak: number; onDone: () => void }) {
  return (
    <Overlay label={REMINDER_ASK} onClose={onDone} className="w-full max-w-[430px]">
      <Body streak={streak} onDone={onDone} />
    </Overlay>
  );
}

function Body({ streak, onDone }: { streak: number; onDone: () => void }) {
  const close = useOverlayClose(onDone);
  const hourLabel = useHourLabel();
  const { hour, granted, picked, pick } = useReminderPick(streak);

  // Shown is shown, whatever is tapped: the next leaving exit today goes straight on.
  useEffect(() => {
    markAsked(dayKey(new Date()));
  }, []);

  // The line after a pick, then on to the exit that was tapped.
  useEffect(() => {
    if (!picked || granted === null) return;
    const t = setTimeout(close, SAID_MS);
    return () => clearTimeout(t);
  }, [picked, granted, close]);

  return (
    <div className="elev-3 w-full max-w-[430px] rounded-t-sheet border border-b-0 border-transparent bg-raised px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 text-ink dark:border-card-edge dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-raised),#fff_3%)_0,var(--color-raised)_88px)]">
      <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-stone-300" />
      <h2 className="detail-head mt-4 text-center">{REMINDER_ASK}</h2>
      {picked && hour !== null ? (
        <p role="status" className="mt-4 min-h-14 text-center text-body text-stone-600">
          {hourLabel(hour)}.{" "}
          {granted === null
            ? null
            : granted
              ? "Demos will nudge you once, never more."
              : "Noted. Notifications are off in this browser; Settings names the fix."}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {PLAN_HOURS.map((p) => (
            <button
              key={p.h}
              type="button"
              onClick={() => void pick(p.h)}
              className="press flex min-h-14 flex-col items-center justify-center rounded-control border border-edge bg-surface px-2 py-2"
            >
              <span className="font-display text-row">{p.name}</span>
              <span className="text-caption text-stone-500">{hourLabel(p.h)}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={close}
        className={`press mt-2 block min-h-11 w-full text-center text-link text-stone-500 ${picked ? "invisible" : ""}`}
      >
        Not now
      </button>
    </div>
  );
}
