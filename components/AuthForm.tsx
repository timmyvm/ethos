"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { ACTION_CLASS, DISABLED_CLASS, INPUT_CLASS } from "@/lib/ui";
import { fetchReps } from "@/lib/client-data";
import { computeStreak } from "@/lib/streak";
import {
  MIN_PASSWORD,
  sessionState,
  type AuthResult,
  type SessionState,
} from "@/lib/auth";
import { useGoogleSignIn } from "@/lib/use-oauth-return";

/** Where the auth screens' back goes unless a page says otherwise. */
const TODAY = { href: "/", label: "Today" };

/**
 * How long the form waits for the session and this device's recordings
 * before it draws without them (auth-1). Signed out, both answer in a
 * frame; a slow network gets the plain form rather than a long shimmer.
 */
const READY_CAP_MS = 1500;

/**
 * The password rule, said once, under the field, before anyone types
 * (auth-9). It used to live in the placeholder, which goes at the first
 * keystroke, and the line under it was a slogan the error then repeated.
 */
export const PASSWORD_HELP = `${MIN_PASSWORD} characters or more. A phrase you'll remember works.`;

/**
 * DISABLED_CLASS's `disabled:` half only, for the Google key. Its
 * aria-disabled half would grey the held pending state, and #307 holds
 * that at full voice ("Opening Google…"): a faded button is what read as
 * dead when somebody came back from Google.
 */
const DISABLED_ONLY = DISABLED_CLASS.split(" ")
  .filter((c) => c.startsWith("disabled:"))
  .join(" ");

/**
 * The shared shell for /signup and /signin.
 *
 * Its real job is the sentence at the top: telling someone with an
 * anonymous session exactly what happens to the recordings on this
 * device. Signing UP keeps them (the account attaches to the same user).
 * Signing IN to a different account does not, and saying so before they
 * tap is the difference between a warning and an apology.
 *
 * Nothing on it is drawn until both reads are in (auth-1): the title,
 * the tile and whether a password is asked for all depend on them, and
 * a form that rebuilt itself under a cursor was the bug.
 */
