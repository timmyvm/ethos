"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth";
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
  nextFireTime,
  reminderTier,
  reminderTierNote,
  type ReminderTier,
} from "@/lib/reminders";
import { computeStreak } from "@/lib/streak";
import { supabaseBrowser } from "@/lib/supabase-browser";

/**
 * Settings. mechanics.md notification rules are enforced here, not left
 * to copy: one reminder a day maximum, quiet hours default 10pm–7am,
 * and the reminder text is coach register — loss-aversion is allowed,
 * guilt is not.
 *
 * The reminder card states which scheduling tier the browser actually
 * gives us. A reminder that silently never fires is worse than none.
 */
export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [perm, setPerm] = useState<string>("default");
  const [tier, setTier] = useState<ReminderTier>("unsupported");
  const [email, setEmail] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setPrefs(readPrefs());
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    setTier(reminderTier());
    supabaseBrowser()
      ?.auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => {});
  }, []);

  function update(patch: Partial<Prefs>) {
    setPrefs(writePrefs(patch));
  }

  async function setHour(h: number | null) {
    update({ reminderHour: h });
    if (h === null) {
      cancelReminder();
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
    await armReminder({ streak: s.current, didToday: s.didToday });
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
    prefs.reminderHour !== null ? nextFireTime(prefs.reminderHour, new Date(), prefs) : null;

  return (
    <main className="px-5 pb-24 pt-7">
      <Link href="/you" className="text-sm text-stone-500">
        ← you
      </Link>
      <h1 className="font-display mt-4 text-2xl font-bold">Settings</h1>

      <div className="section-title mt-7">Daily reminder</div>
      <div className="mt-2 rounded-[18px] border border-hairline bg-surface lift p-5">
        <p className="text-[13px] leading-relaxed text-stone-500">
          One notification a day, maximum. It names the streak, never
          scolds you for missing it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[null, 7, 8, 12, 18, 20, 21].map((h) => (
            <button
              key={String(h)}
              onClick={() => void setHour(h)}
              className={`rounded-full px-3.5 py-2 text-[13px] font-semibold ${
                prefs.reminderHour === h
                  ? "bg-terracotta-500 text-cream"
                  : "bg-sand text-stone-600"
              }`}
            >
              {h === null ? "Off" : `${String(h).padStart(2, "0")}:00`}
            </button>
          ))}
        </div>

        {prefs.reminderHour !== null && perm !== "granted" && (
          <button
            onClick={() => void askPermission()}
            className="mt-3 w-full rounded-[14px] border border-terracotta-200 bg-terracotta-50 px-4 py-3 text-[13.5px] font-semibold"
          >
            {perm === "denied"
              ? "Notifications blocked in your browser"
              : "Allow notifications"}
          </button>
        )}

        {prefs.reminderHour !== null && perm === "granted" && (
          <div className="mt-3 rounded-[14px] bg-sand px-4 py-3 text-[12.5px] leading-relaxed text-stone-600">
            <span className="font-semibold">
              {fireAt
                ? `Next: ${fireAt.toLocaleString(undefined, {
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}.`
                : "That hour falls inside your quiet hours — nothing will fire."}
            </span>{" "}
            {reminderTierNote(tier)}
          </div>
        )}

        <div className="mt-3 border-t border-sand pt-3 text-[12.5px] text-stone-500">
          Quiet hours {String(prefs.quietFrom).padStart(2, "0")}:00 –{" "}
          {String(prefs.quietTo).padStart(2, "0")}:00. Nothing fires inside
          them.
        </div>
      </div>

      <div className="section-title mt-7">Appearance</div>
      <div className="mt-2 rounded-[18px] border border-hairline bg-surface lift p-5">
        <div className="flex gap-2">
          {(["system", "light", "dark"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                update({ theme: t });
                applyTheme(t);
              }}
              className={`press flex-1 rounded-[12px] px-3 py-2.5 text-[13px] font-semibold capitalize ${
                prefs.theme === t
                  ? "bg-terracotta-500 text-cream"
                  : "bg-sand text-stone-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-stone-500">
          Dark keeps the same warm neutrals — no cool greys, no pure
          black. Terracotta and amber never change: they mean &ldquo;tap
          this&rdquo; and &ldquo;you earned this&rdquo;, and a colour that
          carries meaning has to read the same in both.
        </p>
      </div>

      <div className="section-title mt-7">The rep</div>
      <div className="mt-2 divide-y divide-sand rounded-[18px] border border-hairline bg-surface lift">
        <Toggle
          label="Frame step"
          note="30 seconds of think-time before the clock starts. Trains deciding before speaking."
          on={prefs.frameStep}
          onChange={(v) => update({ frameStep: v })}
        />
        <Toggle
          label="Haptics"
          note="A tap when recording starts and stops."
          on={prefs.haptics}
          onChange={(v) => update({ haptics: v })}
        />
        <Toggle
          label="Sound"
          note="One synthesized chime at the streak celebration. Never while you record — the mic would hear it."
          on={prefs.sound}
          onChange={(v) => update({ sound: v })}
        />
        <Toggle
          label="Verbatim transcripts"
          note="Keep every 'um' in the transcript. Off makes it prettier and the filler count wrong."
          on={prefs.verbatim}
          onChange={(v) => update({ verbatim: v })}
        />
        <Toggle
          label="Reduced motion"
          note="Skip the streak celebration animation. Your OS setting is honoured either way."
          on={prefs.reducedMotion}
          onChange={(v) => update({ reducedMotion: v })}
        />
      </div>

      <div className="section-title mt-7">Account</div>
      <div className="mt-2 rounded-[18px] border border-hairline bg-surface lift p-5">
        <div className="text-[14px] font-semibold">
          {email ?? "Anonymous — this device only"}
        </div>
        <p className="mt-1 text-[12.5px] text-stone-500">
          {email
            ? "Your reps follow this email anywhere."
            : "Everything you've recorded lives on this device. An account attaches to it where it already is — nothing moves, so nothing can go missing."}
        </p>
        {!email && (
          <Link
            href="/signup"
            className="press mt-3 block w-full rounded-[14px] bg-terracotta-500 px-4 py-3 text-center text-[13.5px] font-semibold text-cream"
          >
            Create an account
          </Link>
        )}
        <button
          onClick={() => void exportData()}
          disabled={exporting}
          className="mt-3 w-full rounded-[14px] border border-black/10 px-4 py-3 text-[13.5px] font-semibold disabled:opacity-50"
        >
          {exporting ? "Building your file…" : "Export everything as JSON"}
        </button>
        <p className="mt-1.5 text-[11.5px] text-stone-400">
          Every rep, transcript, score and lexicon entry. Yours to take.
        </p>

        {email && (
          <>
            <button
              onClick={async () => {
                await signOut();
                window.location.href = "/";
              }}
              className="mt-3 w-full rounded-[14px] border border-black/10 px-4 py-3 text-[13.5px] font-semibold"
            >
              Sign out
            </button>
            <p className="mt-1.5 text-[11.5px] text-stone-400">
              Signing out leaves this device with no reps on it until you sign
              back in. Nothing is deleted.
            </p>
          </>
        )}
      </div>

      <p className="mt-7 text-center text-[11.5px] text-stone-400">
        Audio is stored so metrics can be recomputed as the engine improves.
      </p>
    </main>
  );
}

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
      onClick={() => onChange(!on)}
      className="flex w-full items-start gap-3 p-5 text-left"
    >
      <span className="flex-1">
        <span className="block text-[14px] font-semibold">{label}</span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-stone-500">
          {note}
        </span>
      </span>
      <span
        className={`mt-0.5 h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors ${
          on ? "bg-terracotta-500" : "bg-stone-300"
        }`}
        aria-checked={on}
        role="switch"
      >
        <span
          className={`block h-5 w-5 rounded-full bg-surface transition-transform ${
            on ? "translate-x-4" : ""
          }`}
        />
      </span>
    </button>
  );
}
