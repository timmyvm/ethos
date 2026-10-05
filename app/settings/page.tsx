"use client";

import { Disclosure } from "@/components/ui/Disclosure";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Segmented } from "@/components/ui/Segmented";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { deleteAccount, signOut } from "@/lib/auth";
import { fetchLexicon, fetchReps } from "@/lib/client-data";
import {
  DEFAULT_PREFS,
  readPrefs,
  writePrefs,
  type Prefs,
  type Theme,
} from "@/lib/prefs";
import { applyMotion, applyTheme } from "@/components/Theme";
import {
  armReminder,
  cancelReminder,
  currentTier,
  disarmPush,
  nextFireTime,
  reminderTier,
  reminderTierNote,
  type ReminderTier,
} from "@/lib/reminders";
import { computeStreak } from "@/lib/streak";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useHourLabel } from "@/lib/time-label";
import { ACTION_CLASS, DISABLED_CLASS, INPUT_CLASS } from "@/lib/ui";
import { useRovingRadio, type RovingItemProps } from "@/lib/use-roving-radio";

/** The hours a reminder can ring at: two rows of three (you-17). */
const HOURS = [7, 8, 12, 18, 20, 21] as const;
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
  const [perm, setPerm] = useState<string>("default");
  const [tier, setTier] = useState<ReminderTier>("unsupported");
  const [email, setEmail] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [didToday, setDidToday] = useState(false);
  const [arming, setArming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  /* The next time the reminder rings. Read after mount and after every
     change that moves it, never during render: a clock read in render
     is a different answer on the server and the phone (#418). */
  const [fireAt, setFireAt] = useState<Date | null>(null);
  const hour = useHourLabel();

  async function runDelete() {
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteAccount();
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
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    // Capability now, then the tier that's ACTUALLY live (push needs an
    // async look at the subscription) when it answers.
    setTier(reminderTier());
    currentTier()
      .then(setTier)
      .catch(() => {});
    supabaseBrowser()
      ?.auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
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

  async function setHour(h: number | null) {
    update({ reminderHour: h });
    if (h === null) {
      cancelReminder();
      void disarmPush();
      setTier(reminderTier());
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      return;
    }
    await rearm();
  }

  async function rearm() {
    const reps = await fetchReps().catch(() => []);
    const s = computeStreak(reps.map((r) => new Date(r.created_at)));
    setDidToday(s.didToday);
    const armed = await armReminder({ streak: s.current, didToday: s.didToday });
    if (armed) setTier(armed);
  }

  async function askPermission() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") {
      new Notification("Ethos", {
        body: "That's the reminder. One a day, never more.",
      });
      await rearm();
    }
  }

  /**
   * Everything the app knows about you, as one JSON file. No account
   * needed to leave with your own data.
   */
  async function exportData() {
    setExporting(true);
    try {
      const [reps, lexicon] = await Promise.all([
        fetchReps(1000).catch(() => []),
        fetchLexicon(1000).catch(() => []),
      ]);
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
          All gone.
        </h1>
        <p className="mt-2 max-w-[280px] text-body text-pretty text-stone-500">
          Recordings, scores, streaks, account: deleted. Thanks for
          speaking with us.
        </p>
        <Link href="/about" className="text-link mt-6 text-terracotta-700">
          The door stays open
        </Link>
      </main>
    );
  }

  const reminderOn = prefs.reminderHour !== null;
  const needsPermission = reminderOn && perm !== "granted";

  return (
    <main className="px-5 pb-[var(--nav-clear)] pt-7">
      <ScreenHeader title="Settings" back={{ href: "/you", label: "You" }} />

      {/* Reminders first: it's the habit lever, so it's the one thing
          people come back here to change. One switch says whether it
          rings (you-17); the hours appear only while it does, so the
          ink "Off" slab, the heaviest object on the screen, is gone. */}
      <Section
        title="Reminders"
        footer="One notification a day, naming your streak."
      >
        <Toggle
          label="Daily reminder"
          on={reminderOn}
          onChange={(v) => void setHour(v ? DEFAULT_HOUR : null)}
        />
        {reminderOn && (
          <HourSet
            value={prefs.reminderHour}
            onChange={(h) => void setHour(h)}
            label={hour}
          />
        )}

        {/* The screen's one terracotta tap, and only while it is a real
            blocker: an armed hour that cannot fire is the broken state
            #42 exists to prevent. A browser-level block is information,
            not a tap, so it stays a quiet line. */}
        {needsPermission &&
          (perm === "denied" ? (
            <p className="group-row text-caption text-stone-500">
              Notifications are blocked for this site in your browser
              settings. Nothing can fire until that changes.
            </p>
          ) : (
            <div className="group-row">
              <button
                onClick={() => void askPermission()}
                className={ACTION_CLASS}
              >
                Allow notifications
              </button>
            </div>
          ))}

        {reminderOn && perm === "granted" && (
          <p className="group-row text-caption text-stone-500">
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
            score's thresholds to a real body. */}
        <LinkRow
          href="/calibrate"
          label="Calibrate the camera score"
          note="Four short takes tune it to your body."
        />
      </Section>

      <Section title="Sound and haptics">
        <Toggle
          label="Sound"
          note="One chime at the streak celebration."
          on={prefs.sound}
          onChange={(v) => update({ sound: v })}
        />
        <Toggle
          label="Haptics"
          note="A tap when recording starts and stops."
          on={prefs.haptics}
          onChange={(v) => update({ haptics: v })}
        />
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
          note="Every animation becomes a plain fade. Your OS setting is honoured either way."
          on={prefs.reducedMotion}
          onChange={(v) => {
            update({ reducedMotion: v });
            applyMotion(v);
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
        <InfoRow
          label={email ?? "Anonymous"}
          note={
            email
              ? "Your recordings follow this email anywhere."
              : "Everything you've recorded lives on this device. An account attaches to it where it is."
          }
        />
        {!email ? (
          <LinkRow href="/signup" label="Create an account" />
        ) : (
          <button
            onClick={async () => {
              await signOut();
              window.location.href = "/";
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
            {exporting ? "Building your file…" : "Export everything as JSON"}
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
              onClick={() => {
                setArming(true);
                setConfirmText("");
                setDeleteError(null);
              }}
              className="group-row press-row font-display w-full text-center text-row text-rust"
            >
              Delete my account
            </button>
          </div>
        ) : (
          <div className="card p-4">
            <p className="text-read text-pretty text-stone-800">
              This permanently deletes every recording, transcript, score,
              streak and the account itself.
            </p>
            <label className="eyebrow mt-4 block" htmlFor="delete-confirm">
              Type DELETE to confirm
            </label>
            <input
              id="delete-confirm"
              name="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="characters"
              placeholder="DELETE"
              className={`${INPUT_CLASS} mt-1.5`}
            />
            {deleteError && (
              <p role="alert" className="mt-2 text-caption font-semibold text-rust">
                {deleteError}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void runDelete()}
                disabled={confirmText.trim() !== "DELETE" || deleting}
                className={`press font-display min-h-11 flex-1 rounded-control border border-edge bg-surface px-4 py-2.5 text-row text-rust ${DISABLED_CLASS}`}
              >
                {deleting ? "Deleting…" : "Delete everything"}
              </button>
              <button
                onClick={() => setArming(false)}
                disabled={deleting}
                className={`press font-display min-h-11 flex-1 rounded-control border border-edge bg-surface px-4 py-2.5 text-row ${DISABLED_CLASS}`}
              >
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>
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
    </button>
  );
}

/**
 * The reminder's hour: one radio group (you-19), two rows of three that
 * end flush with the row (you-17). `grid!` because `.group-row` sets
 * its display outside the utility layer. It wears the segmented control's
 * grammar, a quiet track per option and a raised thumb on the chosen
 * one, so the screen shows a choice one way, not two (system-13).
 */
function HourSet({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (h: number) => void;
  label: (h: number) => string;
}) {
  const { getItemProps } = useRovingRadio<number>({
    values: HOURS,
    value,
    onChange,
  });
  return (
    <div
      role="radiogroup"
      aria-label="Reminder hour"
      className="group-row grid! grid-cols-3 gap-1.5"
    >
      {HOURS.map((h, i) => (
        <Choice
          key={h}
          selected={value === h}
          onSelect={() => onChange(h)}
          {...getItemProps(h, i)}
        >
          {label(h)}
        </Choice>
      ))}
    </div>
  );
}

/** One option in the hour set: a radio, roved by its group. */
function Choice({
  selected,
  onSelect,
  children,
  tabIndex,
  onKeyDown,
  ref,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
} & RovingItemProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      ref={ref}
      onClick={onSelect}
      className={`press font-display min-h-11 w-full rounded-control border px-2 text-link font-bold tabular-nums transition-colors ${
        selected
          ? "border-transparent bg-raised text-ink shadow-[var(--shadow-1)] dark:bg-[#4a4a4a] dark:shadow-[0_0_0_0.5px_rgb(255_255_255/0.08)]"
          : "border-transparent bg-[color-mix(in_srgb,var(--color-ink)_7%,transparent)] text-stone-600"
      }`}
    >
      {children}
    </button>
  );
}

/** A fact, not a control: quiet hours, the account you're signed into. */
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
