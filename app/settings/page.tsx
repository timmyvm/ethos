"use client";

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
import { applyTheme } from "@/components/Theme";
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
      <main className="flex min-h-dvh flex-col items-center justify-center px-8 pb-24 text-center">
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
          className="press mt-6 text-[13.5px] font-semibold text-terracotta-700"
        >
          The door stays open →
        </Link>
      </main>
    );
  }

  const needsPermission = prefs.reminderHour !== null && perm !== "granted";

  return (
    <main className="px-5 pb-24 pt-7">
      <Link href="/you" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-stone-400">
        ← You
      </Link>
      <h1 className="font-display mt-4 text-[24px] font-extrabold">Settings</h1>

      {/* Reminders first: it's the habit lever, so it's the one thing
          people come back here to change. */}
      <Section title="Reminders">
        <p className="pb-2.5 text-[12.5px] leading-relaxed text-stone-500">
          One notification a day, maximum. It names the streak, never scolds
          you for missing it.
        </p>
        <div
          role="group"
          aria-label="Reminder hour"
          className="flex flex-wrap gap-1.5 pb-3"
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
            <p className="pb-3 text-[12.5px] leading-relaxed text-stone-500">
              Notifications are blocked for this site in your browser
              settings. Nothing can fire until that changes.
            </p>
          ) : (
            <button
              onClick={() => void askPermission()}
              className="press font-display mb-3 w-full rounded-xl bg-terracotta-500 px-4 py-3 text-[14px] font-bold text-cream transition-colors hover:bg-terracotta-600"
            >
              Allow notifications
            </button>
          ))}

        {prefs.reminderHour !== null && perm === "granted" && (
          <p className="pb-3 text-[12.5px] leading-relaxed text-stone-500">
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
        <div
          role="group"
          aria-label="Theme"
          className="flex gap-1.5 pb-3 pt-0.5"
        >
          {(["system", "light", "dark"] as Theme[]).map((t) => (
            <Choice
              key={t}
              selected={prefs.theme === t}
              onSelect={() => {
                update({ theme: t });
                applyTheme(t);
              }}
              className="flex-1 capitalize"
            >
              {t}
            </Choice>
          ))}
        </div>
        <Toggle
          label="Reduced motion"
          note="Skip the streak celebration animation. Your OS setting is honoured either way."
          on={prefs.reducedMotion}
          onChange={(v) => update({ reducedMotion: v })}
        />
      </Section>

      <Section title="Account">
        <InfoRow
          label={email ?? "Anonymous"}
          note={
            email
              ? "Your recordings follow this email anywhere."
              : "Everything you've recorded lives on this device. An account attaches to it where it is."
          }
        />
        {!email ? (
          <div className="py-3">
            <Link
              href="/signup"
              className="press font-display flex min-h-11 w-full items-center justify-between rounded-[10px] border border-stone-200 bg-surface px-4 py-[11px] text-[13.5px] font-bold hover:bg-sand"
            >
              <span>Create an account</span>
              <span aria-hidden className="text-stone-300">
                →
              </span>
            </Link>
          </div>
        ) : (
          <div className="py-3">
            <button
              onClick={async () => {
                await signOut();
                window.location.href = "/";
              }}
              className="press font-display min-h-11 w-full rounded-[10px] border border-stone-200 bg-surface px-4 py-[11px] text-[13.5px] font-bold hover:bg-sand"
            >
              Sign out
            </button>
            <p className="mt-1.5 text-[11.5px] text-stone-400">
              Signing out empties this device until you sign back in. Nothing
              is deleted.
            </p>
          </div>
        )}
      </Section>

      <Section title="Your data">
        <div className="py-3">
          <button
            onClick={() => void exportData()}
            disabled={exporting}
            className="press font-display min-h-11 w-full rounded-[10px] border border-stone-200 bg-surface px-4 py-[11px] text-[13.5px] font-bold hover:bg-sand disabled:opacity-50"
          >
            {exporting ? "Building your file…" : "Export everything as JSON"}
          </button>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-stone-400">
            Every recording, transcript, score and lexicon entry. Yours to
            take. Audio is stored so the numbers can be recomputed as the
            engine improves.
          </p>
        </div>
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
      <div className="mt-10 border-t border-hairline pt-4">
        {!arming ? (
          <button
            onClick={() => {
              setArming(true);
              setConfirmText("");
              setDeleteError(null);
            }}
            className="press font-display min-h-11 w-full rounded-[10px] border border-stone-200 bg-surface px-4 py-[11px] text-[13.5px] font-bold text-rust hover:bg-sand"
          >
            Delete my account
          </button>
        ) : (
          <div className="rounded-[14px] border border-edge bg-raised p-4">
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
              className="mt-1.5 w-full rounded-[10px] border border-stone-200 bg-raised px-4 py-2.5 text-[14px] font-semibold placeholder:text-stone-300 focus:border-stone-300"
            />
            {deleteError && (
              <p role="alert" className="mt-2 text-[12.5px] font-semibold text-rust">
                {deleteError}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void runDelete()}
                disabled={confirmText.trim() !== "DELETE" || deleting}
                className="press font-display min-h-11 flex-1 rounded-[10px] border border-stone-200 bg-surface px-4 py-2.5 text-[13px] font-bold text-rust disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete everything"}
              </button>
              <button
                onClick={() => setArming(false)}
                disabled={deleting}
                className="press font-display min-h-11 flex-1 rounded-[10px] border border-stone-200 bg-surface px-4 py-2.5 text-[13px] font-bold hover:bg-sand"
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
 * A named group of rows. The eyebrow and the hairline above it are the
 * whole container: #201's grammar, and eight bordered cards down one
 * screen is eight things of equal rank (#151's lesson, applied here).
 */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <h2 className="label-data border-t border-hairline pb-1 pt-3.5">
        {title}
      </h2>
      {children}
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
      className="press flex w-full items-start gap-3 border-b border-hairline py-3 text-left"
    >
      <span className="flex-1">
        <span className="font-display block text-[14px] font-bold">
          {label}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-stone-500">
          {note}
        </span>
      </span>
      {/*
       * Ink, not terracotta. A screen of five switches painted in the
       * tap colour is the wash brand.md's one-tap rule exists to
       * prevent, and a toggle is a STATE rather than an action.
       *
       * `ink` and not `stage`: ink SWAPS with the theme, so "on" is
       * always the high-contrast opposite of the ground. Stage is dark
       * in both themes, which drew a near-black track on the dark
       * ground and made an ON switch read quieter than an OFF one.
       *
       * The track stays round where everything else squared off (#201):
       * the pill shape is what makes a switch read as a switch.
       */}
      <span
        aria-hidden
        className={`mt-0.5 h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors ${
          on ? "bg-ink" : "bg-stone-200"
        }`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-ground transition-transform ${
            on ? "translate-x-4" : ""
          }`}
        />
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
      className={`press font-display min-h-11 rounded-[10px] border px-3.5 text-[13px] font-bold tabular-nums transition-colors ${
        selected
          ? "border-ink bg-ink text-ground"
          : "border-stone-200 bg-surface text-stone-600 hover:bg-sand"
      } ${className}`}
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
    <div className="border-b border-hairline py-3">
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
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-stone-500">
          {note}
        </p>
      )}
    </div>
  );
}

/** A door. Same row grammar as Tools and the shelf on /you. */
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
          <span className="mt-0.5 block text-[12.5px] leading-relaxed text-stone-500">
            {note}
          </span>
        )}
      </span>
      {value && (
        <span className="shrink-0 text-[12.5px] text-stone-400">{value}</span>
      )}
      <span aria-hidden className="shrink-0 text-stone-300">
        →
      </span>
    </>
  );

  const className =
    "press flex min-h-11 w-full items-center gap-3 border-b border-hairline py-3 text-left";

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
