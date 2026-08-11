"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sessionState, setNewPassword } from "@/lib/auth";

/**
 * The landing page for a password-reset link.
 *
 * `resetPasswordForEmail` points here directly rather than through a
 * shared callback, so this page never has to work out what kind of link
 * brought it into existence — there's no race between Supabase reading
 * the URL fragment and the page deciding where to send you.
 */
export default function ResetPage() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The Supabase client consumes the link's fragment as it starts up,
    // so a session either exists a beat later or the link was stale.
    const timer = setTimeout(() => {
      sessionState()
        .then((s) => setReady(s.signedIn && !s.anonymous))
        .catch(() => setReady(false));
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await setNewPassword(password);
    setBusy(false);
    if (result.ok) setDone(true);
    else setError(result.error ?? "That didn't work.");
  }

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-10 pt-7">
      <div className="font-display text-[22px] font-bold">ethos</div>

      {done ? (
        <>
          <h1 className="font-display mt-8 text-[30px] font-bold leading-tight">
            Done.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-stone-500">
            New password saved. Your reps, your streak and your lexicon are
            exactly where you left them.
          </p>
          <Link
            href="/"
            className="press mt-6 block w-full rounded-[15px] bg-terracotta-500 px-6 py-4 text-center text-[17px] font-semibold text-cream"
          >
            Back to the floor
          </Link>
        </>
      ) : ready === false ? (
        <>
          <h1 className="font-display mt-8 text-[30px] font-bold leading-tight">
            That link has expired.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-stone-500">
            Reset links last an hour and work once. Nothing has happened to
            your account — ask for a fresh one.
          </p>
          <Link
            href="/auth/forgot"
            className="press mt-6 block w-full rounded-[15px] bg-terracotta-500 px-6 py-4 text-center text-[17px] font-semibold text-cream"
          >
            Send a new link
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-display mt-8 text-[30px] font-bold leading-tight">
            Pick a new password.
          </h1>
          <form onSubmit={submit} className="mt-5">
            <label className="label-data" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 characters or more"
              className="mt-1.5 w-full rounded-[14px] border border-black/10 bg-surface px-4 py-3.5 text-[16px] outline-none placeholder:text-stone-300 focus:border-stone-300"
            />
            {error && (
              <p className="mt-4 rounded-[14px] bg-terracotta-50 px-4 py-3 text-[13.5px] text-terracotta-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || ready === null}
              className="press mt-5 w-full rounded-[15px] bg-terracotta-500 px-6 py-4 text-[17px] font-semibold text-cream disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save it"}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
