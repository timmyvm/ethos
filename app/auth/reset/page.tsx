"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  AuthLoading,
  FIELD_CLASS,
  FormError,
  LABEL_CLASS,
  PASSWORD_HELP,
  Shell,
} from "@/components/AuthForm";
import { ACTION_CLASS, DISABLED_CLASS } from "@/lib/ui";
import { sessionState, setNewPassword } from "@/lib/auth";

/**
 * The landing page for a password-reset link, and, as ?first=1, for
 * the save-progress confirmation link (#142). Both arrive here directly
 * rather than through a shared callback, so this page never has to work
 * out what kind of link brought it into existence: there's no race
 * between Supabase reading the URL fragment and the page deciding where
 * to send you (#82).
 *
 * The first-password variant exists because GoTrue refuses to put a
 * password on an anonymous user: the upgrade attaches the email, the
 * link proves ownership, and THIS is the first moment a password has an
 * identity to hang on.
 *
 * It opens from an email, often in a fresh tab with no history, so the
 * header's back to Today is the only way off it (auth-2, #279).
 */
export default function ResetPage() {
  return (
    <Suspense fallback={<Checking />}>
      <ResetScreen />
    </Suspense>
  );
}

/**
 * Until the link is read the page does not know which screen it is, so
 * it says neither (auth-5): an expired link used to show "Pick a new
 * password" first and then swap it out under a cursor.
 */
function Checking() {
  return (
    <AuthLoading
      label="Checking your link"
      card="h-[215px]"
      back={{ href: "/", label: "Today" }}
    />
  );
}

function ResetScreen() {
  const first = useSearchParams().get("first") === "1";
  const [ready, setReady] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // The Supabase client consumes the link's fragment as it starts up,
    // so a session either exists a beat later or the link was stale.
    const timer = setTimeout(() => {
      sessionState()
        .then((s) => {
          setEmail(s.email ?? "");
          /*
           * The reset flow requires a full account. The first-password
           * flow trusts the server over the flag: if the email somehow
           * isn't attached yet, setNewPassword returns the exact error
           * this page exists to prevent, humanised; a stale `anonymous`
           * claim must not block the happy path.
           */
          setReady(s.signedIn && (first || !s.anonymous));
        })
        .catch(() => setReady(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [first]);

  // The one field is the one at fault: the cursor goes back into it.
  useEffect(() => {
    if (error) field.current?.focus();
  }, [error]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await setNewPassword(password);
    setBusy(false);
    if (result.ok) setDone(true);
    else setError(result.error ?? "That didn't work.");
  }

  if (ready === null && !done) return <Checking />;

  const title = done
    ? first
      ? "It's yours"
      : "Password saved"
    : ready === false
      ? "That link has expired"
      : first
        ? "Pick your password"
        : "Pick a new password";

  return (
    <Shell title={title} back={{ href: "/", label: "Today" }}>
      {done ? (
        <div className="arrive flex flex-1 flex-col">
          <p className="mt-3 text-read text-stone-800 text-pretty">
            {first
              ? "Account live, password saved. Your recordings, your streak and your lexicon are attached on this device and any other you sign in on."
              : "Your recordings, your streak and your lexicon are exactly where you left them."}
          </p>
          {/* Nothing to type: the tap sits at the bottom (auth-11). */}
          <div className="mt-auto pt-8">
            <Link href="/" className={ACTION_CLASS}>
              Back to the floor
            </Link>
          </div>
        </div>
      ) : ready === false ? (
        <div className="arrive flex flex-1 flex-col">
          <p className="mt-3 text-read text-stone-800 text-pretty">
            {first
              ? "Save links last an hour and work once. Your recordings are still on your device, so get a fresh one."
              : "Reset links last an hour and work once. Nothing has happened to your account, so ask for a fresh one."}
          </p>
          <div className="mt-auto pt-8">
            <Link
              /* An unconfirmed email can't receive a reset mail, so the
                 fresh link for the first-password flow is a fresh save. */
              href={first ? "/signup" : "/auth/forgot"}
              className={ACTION_CLASS}
            >
              Get a new link
            </Link>
          </div>
        </div>
      ) : (
        <div className="arrive flex flex-col">
          {first && (
            <p className="mt-3 text-read text-stone-800 text-pretty">
              Email confirmed, recordings attached. This is what signs you
              in anywhere.
            </p>
          )}
          <form onSubmit={submit} noValidate className="card elev-2 mt-6 p-5">
            {/* The account this password belongs to, for the password
                manager that saves it (auth-7). */}
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              readOnly
              hidden
            />
            <label className={LABEL_CLASS} htmlFor="password">
              {first ? "Password" : "New password"}
            </label>
            <input
              ref={field}
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={
                error ? "password-help form-error" : "password-help"
              }
              className={FIELD_CLASS}
            />
            <p
              id="password-help"
              className="mt-2 text-caption leading-relaxed text-stone-400"
            >
              {PASSWORD_HELP}
            </p>
            {error && <FormError>{error}</FormError>}
            <button
              type="submit"
              disabled={busy}
              className={`${ACTION_CLASS} ${DISABLED_CLASS} mt-5`}
            >
              {busy ? "Saving…" : "Save it"}
            </button>
          </form>
        </div>
      )}
    </Shell>
  );
}
