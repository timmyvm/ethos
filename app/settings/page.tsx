"use client";

import { TapTick } from "@/components/ui/TapTick";
import { Disclosure } from "@/components/ui/Disclosure";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Segmented } from "@/components/ui/Segmented";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { deleteAccount, signOut } from "@/lib/auth";
import { fetchAllLexicon, fetchAllReps, fetchReps } from "@/lib/client-data";
import { readable } from "@/lib/load";
import {
  DEFAULT_PREFS,
  prefersReducedMotion,
  readPrefs,
  writePrefs,
  type Prefs,
  type Theme,
} from "@/lib/prefs";
import { applyMotion, applyTheme } from "@/components/Theme";
import { applyGraphics, liteGraphics, liteWhy, type LiteWhy } from "@/lib/graphics";
import { videoOffered } from "@/lib/pose-client";
import { hapticsHere } from "@/lib/tap-tick";
import { askedTextZoom } from "@/lib/text-size";
import { ManageSheet } from "@/components/premium/ManageSheet";
import { SettingsPlanRow, SettingsPlanRowSkeleton } from "@/components/premium/PlanCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorLine } from "@/components/ui/ErrorState";
import { DELETE_ANY_PLAN, deletePlanLine, hasPlan } from "@/lib/plan-view";
import { forgetPlanHint, keepPlanHint, readPlanHint, settingsRowSlot } from "@/lib/plan-hint";
import { usePlan, useStripeReturn, useStripeReturns } from "@/lib/use-plan";
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
import { SIGNED_OUT_HOME } from "@/lib/account-gate";
import { computeStreak } from "@/lib/streak";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useHourLabel } from "@/lib/time-label";
import { ACTION_CLASS, DISABLED_CLASS, INPUT_CLASS } from "@/lib/ui";
import { DOOR_COPY, TEST, TEST_COPY } from "@/content/tester";
import { isCurrentTester } from "@/lib/tester";
import { testDay, zoneDayKey } from "@/lib/tester-days";
import { fetchTester, forgetTesterHint, readTesterHint, testZoneHere } from "@/lib/tester-client";

/** Where the switch lands when it goes on: the evening, after the day. */
const DEFAULT_HOUR = 20;

/* The three answers (#286, the OS first), spelled as lib/theme.test.ts
   reads them, then labelled for A2's Segmented. */
const THEMES = (["system", "light", "dark"] as const satisfies readonly Theme[]).map(
  (t) => ({ value: t, label: `${t[0].toUpperCase()}${t.slice(1)}` })
);

/**
 * Settings. mechanics.md notification rules are enforced here, not left
 * to copy: quiet hours default 10pm–7am, and the reminder text is coach
 * register: loss-aversion is allowed, guilt is not.
 *
 * The reminder section states which scheduling tier the browser actually
 * gives us. A reminder that silently never fires is worse than none.
 *
 * Structure follows DECISIONS #205: seven named groups, ordered by how
 * often someone comes here to change them, every group a set of
 * hairline rows rather than a card, and the one irreversible action
 * alone at the bottom where nobody reaches it by accident.
 */