export function AuthForm({
  mode,
  title,
  progressTitle,
  submitLabel,
  footer,
  passwordAside,
  onSubmit,
}: {
  mode: "signup" | "signin";
  title: string;
  /** The title when this device has recordings to carry (auth-12). */
  progressTitle?: string;
  submitLabel: string;
  footer: React.ReactNode;
  /** On the Password label's row, right-aligned: sign in's "Forgot?". */
  passwordAside?: React.ReactNode;
  onSubmit: (email: string, password: string) => Promise<AuthResult>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"email" | "password" | null>(
    null
  );
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<SessionState | null>(null);
  const [progress, setProgress] = useState({ recordings: 0, streak: 0 });
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // Google's own state: it comes back when they do, and never touches
  // the email form below it (lib/use-oauth-return.ts).
  const google = useGoogleSignIn(mode);

  useEffect(() => {
    let live = true;
    /*
     * One frame, not three (auth-1). allSettled because fetchReps throws
     * on an answered error, and a bare Promise.all would never set
     * `ready`. Whatever lands after the cap is dropped rather than
     * redrawn: the form a person has started typing into stays put.
     */
    const cap = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), READY_CAP_MS)
    );
    Promise.race([Promise.allSettled([sessionState(), fetchReps()]), cap]).then(
      (out) => {
        if (!live) return;
        if (out) {
          const [s, rows] = out;
          if (s.status === "fulfilled") setSession(s.value);
          if (rows.status === "fulfilled") {
            const streak = computeStreak(
              rows.value.map((r) => new Date(r.created_at))
            );
            setProgress({
              recordings: rows.value.length,
              streak: streak.current,
            });
          }
        }
        setReady(true);
      }
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (errorField === "email") emailRef.current?.focus();
    if (errorField === "password") passwordRef.current?.focus();
  }, [errorField, error]);

  const carrying = session?.anonymous === true && progress.recordings > 0;
  /*
   * An anonymous upgrade collects EMAIL ONLY (#142): GoTrue refuses a
   * password on an anonymous user, so the password is set on the page
   * the confirmation link lands on. Showing a field the flow can't use
   * was how the upgrade shipped broken and stayed broken.
   */
  const emailOnly = mode === "signup" && session?.anonymous === true;
  const heading = carrying && progressTitle ? progressTitle : title;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrorField(null);
    const result = await onSubmit(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "That didn't work.");
      setErrorField(result.field ?? null);
      return;
    }
    if (result.checkInbox) {
      setNote(result.note ?? null);
      setSent(true);
    } else window.location.href = "/";
  }

  if (!ready) {
    return (
      <AuthLoading
        label="Loading"
        card={mode === "signup" ? "h-[407px]" : "h-[382px]"}
      />
    );
  }

  if (sent) {
    return (
      <Shell title="Check your inbox">
        <div className="arrive flex flex-1 flex-col">
          <p className="mt-3 text-read text-stone-800 text-pretty">
            We&apos;ve sent a confirmation link to <Address>{email}</Address>{" "}
            from <Address>hello@speakethos.com</Address>.
            {emailOnly
              ? " Open it, set your password, and the account is live."
              : " Open it and your account is live."}
          </p>
          {carrying && (
            <p className="mt-3 text-read text-stone-800 text-pretty">
              Your {progress.recordings} recording
              {progress.recordings === 1 ? " is" : "s are"} already attached
              to it.
            </p>
          )}
          {note && (
            <p className="mt-3 text-caption leading-relaxed text-stone-500">
              {note}
            </p>
          )}
          {/* Nothing to type here, so the tap sits at the bottom, under
              the thumb (auth-11). */}
          <div className="mt-auto pt-8">
            <Link href="/" className={ACTION_CLASS}>
              Back to the floor
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const emailInvalid = errorField === "email";
  const passwordInvalid = errorField === "password";

  return (
    <Shell title={heading}>
      <div className="arrive flex flex-col">
        {carrying && (
          /* A tile, not a card: `surface` under `edge`, no shadow. Two
             raised cards on one screen read as two of the same thing,
             and what is on this device is context for the panel below.
             The numbers are the argument, so they are numbers (auth-12). */
          <div className="mt-6 rounded-card border border-edge bg-surface p-4">
            <div className="eyebrow">On this device</div>
            <div className="mt-2 flex gap-8">
              <Figure
                value={progress.recordings}
                label={progress.recordings === 1 ? "Recording" : "Recordings"}
              />
              {progress.streak > 0 && (
                <Figure value={progress.streak} label="Day streak" />
              )}
            </div>
            <p className="mt-3 text-caption leading-relaxed text-stone-600">
              {mode === "signup" ? (
                <>Your account attaches to them where they are.</>
              ) : (
                <>
                  Signing in to a{" "}
                  <span className="font-semibold">different</span> account
                  leaves them on this device.{" "}
                  <Link
                    href="/signup"
                    className="font-semibold text-terracotta-700"
                  >
                    Keep them instead
                  </Link>
                </>
              )}
            </p>
          </div>
        )}

        {/*
         * The one lifted thing on this screen (docs/look/SYSTEM.md): the
         * panel holding the primary action. Everything somebody types to
         * get in is inside it, so the screen has one object rather than
         * five same-depth boxes stacked down the page. Hero padding,
         * because it is the hero (auth-25).
         */}
        <div className={`card elev-2 ${carrying ? "mt-3" : "mt-6"} p-5`}>
          <button
            type="button"
            /* Held, not greyed, while the browser leaves: a faded button
               is what read as dead when somebody came back (25 Sep). */
            onClick={() => {
              if (!google.pending) void google.start();
            }}
            disabled={busy}
            aria-disabled={google.pending || undefined}
            aria-busy={google.pending || undefined}
            /* A raised key, not a third field (auth-6): the fields below
               are sunken surface wells, this stands on the card. In
               light the card is white too, so the shadow is the step
               that tells it apart (#218: never an outline with nothing
               in it). No hover fill; .press answers the pointer. */
            className={`press font-display flex min-h-12 w-full items-center justify-center gap-2.5 rounded-control border border-edge bg-raised px-6 text-body font-bold text-ink shadow-[var(--shadow-1)] transition-colors duration-200 ease-out dark:bg-[color-mix(in_srgb,var(--color-raised),#fff_6%)] ${DISABLED_ONLY}`}
          >
            <GoogleMark />
            {google.pending ? "Opening Google…" : "Continue with Google"}
          </button>
          {google.error && (
            <FormError id="google-error">{google.error}</FormError>
          )}
          {carrying && mode === "signup" && (
            <p className="mt-2 text-center text-caption text-stone-400">
              Your recordings attach to it the same way.
            </p>
          )}

          <div className="mt-5 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-edge" />
            <span className="text-caption text-stone-400">or with email</span>
            <span className="h-px flex-1 bg-edge" />
          </div>

          <form onSubmit={submit} noValidate className="mt-4">
            <label className={LABEL_CLASS} htmlFor="email">
              Email
            </label>
            <input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              /* "username", not "email": password managers key saved
                 logins on it, and "email" offers contact cards (auth-7). */
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              aria-invalid={emailInvalid || undefined}
              aria-describedby={emailInvalid ? "form-error" : undefined}
              className={FIELD_CLASS}
            />

            {!emailOnly && (
              <>
                <div className="mt-4 flex items-baseline justify-between">
                  <label className={LABEL_CLASS} htmlFor="password">
                    Password
                  </label>
                  {passwordAside}
                </div>
                <input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={passwordInvalid || undefined}
                  aria-describedby={
                    [
                      mode === "signup" ? "password-help" : "",
                      passwordInvalid ? "form-error" : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  className={FIELD_CLASS}
                />
                {mode === "signup" && (
                  <p
                    id="password-help"
                    className="mt-2 text-caption leading-relaxed text-stone-400"
                  >
                    {PASSWORD_HELP}
                  </p>
                )}
              </>
            )}
            {emailOnly && (
              <p className="mt-2 text-caption leading-relaxed text-stone-400">
                Two steps: the link confirms this address, then you pick the
                password you&apos;ll sign in with.
              </p>
            )}

            {error && <FormError>{error}</FormError>}

            <button
              type="submit"
              disabled={busy}
              className={`${ACTION_CLASS} ${DISABLED_CLASS} mt-5`}
            >
              {busy
                ? emailOnly
                  ? "Sending…"
                  : mode === "signin"
                    ? "Signing in…"
                    : "Creating…"
                : submitLabel}
            </button>
          </form>
        </div>

        <div className="mt-5 text-center">{footer}</div>
      </div>
    </Shell>
  );
}

/** A count on the tile: the number over its stat label. */
function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-display text-num-m tabular-nums text-ink">
        {value}
      </div>
      <div className="label-micro mt-1">{label}</div>
    </div>
  );
}

/** An address inside a sentence: it never runs past the column, and a
    page translator leaves it alone (auth-23). */
function Address({ children }: { children: React.ReactNode }) {
  return (
    <span translate="no" className="font-semibold text-ink [overflow-wrap:anywhere]">
      {children}
    </span>
  );
}

/** Google's four-colour G — a brand mark, not an app icon, so it lives
    outside components/Icon.tsx (the one-set rule covers our own marks). */
export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
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

/**
 * The one auth header (auth-2, auth-3, #321): /signin, /signup,
 * /auth/forgot and /auth/reset all open on ScreenHeader, a 34/800 large
 * title with the chevron back named for where it goes. It used to be a
 * text "← back" over a 26/700 title here, copied by hand into forgot,
 * and the retired wordmark with no way off at all on reset.
 *
 * The main ends at the safe area or 40px, whichever is more, so a state
 * with nothing to type can put its one tap at the bottom (auth-11).
 */
export function Shell({
  title,
  back = TODAY,
  children,
}: {
  title: string;
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-7">
      <ScreenHeader title={title} back={back} />
      {children}
    </main>
  );
}

/**
 * What an auth screen shows while it finds out which screen it is: the
 * header's bar with its way back from the first frame, a bar on the
 * title's 40px line and a block the height of the card that replaces
 * it, so the content lands in one frame and nothing under it moves
 * (auth-1, auth-5).
 *
 * Its own component on purpose: the screen that replaces it mounts a
 * fresh ScreenHeader, which measures its title on mount. Reusing this
 * one's header (title "", so a 0px title) left the small bar title
 * showing over the large one at rest.
 */
export function AuthLoading({
  label,
  card,
  back = TODAY,
}: {
  label: string;
  /** The card's height class, measured from the screen it stands for. */
  card: string;
  back?: { href: string; label: string };
}) {
  return (
    <Shell title="" back={back}>
      <SkeletonRegion label={label}>
        <div className="h-10 py-1.5">
          <Skeleton className="h-full w-3/5" />
        </div>
        <Skeleton rounded="rounded-card" className={`mt-6 ${card}`} />
      </SkeletonRegion>
    </Shell>
  );
}

/** A field's name, sentence case: a form label is neither a data column
    head nor a stat label, so it does not take the capitals (M05). */
export const LABEL_CLASS = "font-display block text-row text-ink";

/**
 * An input is a CONTROL: A1's one spelling (lib/ui.ts INPUT_CLASS),
 * a `surface` well behind the `edge` boundary, 16px so iOS never zooms,
 * and ONE 2px terracotta focus edge (auth-18). 48px tall here, the
 * height of the two buttons it sits between.
 */
export const FIELD_CLASS = `mt-2 h-12 ${INPUT_CLASS}`;

/**
 * A failure the form caused. It used to wear `terracotta-50`, which is
 * the coach's bubble: the one wash in the app that means Demos is
 * speaking. An error is the app speaking, so it takes the control fill
 * and says what it is in `rust`, the colour that already means "wrong
 * direction" on a delta. Its id is what the field at fault points its
 * aria-describedby at (auth-19).
 */
export function FormError({
  children,
  id = "form-error",
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-4 rounded-control border border-edge bg-surface px-4 py-3 text-caption leading-relaxed text-rust"
    >
      {children}
    </p>
  );
}
