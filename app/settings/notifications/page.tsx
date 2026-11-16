"use client";

import { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorLine } from "@/components/ui/ErrorState";
import { InfoRow, PAGE_CLASS, PickerMark, Section, Toggle } from "@/components/settings/Rows";
import { fetchReps } from "@/lib/client-data";
import { DEFAULT_PREFS, readPrefs, writePrefs, type Prefs } from "@/lib/prefs";
import {
  armInTap,
  armReminder,
  cancelReminder,
  currentTier,
  disarmPush,
  nextFireTime,
  noNotificationsNote,
  readyRegistration,
  reminderLine,
  reminderTier,
  reminderTierNote,
  sendTestPush,
  type ReminderTier,
  type TestOutcome,
} from "@/lib/reminders";
import { ASK_COPY, askHours, askPlatform, deniedLine, markSwitchedOff } from "@/lib/reminder-ask";
import { saveAccountHour } from "@/lib/reminder-account";
import { testerNote } from "@/lib/tester-signal";
import { inAppBrowser } from "@/lib/in-app";
import { computeStreak } from "@/lib/streak";
import { useHourLabel } from "@/lib/time-label";
import { ACTION_CLASS } from "@/lib/ui";

/** Where the switch lands when it goes on: the evening, after the day. */
const DEFAULT_HOUR = 20;

/**
 * Notifications (#479): the daily reminder as a page of its own, as it
 * was built (#430). One switch says whether it rings; its Time row opens
 * the phone's own picker with every hour outside quiet hours; turning it
 * on asks for notifications in the same tap, through `armInTap`, whose
 * first await is the subscribe that raises an iPhone's Allow prompt, and
 * nothing says it is on until the server has it; Send a test asks the
 * server for this phone's reminder now.
 *
 * Only the reminder is here. The sender (app/api/push/cron) claims one
 * day per subscription and sends one kind of push under one topic and
 * TTL; a streak-at-risk nudge or the week's boss would each need its own
 * claim, copy and schedule on the server, so their switches wait for
 * that, rather than stand here doing nothing.
 */