export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  /** Why this device went lite by itself (#412), read after mount. */
  const [why, setWhy] = useState<LiteWhy | null>(null);
  const [perm, setPerm] = useState<string>("default");
  /* Whether this browser has notifications at all, and whose browser it
     is when it is an app's own: read after mount. */
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
  /* Turning the reminder on: in flight, or the server never took it. */
  const [arm, setArm] = useState<"idle" | "saving" | "failed">("idle");
  const [test, setTest] = useState<"idle" | "sending" | TestOutcome>("idle");
  /** undefined while unknown (in flight, or both reads failed), null for
   *  no account (anonymous or no session), the address once signed in.
   *  Unknown is never drawn as "Anonymous" (DESIGN principle 8). */
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [didToday, setDidToday] = useState(false);
  const [arming, setArming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const deleteDoor = useRef<HTMLButtonElement>(null);
  const confirmCard = useRef<HTMLDivElement>(null);
  const confirmField = useRef<HTMLInputElement>(null);
  /*
   * The confirm opens where "Delete my account" stood, the last thing on
   * the page, and it is five times that row's height: its field landed
   * under the tab bar and both buttons below the screen (#445). It comes
   * into view whole and its field takes the focus, in the tap's own
   * stack so an iPhone raises its keyboard with it, the way an alert
   * with a field does.
   */
  function armDelete() {
    flushSync(() => {
      setArming(true);
      setConfirmText("");
      setDeleteError(null);
    });
    confirmField.current?.focus({ preventScroll: true });
    confirmCard.current?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }
  /** Backing out puts the focus back on the row that opened it. */
  function disarmDelete() {
    flushSync(() => setArming(false));
    deleteDoor.current?.focus({ preventScroll: true });
  }
  /* The next time the reminder rings. Read after mount and after every
     change that moves it, never during render: a clock read in render
     is a different answer on the server and the phone (#418). */
  const [fireAt, setFireAt] = useState<Date | null>(null);
  const hour = useHourLabel();
  /* The plan (docs/ladder-spec.md, surface 4): a live plan gets one row
     in the account's group, and it opens the manage sheet. Back from
     the portal, one sync takes the row Stripe now has. */
  const plan = usePlan();
  const stripeReturn = useStripeReturn();
  useStripeReturns(stripeReturn === "portal" ? "portal" : null, plan);
  const [managing, setManaging] = useState(false);
  /* Whether this device last saw a plan here (lib/plan-hint.ts): a
     subscriber's row holds its place from the first frame, before the
     billing read, and nothing under it moves when it lands. Read before
     paint, so a visit from You never draws the page without it. */
  const [hint, setHint] = useState(false);
  /* What this phone can do (#446): a row for something it cannot is a
     switch that does nothing. An iPhone takes no Video (#412), so it is
     not offered the camera score's bench. Haptics is offered wherever
     the phone can give one: a vibration, or on an iPhone the tap's tick
     (#449). Larger text is offered where the phone's text is set larger
     than the default and the screen has the room to follow it (#451).
     Read before paint, so no row is drawn and then taken away. */
  const [canBuzz, setCanBuzz] = useState(false);
  const [canVideo, setCanVideo] = useState(false);
  const [canGrow, setCanGrow] = useState(false);
  useLayoutEffect(() => {
    setHint(readPlanHint());
    setCanBuzz(hapticsHere());
    setCanVideo(videoOffered(liteGraphics()));
    setCanGrow(askedTextZoom() > 1);
  }, []);
  useEffect(() => {
    if (plan.today) keepPlanHint(plan.view, plan.failed);
  }, [plan.view, plan.failed, plan.today]);
  const planSlot = settingsRowSlot({
    view: plan.view,
    ready: plan.today !== null,
    failed: plan.failed,
    hint,
    signedIn: email !== null,
  });
  /* Deleting ends a plan at once, with no refund for the rest of its
     month: said in the confirm, before anyone types DELETE. A plan that
     is still unknown on a signed-in account is spoken of as "any plan". */
  const planKnown = plan.today !== null && plan.view.kind !== "unknown";
  const deleteLine = planKnown
    ? deletePlanLine(plan.view, plan.today as Date)
    : email !== null
      ? DELETE_ANY_PLAN
      : null;
  const [hadPlan, setHadPlan] = useState(false);
  /* Tester mode (docs/testers.md): the About group's last door is the
     code for everyone else, "Testing Ethos, On" for a tester, and
     "Testing Ethos, Agree again" for one on an older consent, whose door
     opens straight on the new one. The device's last answer paints
     first; the account's own row decides. */
  const [testing, setTesting] = useState<"no" | "on" | "renew">("no");
  /* The test's day for a current tester's row, "Day 2 of 14", and
     "Ended" after the 12th (#402); read with the hint, before paint. */
  const [testDayNow, setTestDayNow] = useState<number | null>(null);
  useLayoutEffect(() => {
    setTesting(readTesterHint() ? "on" : "no");
    setTestDayNow(testDay(zoneDayKey(Date.now(), testZoneHere())));
  }, []);
  useEffect(() => {
    fetchTester()
      .then((t) => setTesting(isCurrentTester(t) ? "on" : t ? "renew" : "no"))
      .catch(() => {});
  }, []);

  async function runDelete() {
    setDeleting(true);
    setDeleteError(null);
    const withPlan = planKnown ? hasPlan(plan.view) : email !== null;
    setHadPlan(planKnown && hasPlan(plan.view));
    const result = await deleteAccount({ plan: withPlan });
    if (!result.ok) {
      setDeleteError(result.error ?? "That didn't go through.");
      setDeleting(false);
      return;
    }
    // The server side is gone; empty the device to match. A fresh
    // visit should be a genuinely fresh start.
    cancelReminder();
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("ethos"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
    try {
      indexedDB.deleteDatabase("ethos-outbox");
    } catch {}
    setDeleted(true);
    setTimeout(() => {
      window.location.href = "/about";
    }, 3500);
  }

  useEffect(() => {
    setPrefs(readPrefs());
    setWhy(liteWhy());
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    else setCanNotify(false);
    setApp(inAppBrowser(navigator.userAgent));
    // Capability now, then the tier that's ACTUALLY live (push needs an
    // async look at the subscription) when it answers.
    setTier(reminderTier());
    currentTier()
      .then(setTier)
      .catch(() => {})
      .finally(() => setTierRead(true));
    setPlat(askPlatform());
    void readyRegistration().then(setReg);
    /* The stored session answers at once (offline too); the server then
       confirms it. auth-js hands a failed getUser back as user null with
       an error, which used to read as "no account": a failed server read
       keeps the session's answer instead. */
    const db = supabaseBrowser();
    if (!db) setEmail(null);
    else
      db.auth
        .getSession()
        .then(({ data }) => {
          const u = data.session?.user;
          if (!u) {
            setEmail(null);
            return;
          }
          setEmail(u.email ?? null);
          return db.auth.getUser().then(({ data: fresh, error }) => {
            if (!error) setEmail(fresh.user?.email ?? null);
          });
        })
        .catch(() => {});
    fetchReps()
      .then((reps) =>
        setDidToday(
          computeStreak(reps.map((r) => new Date(r.created_at))).didToday
        )
      )
      .catch(() => {});
  }, []);

  function update(patch: Partial<Prefs>) {
    setPrefs(writePrefs(patch));
  }

  /*
   * The switch and the hours (#430): turning the reminder on asks for
   * notifications in the same tap, through armInTap, whose first await is
   * the subscribe that raises the iPhone's Allow prompt. Nothing says it
   * is on until the server has it. Off is an answer the glance respects.
   */
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

  /**
   * Everything the app knows about you, as one JSON file. No account
   * needed to leave with your own data.
   */
  async function exportData() {
    setExporting(true);
    setExportFailed(false);
    try {
      // Every row, paged, and a failed read is a failure: an empty file
      // passed off as a backup is the worst thing this row could do,
      // one row above Delete my account.
      const read = await readable(
        () => Promise.all([fetchAllReps(), fetchAllLexicon()]),
        30_000
      );
      if (!read.ok) {
        setExportFailed(true);
        return;
      }
      const [reps, lexicon] = read.data;
      const blob = new Blob(
        [
          JSON.stringify(
            { exportedAt: new Date().toISOString(), reps, lexicon },
            null,
            2
          ),
        ],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ethos-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    setFireAt(
      prefs.reminderHour !== null
        ? nextFireTime(prefs.reminderHour, new Date(), prefs, didToday)
        : null
    );
  }, [prefs, didToday]);

  // The goodbye. Brief, warm, and it means it: by the time this
  // renders, the server holds nothing and the device is being emptied.
  if (deleted) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-8 pb-[var(--nav-clear)] text-center">
        <Image
          src="/demos-asleep.webp"
          alt=""
          width={160}
          height={160}
          className="demos w-[160px]"
        />
        <h1 className="font-display mt-5 text-title font-extrabold">
          All gone
        </h1>
        <p className="mt-2 max-w-[280px] text-body text-pretty text-stone-500">
          {hadPlan && "Plan ended. "}Recordings, scores, streaks, account: deleted. Thanks for
          speaking with us.
        </p>
        <Link href="/about" className="text-link mt-6 text-terracotta-700">
          The door stays open
        </Link>
      </main>
    );
  }

  const reminderOn = prefs.reminderHour !== null;
  const line = reminderOn ? reminderLine(perm, canNotify) : null;

  return (
    <main className="px-5 pb-[var(--nav-clear)] pt-7">
      <ScreenHeader title="Settings" back={{ href: "/you", label: "You" }} />

      {/* Reminders first: it's the habit lever, so it's the one thing
          people come back here to change. One switch says whether it
          rings (you-17); its Time row appears only while it does. */}
      <Section
        title="Reminders"
        footer="One notification a day, with a number from your last take."
      >
        <Toggle
          label="Daily reminder"
          on={reminderOn}
          onChange={(v) => setHour(v ? DEFAULT_HOUR : null)}
        />
        {prefs.reminderHour !== null && (
          <TimeRow
            value={prefs.reminderHour}
            hours={askHours(prefs)}
            onChange={(h) => setHour(h)}
            label={hour}
          />
        )}

        {/* The screen's one terracotta tap, and only while it is a real
            blocker: an armed hour that cannot fire is the broken state
            #42 exists to prevent. A block is information, not a tap, so
            it stays a quiet line naming where the fix is (iPhone Settings
            on an iPhone, #430), and so does a browser with no
            notifications at all: an iPhone's Safari tab gets the two
            steps to the Home Screen, never a tap that cannot work. */}
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
        {(line === "ask" || line === "armed") &&
          arm !== "saving" &&
          (arm === "failed" || (line === "armed" && plat.standalone && plat.push && tierRead && tier !== "push")) && (
            /* The server never took it: on a phone already on its Home
               Screen, never "install it" (#430). */
            <div data-reminder-line className="group-row">
              <ErrorLine onRetry={() => prefs.reminderHour !== null && turnOn(prefs.reminderHour)}>
                The reminder didn&apos;t reach the server.
              </ErrorLine>
            </div>
          )}
        {line === "ask" && arm === "idle" && (
          <div className="group-row">
            <button
              onClick={() => prefs.reminderHour !== null && turnOn(prefs.reminderHour)}
              className={ACTION_CLASS}
            >
              Allow notifications
            </button>
          </div>
        )}

        {line === "armed" &&
          arm === "idle" &&
          !(plat.standalone && plat.push && tierRead && tier !== "push") && (
            <p data-reminder-line className="group-row text-caption text-stone-500">
              <span className="font-semibold text-ink">
                {fireAt
                  ? `Next: ${fireAt.toLocaleString(undefined, {
                      weekday: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}.`
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

        <InfoRow
          label="Quiet hours"
          value={`${hour(prefs.quietFrom)} to ${hour(prefs.quietTo)}`}
          note="Nothing fires inside them."
        />
      </Section>

      {/* What changes how a recording actually runs. */}
      <Section title="Practice">
        <Toggle
          label="Frame step"
          note="30 seconds to plan before the clock starts."
          on={prefs.frameStep}
          onChange={(v) => update({ frameStep: v })}
        />
        <Toggle
          label="Verbatim transcripts"
          note="Keep every 'um' in the transcript. Off makes it prettier and the filler count wrong."
          on={prefs.verbatim}
          onChange={(v) => update({ verbatim: v })}
        />
        {/* The Presence bench (#187): four labeled takes tune the camera
            score's thresholds to a real body. Only where a take can be
            Video at all (#446). */}
        {canVideo && (
          <LinkRow
            href="/calibrate"
            label="Calibrate the camera score"
            note="Four short takes tune it to your body."
          />
        )}
      </Section>

      <Section title={canBuzz ? "Sound and haptics" : "Sound"}>
        <Toggle
          label="Sound"
          note="One chime at the streak celebration."
          on={prefs.sound}
          onChange={(v) => update({ sound: v })}
        />
        {canBuzz && (
          <Toggle
            label="Haptics"
            note="A tap when recording starts and stops."
            on={prefs.haptics}
            onChange={(v) => update({ haptics: v })}
          />
        )}
      </Section>

      <Section title="Appearance">
        <div className="group-row">
          {/* A2's shared control (you-19): one tab stop, the arrows move
              the choice, 40px segments in a 44px track. */}
          <Segmented
            label="Theme"
            options={THEMES}
            value={prefs.theme}
            onChange={(t) => {
              update({ theme: t });
              applyTheme(t);
            }}
          />
        </div>
        <Toggle
          label="Reduced motion"
          note="Every animation becomes a plain fade. Your phone's own setting still counts."
          on={prefs.reducedMotion}
          onChange={(v) => {
            update({ reducedMotion: v });
            applyMotion(v);
          }}
        />
        {/* #451: Ethos is shown at the size the phone's text is set to.
            The size is read as the page loads (lib/text-size.ts), so the
            switch saves and loads the page again: the one path that is
            the same as opening the app. */}
        {canGrow && (
          <Toggle
            label="Larger text"
            note="Follows your phone's text size."
            on={prefs.followTextSize}
            onChange={(v) => {
              update({ followTextSize: v });
              window.location.reload();
            }}
          />
        )}
        {/* #412: the switch shows what the phone draws now, chosen or
            not; once touched, it is the person's and the device's
            guesses stand aside. */}
        <Toggle
          label="Lite graphics"
          note={liteNote(prefs.liteGraphics === null ? why : null)}
          on={prefs.liteGraphics ?? why !== null}
          onChange={(v) => {
            update({ liteGraphics: v });
            applyGraphics(v);
            applyMotion(prefs.reducedMotion);
          }}
        />
      </Section>

      <Section
        title="Account"
        footer={
          email
            ? "Your recordings stay on your account when you sign out."
            : undefined
        }
      >
        {email === undefined ? (
          <InfoRowSkeleton />
        ) : (
          <InfoRow
            label={email ?? "Anonymous"}
            note={
              email
                ? "Your recordings follow this email anywhere."
                : "Everything you've recorded lives on this device. An account attaches to it where it is."
            }
          />
        )}
        {/* The plan's row: a skeleton at its height while the plan is
            unknown on a device that last saw one, a failed read said with
            its retry (the cancel path never silently gone), the row once
            it is known. The row is a direct .group-row, so the hairlines
            either side of it hold. */}
        {planSlot === "error" ? (
          <div className="group-row">
            <ErrorLine onRetry={plan.retry}>Premium didn&apos;t load.</ErrorLine>
          </div>
        ) : planSlot === "skeleton" ? (
          <SettingsPlanRowSkeleton />
        ) : planSlot === "row" && plan.today ? (
          <SettingsPlanRow
            view={plan.view}
            today={plan.today}
            onOpen={() => setManaging(true)}
            arrive={hint ? "line" : "row"}
          />
        ) : null}
        {email === undefined ? null : !email ? (
          <LinkRow href="/signup" label="Create an account" />
        ) : (
          <button
            onClick={async () => {
              await signOut();
              // The next account on this device is someone else's.
              forgetPlanHint();
              forgetTesterHint();
              // Sign-in, not Today: a signed-out device is asked to make an account there.
              window.location.href = SIGNED_OUT_HOME;
            }}
            className="group-row press-row font-display w-full text-left text-row"
          >
            Sign out
          </button>
        )}
      </Section>

      <Section
        title="Your data"
        footer="Every recording, transcript, score and lexicon entry, as one file."
      >
        <button
          onClick={() => void exportData()}
          disabled={exporting}
          className={`group-row press-row flex w-full items-center gap-3 text-left ${DISABLED_CLASS}`}
        >
          <span className="font-display min-w-0 flex-1 text-row">
            {exporting ? "Building your file…" : "Export everything"}
          </span>
          {/* The row's affordance (you-18): a download mark in the
              functional glyph colour, never a hue. */}
          <svg
            aria-hidden
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-stone-400"
          >
            <path d="M12 4v11" />
            <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
            <path d="M5 19.5h14" />
          </svg>
        </button>
        {/* A read that failed builds no file: said here, with its retry,
            as a direct .group-row like the plan's failed read above. */}
        {exportFailed && (
          <div className="group-row">
            <ErrorLine onRetry={() => void exportData()}>
              Your file didn&apos;t build, so nothing was downloaded.
            </ErrorLine>
          </div>
        )}
      </Section>

      {/* The group the app never had: the three pages it already ships
          were reachable from the footer of a marketing page and nowhere
          else (#205). `from=settings` tells them where back goes
          (marketing-2, marketing-3). */}
      <Section title="About">
        <LinkRow href="/about?from=settings" label="What Ethos is" />
        <LinkRow href="/privacy?from=settings" label="Privacy" />
        <LinkRow href="/terms?from=settings" label="Terms" />
        <LinkRow
          href="/tester?from=settings"
          label={testing === "no" ? DOOR_COPY.settingsCode : DOOR_COPY.settingsTesting}
          value={
            testing === "on"
              ? testDayNow !== null && testDayNow > TEST.days
                ? // Collection carries on after the test (#405), so the row
                  // says On, and opens on Stop testing (#416), never Ended.
                  DOOR_COPY.settingsOn
                : testDayNow !== null && testDayNow >= 1
                  ? TEST_COPY.settingsDay(testDayNow)
                  : DOOR_COPY.settingsOn
              : testing === "renew"
                ? DOOR_COPY.settingsRenew
                : undefined
          }
        />
        <LinkRow
          href="mailto:hello@speakethos.com"
          label="Email us"
          value="hello@speakethos.com"
          external
        />
      </Section>

      {/*
       * Last on the page, alone, behind a typed confirmation. The
       * article's rule and ours agree: an irreversible action never
       * sits where a thumb lands on the way to something else, and it
       * never wears the colour that means "tap this" (DESIGN-RULES:
       * confirm only destructive and irreversible).
       */}
      <div className="mt-10">
        {!arming ? (
          <div className="inset-group">
            <button
              ref={deleteDoor}
              onClick={armDelete}
              className="group-row press-row font-display w-full text-center text-row text-destructive"
            >
              Delete my account
            </button>
          </div>
        ) : (
          <div ref={confirmCard} className="card scroll-mb-[var(--nav-clear)] scroll-mt-16 p-4">
            <p className="text-read text-pretty text-stone-800">
              This permanently deletes every recording, transcript, score,
              streak and the account itself.
            </p>
            {deleteLine && <p className="mt-2 text-read text-pretty text-stone-800">{deleteLine}</p>}
            <label className="eyebrow mt-4 block" htmlFor="delete-confirm">
              Type DELETE to confirm
            </label>
            <input
              ref={confirmField}
              id="delete-confirm"
              name="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => {
                // Return puts the keyboard away and deletes nothing: the
                // one tap that does is the button, in sight once it has.
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape" && !deleting) disarmDelete();
              }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoCapitalize="characters"
              enterKeyHint="done"
              placeholder="DELETE"
              className={`${INPUT_CLASS} mt-1.5`}
            />
            {deleteError && (
              <p role="alert" className="mt-2 text-caption font-semibold text-rust">
                {deleteError}
              </p>
            )}
            {/* The way back leads, the deletion trails: the order every
                confirm on the phone uses, so a thumb that knows where
                Cancel is finds "Keep it" there (#445). */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={disarmDelete}
                disabled={deleting}
                className={`press font-display min-h-11 flex-1 rounded-tap border border-edge bg-surface px-4 py-2.5 text-row ${DISABLED_CLASS}`}
              >
                Keep it
              </button>
              <button
                onClick={() => void runDelete()}
                disabled={confirmText.trim() !== "DELETE" || deleting}
                className={`press font-display min-h-11 flex-1 rounded-tap border border-edge bg-surface px-4 py-2.5 text-row text-destructive ${DISABLED_CLASS}`}
              >
                {deleting ? "Deleting…" : "Delete everything"}
              </button>
            </div>
          </div>
        )}
      </div>

      {managing && plan.today && (
        <ManageSheet
          view={plan.view}
          today={plan.today}
          onClose={() => setManaging(false)}
          onPlan={(row, premium) => plan.adopt(row, premium)}
        />
      )}
    </main>
  );
}

/**
 * A named group of rows, iOS's inset grouped list (the apple-design
 * skill: familiarity). The rows share one rounded surface and are told
 * apart by hairlines inset from the leading edge; the header is small
 * over the group and the explanation, when there is one, is small
 * under it, so the rows themselves stay one line of name and state.
 * People have used this screen in every app on their phone.
 */
function Section({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      {title && <h2 className="group-head">{title}</h2>}
      <div className="inset-group">{children}</div>
      {footer && <div className="group-foot">{footer}</div>}
    </section>
  );
}

/**
 * One preference, as a row. `role="switch"` sits on the BUTTON. It was
 * on an inner span before, which made the control a button containing a
 * switch to a screen reader and left the state announcement on an
 * element nobody could focus.
 */
function Toggle({
  label,
  note,
  on,
  onChange,
}: {
  label: string;
  note?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="group-row press-row flex w-full items-center gap-3 text-left"
    >
      <span className="flex-1">
        <span className="font-display block text-row">{label}</span>
        {note && (
          <span className="mt-0.5 block text-caption text-pretty text-stone-500">
            {note}
          </span>
        )}
      </span>
      {/*
       * Ink, not terracotta: a toggle is a state, not an action, and a
       * screen of five switches in the tap colour is the wash brand.md's
       * one-tap rule exists to prevent. Ink swaps with the theme, so ON
       * is always the high-contrast opposite of the ground.
       *
       * iOS proportions: a 48 by 29 track and a knob that casts a
       * shadow, travelling on the snappy spring (apple-design §4).
       */}
      <span aria-hidden className="switch" data-on={on || undefined}>
        <span className="switch-knob" />
      </span>
      {/* A switch ticks when it is thrown, as every switch on the phone
          does (#449). */}
      <TapTick />
    </button>
  );
}

/**
 * The reminder's hour, as a row: its name, the hour it rings at, and
 * the phone's own picker under the whole row (#446, breaking #349's
 * 3x2 grid). The grid offered six hours and the results glance offers
 * every hour outside quiet hours (#430), so an hour chosen there (9 am)
 * left Settings with the switch on over six unlit options: a control
 * that could not show its own value. One picker and the same hours in
 * both places; an hour kept from before that now falls inside quiet
 * hours is still listed, so the row never shows a time it does not hold.
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
      {/* The mark iOS puts on a row that opens a list of values. */}
      <svg
        aria-hidden
        width="9"
        height="14"
        viewBox="0 0 9 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-stone-400"
      >
        <path d="m1.5 5 3-3.2 3 3.2M1.5 9l3 3.2 3-3.2" />
      </svg>
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

/** A fact, not a control: quiet hours, the account you're signed into. */
/** The account row while it is unknown: its two lines' height, no words. */
function InfoRowSkeleton() {
  return (
    <div className="group-row" aria-busy="true">
      <Skeleton className="h-[18px] w-40" />
      <Skeleton className="mt-1.5 h-3.5 w-56" />
    </div>
  );
}

function InfoRow({
  label,
  value,
  note,
}: {
  label: string;
  value?: string;
  note?: string;
}) {
  return (
    <div className="group-row">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display min-w-0 truncate text-row">
          {label}
        </span>
        {value && (
          <span className="shrink-0 text-row font-normal text-stone-500 tabular-nums">
            {value}
          </span>
        )}
      </div>
      {note && (
        <p className="mt-0.5 text-caption text-stone-500">
          {note}
        </p>
      )}
    </div>
  );
}

/** A door. Same row grammar as Practice and the shelf on /you. */
function LinkRow({
  href,
  label,
  note,
  value,
  external = false,
}: {
  href: string;
  label: string;
  note?: string;
  value?: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="font-display block text-row">{label}</span>
        {note && (
          <span className="mt-0.5 block text-caption text-pretty text-stone-500">
            {note}
          </span>
        )}
      </span>
      {value && (
        <span className="shrink-0 text-row font-normal text-stone-500">
          {value}
        </span>
      )}
      <Disclosure />
    </>
  );

  const className = "group-row press-row flex w-full items-center gap-3 text-left";

  return external ? (
    <a href={href} className={className}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

/** What the Lite graphics switch says under it (#412). */
function liteNote(why: LiteWhy | null): string {
  const what = "Demos stands still and nothing blurs or loops, for phones that struggle.";
  if (why === "crash") return `On because Ethos closed on this phone. ${what}`;
  if (why === "gpu") return `On because this phone's graphics gave out. ${what}`;
  if (why === "device") return `On for this iPhone. ${what}`;
  return what;
}
