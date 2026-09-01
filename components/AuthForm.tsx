"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchReps } from "@/lib/client-data";
import { computeStreak } from "@/lib/streak";
import {
  sessionState,
  signInWithGoogle,
  type AuthResult,
  type SessionState,
} from "@/lib/auth";

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
  submitLabel,
  footer,
  onSubmit,
}: {
  mode: "signup" | "signin";
  title: string;
  submitLabel: string;
  footer: React.ReactNode;
  onSubmit: (email: string, password: string) => Promise<AuthResult>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState<string | null>(null);
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
    if (result.checkInbox) {
      setNote(result.note ?? null);
      setSent(true);
    } else window.location.href = "/";
  }

  async function google() {
    setBusy(true);
    setError(null);
    const result = await signInWithGoogle(mode);
    // On success the browser is navigating to Google; only failure
    // returns control to this screen.
    if (!result.ok) {
      setBusy(false);
      setError(result.error ?? "Google didn't answer. Try again.");
    }
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
            attached to it. The link just confirms the address and asks what
            password you&apos;ll sign in with.
          </p>
        )}
        {note && (
          <p className="mt-3 text-[13.5px] leading-relaxed text-stone-500">
            {note}
          </p>
        )}
        <p className="mt-5 text-[13px] leading-relaxed text-stone-400">
          That address is a real inbox. Reply to it if something looks wrong.
        </p>
        <Link
          href="/"
          className="press mt-6 block w-full rounded-full bg-terracotta-500 px-6 py-4 text-center text-[17px] font-semibold text-stage"
        >
          Back to the floor
        </Link>
      </Shell>
    );
  }

  return (
    <Shell title={title}>
      {carrying && (
        <div className="mt-4 rounded-[24px] border border-hairline bg-surface p-4">
          <div className="label-data">On this device</div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-600">
            {progress.reps} rep{progress.reps === 1 ? "" : "s"}
            {progress.streak > 0 && ` and a ${progress.streak}-day streak`}.{" "}
            {mode === "signup" ? (
              <>
                They stay where they are. The account attaches to them.
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

      <button
        type="button"
        onClick={() => void google()}
        disabled={busy}
        className="press mt-5 flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full border border-stone-200 bg-surface px-6 py-3.5 text-[15.5px] font-semibold transition-colors hover:border-stone-300 disabled:opacity-60"
      >
        <GoogleMark />
        Continue with Google
      </button>
      {carrying && mode === "signup" && (
        <p className="mt-2 text-center text-[12px] text-stone-400">
          Your recordings attach to it the same way.
        </p>
      )}

      <div className="mt-5 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-[12px] text-stone-400">or with email</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <form onSubmit={submit} className="mt-4">
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
          className="mt-1.5 w-full rounded-full border border-stone-200 bg-surface px-5 py-3.5 text-[16px] placeholder:text-stone-300 focus:border-stone-300"
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
              className="mt-1.5 w-full rounded-full border border-stone-200 bg-surface px-5 py-3.5 text-[16px] placeholder:text-stone-300 focus:border-stone-300"
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
          <p className="mt-4 rounded-[20px] bg-terracotta-50 px-4 py-3 text-[13.5px] leading-relaxed text-terracotta-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="press mt-5 w-full rounded-full bg-terracotta-500 px-6 py-4 text-[17px] font-semibold text-stage transition-colors hover:bg-terracotta-600 disabled:opacity-60"
        >
          {busy ? "One moment…" : submitLabel}
        </button>
      </form>

      <div className="mt-5 text-center text-[13.5px] text-stone-500">
        {footer}
      </div>
    </Shell>
  );
}

/** Google's four-colour G — a brand mark, not an app icon, so it lives
    outside components/Icon.tsx (the one-set rule covers our own marks). */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
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
