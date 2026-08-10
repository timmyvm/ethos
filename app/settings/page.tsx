"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

interface Prefs {
  reminderHour: number | null;
  quietFrom: number;
  quietTo: number;
  haptics: boolean;
  verbatim: boolean;
}

const DEFAULTS: Prefs = {
  reminderHour: null,
  quietFrom: 22,
  quietTo: 7,
  haptics: true,
  verbatim: true,
};

const KEY = "ethos.prefs";

/**
 * Settings. mechanics.md notification rules are enforced here, not left
 * to copy: one reminder a day maximum, quiet hours default 10pm–7am,
 * and the reminder text is coach register — loss-aversion is allowed,
 * guilt is not.
 */
export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [perm, setPerm] = useState<string>("default");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    supabaseBrowser()
      ?.auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => {});
  }, []);

  function update(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }

  async function askPermission() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") {
      new Notification("Ethos", {
        body: "That's the reminder. One a day, never more.",
      });
    }
  }

  return (
    <main className="px-5 pb-24 pt-7">
      <Link href="/you" className="text-sm text-stone-500">
        ← you
      </Link>
      <h1 className="font-display mt-4 text-2xl font-bold">Settings</h1>

      <div className="label-data mt-7">Daily reminder</div>
      <div className="mt-2 rounded-[18px] border border-black/5 bg-white p-5">
        <p className="text-[13px] leading-relaxed text-stone-500">
          One notification a day, maximum. It names the streak, never
          scolds you for missing it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[null, 7, 8, 12, 18, 20, 21].map((h) => (
            <button
              key={String(h)}
              onClick={() => update({ reminderHour: h })}
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
            onClick={askPermission}
            className="mt-3 w-full rounded-[14px] border border-terracotta-200 bg-terracotta-50 px-4 py-3 text-[13.5px] font-semibold"
          >
            {perm === "denied"
              ? "Notifications blocked in your browser"
              : "Allow notifications"}
          </button>
        )}
        <div className="mt-3 border-t border-sand pt-3 text-[12.5px] text-stone-500">
          Quiet hours {String(prefs.quietFrom).padStart(2, "0")}:00 –{" "}
          {String(prefs.quietTo).padStart(2, "0")}:00. Nothing fires inside
          them.
        </div>
      </div>

      <div className="label-data mt-7">The rep</div>
      <div className="mt-2 divide-y divide-sand rounded-[18px] border border-black/5 bg-white">
        <Toggle
          label="Haptics"
          note="A tap when recording starts and stops."
          on={prefs.haptics}
          onChange={(v) => update({ haptics: v })}
        />
        <Toggle
          label="Verbatim transcripts"
          note="Keep every 'um' in the transcript. Off makes it prettier and the filler count wrong."
          on={prefs.verbatim}
          onChange={(v) => update({ verbatim: v })}
        />
      </div>

      <div className="label-data mt-7">Account</div>
      <div className="mt-2 rounded-[18px] border border-black/5 bg-white p-5">
        <div className="text-[14px] font-semibold">
          {email ?? "Anonymous — this device only"}
        </div>
        <p className="mt-1 text-[12.5px] text-stone-500">
          {email
            ? "Your reps follow this email anywhere."
            : "Add an email on the You screen and your reps follow you anywhere."}
        </p>
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
          className={`block h-5 w-5 rounded-full bg-white transition-transform ${
            on ? "translate-x-4" : ""
          }`}
        />
      </span>
    </button>
  );
}