export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [perm, setPerm] = useState<string>("default");
  const [canNotify, setCanNotify] = useState(true);
  const [app, setApp] = useState<string | null>(null);
  const [tier, setTier] = useState<ReminderTier>("unsupported");
  /* The tier the browser actually holds has been read (a push
     subscription takes an async look): until then nothing says it failed. */
  const [tierRead, setTierRead] = useState(false);
  /* An iPhone or not, from the Home Screen or not, push or not (#430). */
  const [plat, setPlat] = useState({ ios: false, standalone: false, push: false });
  /* The registration a tap subscribes on, fetched before the tap. */
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);
  const [arm, setArm] = useState<"idle" | "saving" | "failed">("idle");
  const [test, setTest] = useState<"idle" | "sending" | TestOutcome>("idle");
  const [didToday, setDidToday] = useState(false);
  /* The next time the reminder rings, read after mount and after every
     change that moves it, never during render (#418). */
  const [fireAt, setFireAt] = useState<Date | null>(null);
  const hour = useHourLabel();

  useEffect(() => {
    setPrefs(readPrefs());
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    else setCanNotify(false);
    setApp(inAppBrowser(navigator.userAgent));
    setTier(reminderTier());
    currentTier()
      .then(setTier)
      .catch(() => {})
      .finally(() => setTierRead(true));
    setPlat(askPlatform());
    void readyRegistration().then(setReg);
    fetchReps()
      .then((reps) => setDidToday(computeStreak(reps.map((r) => new Date(r.created_at))).didToday))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setFireAt(prefs.reminderHour !== null ? nextFireTime(prefs.reminderHour, new Date(), prefs, didToday) : null);
  }, [prefs, didToday]);

  function update(patch: Partial<Prefs>) {
    setPrefs(writePrefs(patch));
  }

  /* Off is an answer the glance respects (markSwitchedOff). */
  function setHour(h: number | null) {
    update({ reminderHour: h });
    markSwitchedOff(h === null);
    setTest("idle");
    if (h === null) {
      cancelReminder();
      void disarmPush();
      setTier(reminderTier());
      setArm("idle");
      return;
    }
    turnOn(h);
  }

  function turnOn(h: number) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "denied") {
      setPerm("denied");
      return;
    }
    if (!plat.push) {
      // No push here (an old desktop browser): its own ask, in the tap,
      // then the local tiers.
      void Notification.requestPermission().then((p) => {
        setPerm(p);
        if (p === "granted") void rearm();
      });
      return;
    }
    setArm("saving");
    void armInTap(h, reg, (x) => saveAccountHour(x)).then((r) => {
      if (typeof Notification !== "undefined") setPerm(Notification.permission);
      if (r.ok) {
        setArm("idle");
        setTier("push");
        testerNote(`Reminder: saved for ${h}:00 in Settings`);
        return;
      }
      testerNote(`Reminder: ${r.why === "denied" || r.why === "dismissed" ? r.why : `failed, ${r.why}${r.status ? ` ${r.status}` : ""}`} in Settings`);
      if (r.why === "denied" || r.why === "dismissed") {
        setArm("idle");
        return;
      }
      setArm("failed");
      // A desktop tab keeps its own timer while the server is away; a
      // phone has none worth offering.
      if (!plat.ios) void rearm();
    });
  }

  async function rearm() {
    const reps = await fetchReps().catch(() => []);
    const s = computeStreak(reps.map((r) => new Date(r.created_at)));
    setDidToday(s.didToday);
    const armed = await armReminder({ streak: s.current, didToday: s.didToday });
    if (armed) setTier(armed);
  }

  function sendTest() {
    setTest("sending");
    void sendTestPush(reg).then((o) => {
      setTest(o);
      if (o === "gone") setTier(reminderTier());
      testerNote(`Reminder: test ${o}`);
    });
  }

  const reminderOn = prefs.reminderHour !== null;
  const line = reminderOn ? reminderLine(perm, canNotify) : null;
  const lapsed = plat.standalone && plat.push && tierRead && tier !== "push";

  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="Notifications" back={{ href: "/settings", label: "Settings" }} />

      <Section
        title="Reminders"
        className="mt-5"
        footer="One a day with a number from your last recording, and never on a day you've practised."
      >
        <Toggle label="Daily reminder" on={reminderOn} onChange={(v) => setHour(v ? DEFAULT_HOUR : null)} />
        {prefs.reminderHour !== null && (
          <TimeRow value={prefs.reminderHour} hours={askHours(prefs)} onChange={(h) => setHour(h)} label={hour} />
        )}

        {/* A block is information, not a tap: a quiet line naming where
            the fix is (iPhone Settings on an iPhone, #430), and an
            iPhone's Safari tab gets the two steps to the Home Screen. */}
        {line === "unsupported" && (
          <p data-reminder-line className="group-row text-caption text-stone-500">
            {plat.ios && !plat.standalone && !app ? (
              <>
                {ASK_COPY.install} <span className="font-semibold text-stone-600">{ASK_COPY.installSteps}</span>
              </>
            ) : (
              noNotificationsNote(app)
            )}
          </p>
        )}
        {line === "blocked" && (
          <p data-reminder-line className="group-row text-caption text-stone-500">
            {deniedLine(plat.ios)}
          </p>
        )}
        {(line === "ask" || line === "armed") && arm === "saving" && (
          <p data-reminder-line role="status" className="group-row text-caption text-stone-500">
            Saving
          </p>
        )}
        {(line === "ask" || line === "armed") && arm !== "saving" && (arm === "failed" || (line === "armed" && lapsed)) && (
          /* The server never took it: on a phone already on its Home
             Screen, never "install it" (#430). */
          <div data-reminder-line className="group-row">
            <ErrorLine onRetry={() => prefs.reminderHour !== null && turnOn(prefs.reminderHour)}>
              The reminder didn&apos;t reach the server.
            </ErrorLine>
          </div>
        )}
        {line === "ask" && arm === "idle" && (
          /* The screen's one tap, and only while it is a real blocker:
             an armed hour that cannot fire (#42). */
          <div className="group-row">
            <button
              type="button"
              onClick={() => prefs.reminderHour !== null && turnOn(prefs.reminderHour)}
              className={ACTION_CLASS}
            >
              Allow notifications
            </button>
          </div>
        )}
        {line === "armed" && arm === "idle" && !lapsed && (
          <p data-reminder-line className="group-row text-caption text-stone-500">
            <span className="font-semibold text-ink">
              {fireAt
                ? `Next: ${fireAt.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}.`
                : "That hour falls inside your quiet hours, so nothing will fire."}
            </span>{" "}
            {reminderTierNote(tier)}
          </p>
        )}
        {/* The whole path in ten seconds (#430): the server sends this
            phone's reminder now. */}
        {line === "armed" && arm === "idle" && tier === "push" && (
          <button
            type="button"
            onClick={sendTest}
            disabled={test === "sending"}
            className="group-row press-row flex w-full items-center gap-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="font-display block text-row">Send a test</span>
              <span role="status" className="mt-0.5 block text-caption text-pretty text-stone-500">
                {test === "sending"
                  ? "Sending"
                  : test === "sent"
                    ? "Sent. It arrives in a few seconds."
                    : test === "wait"
                      ? "One test a minute."
                      : test === "gone"
                        ? "This phone's reminder has lapsed. Turn it off and on."
                        : test === "failed"
                          ? "That didn't send. Tap to try again."
                          : "The server sends this phone's reminder now."}
              </span>
            </span>
          </button>
        )}
        <InfoRow label="Quiet hours" value={`${hour(prefs.quietFrom)} to ${hour(prefs.quietTo)}`} note="Nothing fires inside them." />
      </Section>
    </main>
  );
}

/**
 * The reminder's hour, as a row: its name, the hour it rings at, and the
 * phone's own picker under the whole row (#446). The same hours as the
 * glance offers (#430); an hour kept from before that now falls inside
 * quiet hours is still listed, so the row never shows a time it does
 * not hold.
 */
function TimeRow({
  value,
  hours,
  onChange,
  label,
}: {
  value: number;
  hours: number[];
  onChange: (h: number) => void;
  label: (h: number) => string;
}) {
  const options = hours.includes(value) ? hours : [...hours, value].sort((x, y) => x - y);
  return (
    <label className="group-row press-row flex w-full items-center gap-3 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-ink">
      <span className="font-display min-w-0 flex-1 text-row">Time</span>
      <span aria-hidden className="shrink-0 text-row font-normal text-stone-500 tabular-nums">
        {label(value)}
      </span>
      <PickerMark />
      {/* The reading step, 16px, so an iPhone does not zoom the page to it. */}
      <select
        data-reminder-hour
        aria-label="Reminder time"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none text-read opacity-0"
      >
        {options.map((h) => (
          <option key={h} value={h}>
            {label(h)}
          </option>
        ))}
      </select>
    </label>
  );
}
