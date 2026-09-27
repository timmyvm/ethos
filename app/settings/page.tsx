"use client";

import { Disclosure } from "@/components/ui/Disclosure";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
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

/**
 * Settings. mechanics.md notification rules are enforced here, not left
 * to copy: quiet hours default 10pm–7am, and the reminder text is coach
 * register — loss-aversion is allowed, guilt is not.
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

  const fireAt =
    prefs.reminderHour !== null
      ? nextFireTime(prefs.reminderHour, new Date(), prefs, didToday)
      : null;

  // The goodbye. Brief, warm, and it means it: by the time this
  // renders, the server holds nothing and the device is being emptied.
  if (deleted) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-8 pb-22 text-center">
        <Image
          src="/demos-asleep.webp"
          alt=""
          width={160}
          height={160}
          className="demos w-[160px]"
        />
        <h1 className="font-display mt-5 text-[27px] font-extrabold">
          All gone.
        </h1>
        <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-stone-500">
          Recordings, scores, streaks, account: deleted. Thanks for
          speaking with us.
        </p>
        <Link
          href="/about"
          className="press mt-6 text-[13px] font-semibold text-terracotta-700"
        >
          The door stays open →
        </Link>
      </main>
    );
  }

  const needsPermission = prefs.reminderHour !== null && perm !== "granted";

  return (
    <main className="px-5 pb-22 pt-7">
      <ScreenHeader title="Settings" back={{ href: "/you", label: "You" }} />

      {/* Reminders first: it's the habit lever, so it's the one thing
          people come back here to change. */}
      <Section
        title="Reminders"
        footer="One notification a day, maximum. It names the streak, never scolds you for missing it."
      >
        <div
          role="group"
          aria-label="Reminder hour"
          className="group-row flex flex-wrap gap-1.5"
        >
          {[null, 7, 8, 12, 18, 20, 21].map((h) => (
            <Choice
              key={String(h)}
              selected={prefs.reminderHour === h}
              onSelect={() => void setHour(h)}
            >
              {h === null ? "Off" : `${String(h).padStart(2, "0")}:00`}
            </Choice>
          ))}
        </div>

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
                className="press font-display w-full rounded-control bg-terracotta-500 px-4 py-3 text-[14px] font-bold text-on-accent transition-colors hover:bg-terracotta-600"
              >
                Allow notifications
              </button>
            </div>
          ))}

        {prefs.reminderHour !== null && perm === "granted" && (
          <p className="group-row text-caption text-stone-500">
            <span className="font-semibold text-ink">
              {fireAt
                ? `Next: ${fireAt.toLocaleString(undefined, {
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}.`
                : "That hour falls inside your quiet hours, so nothing will fire."}
            </span>{" "}
            {reminderTierNote(tier)}
          </p>
        )}

        <InfoRow
          label="Quiet hours"
          value={`${String(prefs.quietFrom).padStart(2, "0")}:00 to ${String(
            prefs.quietTo
          ).padStart(2, "0")}:00`}
          note="Nothing fires inside them."
        />
      </Section>

      {/* What changes how a recording actually runs. */}
      <Section title="Practice">
        <Toggle
          label="Frame step"
          note="30 seconds of think-time before the clock starts. Trains deciding before speaking."
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
          note="One chime at the streak celebration. Never while you record, since the mic would hear it."
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
          <Segmented
            label="Theme"
            options={["system", "light", "dark"] as const satisfies readonly Theme[]}
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
            ? "Signing out empties this device until you sign back in. Nothing is deleted."
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
            className="group-row press-row font-display w-full text-left text-[15px] font-bold"
          >
            Sign out
          </button>
        )}
      </Section>

      <Section
        title="Your data"
        footer="Every recording, transcript, score and lexicon entry. Yours to take. Audio is stored so the numbers can be recomputed as the engine improves."
      >
        <button
          onClick={() => void exportData()}
          disabled={exporting}
          className="group-row press-row font-display w-full text-left text-[15px] font-bold disabled:opacity-50"
        >
          {exporting ? "Building your file…" : "Export everything as JSON"}
        </button>
      </Section>

      {/* The group the app never had: the three pages it already ships
          were reachable from the footer of a marketing page and nowhere
          else (#205). */}
      <Section title="About">
        <LinkRow href="/about" label="What Ethos is" />
        <LinkRow href="/privacy" label="Privacy" />
        <LinkRow href="/terms" label="Terms" />
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
          <div className="group">
            <button
              onClick={() => {
                setArming(true);
                setConfirmText("");
                setDeleteError(null);
              }}
              className="group-row press-row font-display w-full text-center text-[15px] font-bold text-rust"
            >
              Delete my account
            </button>
          </div>
        ) : (
          <div className="elev-1 rounded-card border border-card-edge bg-raised p-4">
            <p className="text-[13px] font-semibold leading-relaxed">
              This deletes every recording, transcript, score, streak and the
              account itself. There is no undo.
            </p>
            <label className="label-data mt-3 block" htmlFor="delete-confirm">
              Type DELETE to confirm
            </label>
            <input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              placeholder="DELETE"
              className="mt-1.5 w-full rounded-control border border-edge bg-surface px-4 py-2.5 text-[14px] font-semibold placeholder:text-stone-400 focus:border-terracotta-500"
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
                className="press font-display min-h-11 flex-1 rounded-control border border-edge bg-surface px-4 py-2.5 text-[13px] font-bold text-rust disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete everything"}
              </button>
              <button
                onClick={() => setArming(false)}
                disabled={deleting}
                className="press font-display min-h-11 flex-1 rounded-control border border-edge bg-surface px-4 py-2.5 text-[13px] font-bold hover:bg-sand"
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
    <section className="mt-8">
      {title && <h2 className="group-head">{title}</h2>}
      <div className="group">{children}</div>
      {footer && <div className="group-foot">{footer}</div>}
    </section>
  );
}


/**
 * One preference, as a row. `role="switch"` sits on the BUTTON — it was
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
  note: string;
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
        <span className="font-display block text-[14px] font-bold">
          {label}
        </span>
        <span className="mt-0.5 block text-caption text-stone-500">
          {note}
        </span>
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

/** One option in a mutually exclusive set: hours, themes. */
function Choice({
  selected,
  onSelect,
  className = "",
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-pressed={selected}
      onClick={onSelect}
      className={`press font-display min-h-11 rounded-control border px-3.5 text-[13px] font-bold tabular-nums transition-colors ${
        selected
          ? "border-ink bg-ink text-ground"
          : "border-edge bg-raised text-stone-600 hover:bg-sand"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * iOS's segmented control: one track, one raised thumb that slides to
 * the chosen segment on a spring rather than a fill that jumps. The
 * segments are equal and the thumb is one of them wide, so its travel
 * is a percentage and holds at any width.
 */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  const index = Math.max(0, options.indexOf(value));
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="segmented"
      style={{ "--segments": options.length } as React.CSSProperties}
    >
      <span
        aria-hidden
        className="segmented-thumb"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o}
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className="segmented-option capitalize"
        >
          {o}
        </button>
      ))}
    </div>
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
        <span className="font-display min-w-0 truncate text-[14px] font-bold">
          {label}
        </span>
        {value && (
          <span className="shrink-0 text-[13px] text-stone-500 tabular-nums">
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
        <span className="font-display block text-[14px] font-bold">
          {label}
        </span>
        {note && (
          <span className="mt-0.5 block text-caption text-stone-500">
            {note}
          </span>
        )}
      </span>
      {value && (
        <span className="shrink-0 text-caption text-stone-400">{value}</span>
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
