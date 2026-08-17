"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchReps } from "@/lib/client-data";
import { computeStreak } from "@/lib/streak";
import { sessionState, type AuthResult, type SessionState } from "@/lib/auth";

/**
 * The shared shell for /signup and /signin.
 *
 * Its real job is the sentence at the top: telling someone with an
 * anonymous session exactly what happens to the reps on this device.
 * Signing UP keeps them (the account attaches to the same user).
 * Signing IN to a different account does not, and saying so before they
 * tap is the difference between a warning and an apology.
 */
export function AuthForm({
  mode,
  title,
  action,
  submitLabel,
  footer,
  onSubmit,
}: {
  mode: "signup" | "signin";
  title: string;
  action: string;
  submitLabel: string;
  footer: React.ReactNode;
  onSubmit: (email: string, password: string) => Promise<AuthResult>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [session, setSession] = useState<SessionState | null>(null);
  const [progress, setProgress] = useState({ reps: 0, streak: 0 });

  useEffect(() => {
    sessionState().then(setSession).catch(() => {});
    fetchReps()
      .then((rows) => {
        const streak = computeStreak(rows.map((r) => new Date(r.created_at)));
        setProgress({ reps: rows.length, streak: streak.current });
      })
      .catch(() => {});
  }, []);

  const carrying = session?.anonymous === true && progress.reps > 0;
  /*
   * An anonymous upgrade collects EMAIL ONLY (#142): GoTrue refuses a
   * password on an anonymous user, so the password is set on the page
   * the confirmation link lands on. Showing a field the flow can't use
   * was how the upgrade shipped broken and stayed broken.
   */
  const emailOnly = mode === "signup" && session?.anonymous === true;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await onSubmit(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "That didn't work.");
      return;
    }
    if (result.checkInbox) setSent(true);
    else window.location.href = "/";
  }

  if (sent) {
    return (
      <Shell title="Check your inbox">
        <p className="mt-3 text-[15px] leading-relaxed text-stone-500">
          We&apos;ve sent a confirmation link to{" "}
          <span className="font-semibold text-ink">{email}</span> from{" "}
          <span className="font-semibold text-ink">hello@speakethos.com</span>.
          {emailOnly
            ? " Open it, set your password, and the account is live."
            : " Open it and your account is live."}
        </p>
        {carrying && (
          <p className="mt-3 text-[13.5px] leading-relaxed text-stone-500">
            Your {progress.reps} rep{progress.reps === 1 ? "" : "s"} are already
            attached to it — the link just confirms the address and asks what
            password you&apos;ll sign in with.
          </p>
        )}
        <p className="mt-5 text-[13px] leading-relaxed text-stone-400">
          That address is a real inbox, not a no-reply. If something looks
          wrong, replying is the fastest way to tell us.
        </p>
        <Link
          href="/"
          className="press mt-6 block w-full rounded-[15px] bg-terracotta-500 px-6 py-4 text-center text-[17px] font-semibold text-cream"
        >
          Back to the floor
        </Link>
      </Shell>
    );
  }

  return (
    <Shell title={title}>
      {carrying && (
        <div className="mt-4 rounded-[18px] border border-hairline bg-surface lift p-4">
          <div className="label-data">On this device</div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-600">
            {progress.reps} rep{progress.reps === 1 ? "" : "s"}
            {progress.streak > 0 && ` and a ${progress.streak}-day streak`}.{" "}
            {mode === "signup" ? (
              <>
                They stay exactly where they are — the account attaches to them,
                not the other way round.
              </>
            ) : (
              <>
                Signing in to a{" "}
                <span className="font-semibold">different</span> account leaves
                them on this device.{" "}
                <Link href="/signup" className="font-semibold text-terracotta-600">
                  Keep them instead
                </Link>
                .
              </>
            )}
          </p>
        </div>
      )}

      <form onSubmit={submit} className="mt-5">
        <label className="label-data" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="mt-1.5 w-full rounded-[14px] border border-black/10 bg-surface px-4 py-3.5 text-[16px] placeholder:text-stone-300 focus:border-stone-300"
        />

        {!emailOnly && (
          <>
            <label className="label-data mt-4 block" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "signup" ? "8 characters or more" : "••••••••"
              }
              className="mt-1.5 w-full rounded-[14px] border border-black/10 bg-surface px-4 py-3.5 text-[16px] placeholder:text-stone-300 focus:border-stone-300"
            />
            {mode === "signup" && (
              <p className="mt-1.5 text-[12px] text-stone-400">
                Length beats punctuation. A phrase you&apos;ll remember is a
                better password than one you won&apos;t.
              </p>
            )}
          </>
        )}
        {emailOnly && (
          <p className="mt-2 text-[12px] leading-relaxed text-stone-400">
            Two steps: the link confirms this address, then you pick the
            password you&apos;ll sign in with.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-[14px] bg-terracotta-50 px-4 py-3 text-[13.5px] leading-relaxed text-terracotta-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="press mt-5 w-full rounded-[15px] bg-terracotta-500 px-6 py-4 text-[17px] font-semibold text-cream transition-colors hover:bg-terracotta-600 disabled:opacity-60"
        >
          {busy ? "One moment…" : submitLabel}
        </button>
      </form>

      <div className="mt-5 text-center text-[13.5px] text-stone-500">
        {footer}
      </div>

      <p className="mt-8 text-center text-[12px] leading-relaxed text-stone-400">
        {action} with an email address. No social sign-in, so nothing about
        this is shared with anyone else.
      </p>
    </Shell>
  );
}

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col px-5 pb-10 pt-7">
      <Link href="/" className="self-start text-sm text-stone-500">
        ← back
      </Link>
      <h1 className="font-display mt-8 text-[30px] font-bold leading-tight">
        {title}
      </h1>
      {children}
    </main>
  );
}
