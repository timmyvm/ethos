"use client";

import Link from "next/link";
import { DemosArt } from "@/components/DemosArt";
import { useEffect, useState } from "react";
import { GOOGLE_BUTTON, GoogleMark } from "@/components/AuthForm";
import { ACTION_CLASS } from "@/components/LessonScreen";
import { carryStashed } from "@/lib/tester-client";
import { useGoogleSignIn } from "@/lib/use-oauth-return";
import { authHref, nextFrom, onwardLink } from "@/lib/use-paywall-return";
import {
  callbackCarriesSession,
  callbackProblem,
  callbackScreen,
  forgetOAuthAttempt,
  readOAuthAttempt,
  waitForAccount,
  type OAuthAttempt,
} from "@/lib/auth";

/**
 * Where an email-confirmation link and a Google round trip land.
 *
 * The Supabase browser client reads the session out of the URL as it
 * initialises; this page waits for that (bounded, lib/auth.ts
 * `waitForAccount`, in place of a fixed 400ms) and says plainly what
 * happened. When the URL carries an error it is read first, because
 * "you said no to Google" and "that email link expired" are different
 * sentences with different ways out. Password resets go straight to
 * /auth/reset instead of routing through here.
 */
type State =
  | { at: "waiting" }
  | { at: "ok"; email: string | null }
  | { at: "google" }
  | { at: "taken" }
  | { at: "stale" };

export default function CallbackPage() {
  const [state, setState] = useState<State>({ at: "waiting" });
  const [attempt, setAttempt] = useState<OAuthAttempt | null>(null);
  /** The page that asked for the account, read after mount. */
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const href = window.location.href;
    const tried = readOAuthAttempt();
    setAttempt(tried);
    // The link or Google's redirect carries it; a redirect that dropped
    // the query still has it in the page the attempt began on.
    setNext(nextFrom(window.location.search) ?? nextFrom(tried?.from));
    // A sign-up that met an account is covered by GoogleTakenSwitch while
    // it signs in with it (#414); the taken screen is what is under it.
    const screen = callbackScreen(callbackProblem(href));
    if (screen) {
      setState({ at: screen });
      return;
    }
    // Only wait out a slow exchange when something is actually coming.
    const expecting = callbackCarriesSession(href) || tried !== null;
    waitForAccount(expecting ? 5000 : 0)
      .then((s) => {
        if (!live) return;
        if (s.signedIn && !s.anonymous) {
          forgetOAuthAttempt();
          // Testing joined on the session this sign-in replaced (lib/auth.ts).
          void carryStashed();
          setState({ at: "ok", email: s.email });
        } else {
          // Back from Google with nothing to show for it is a Google
          // that did not finish, not a used link.
          setState({ at: tried ? "google" : "stale" });
        }
      })
      .catch(() => live && setState({ at: tried ? "google" : "stale" }));
    return () => {
      live = false;
    };
  }, []);

  const viaGoogle = attempt !== null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      {state.at === "waiting" && (
        <p className="text-body text-stone-500" aria-live="polite">
          {viaGoogle ? "Signing you in…" : "Confirming…"}
        </p>
      )}

      {state.at === "ok" && (
        <>
          {/* B10, principle 9: DemosArt's celebrate pose, so at 140px
              his idle clip plays like every other Demos of that size. */}
          <DemosArt pose="celebrate" size={140} />
          <h1 className="font-display mt-6 text-title">You&apos;re in</h1>
          <p className="mt-3 max-w-[300px] text-body leading-relaxed text-stone-500">
            {viaGoogle
              ? state.email
                ? `Signed in as ${state.email}.`
                : "Signed in with Google."
              : state.email
                ? `${state.email} is confirmed.`
                : "Your email is confirmed."}
            {(!viaGoogle || attempt?.mode === "signup") &&
              " Everything you've already recorded came with you."}
          </p>
          {/* On to the page that asked for the account (the Premium
              sheet included), or the floor. */}
          <Link href={onwardLink(next).href} className={`${ACTION_CLASS} mt-7 max-w-[320px]`}>
            {onwardLink(next).label}
          </Link>
        </>
      )}

      {state.at === "google" && (
        <>
          <GoogleTile />
          <h1 className="font-display mt-5 text-title">
            Google sign-in didn&apos;t finish
          </h1>
          <p className="mt-3 max-w-[300px] text-body leading-relaxed text-stone-500">
            Nothing changed on this device.
          </p>
          <Link
            href={attempt?.from ?? "/signup"}
            className={`${ACTION_CLASS} mt-7 max-w-[320px]`}
          >
            Try again
          </Link>
          <Link
            href="/"
            className="text-link press mt-2 inline-flex min-h-11 items-center px-3"
          >
            Not now
          </Link>
        </>
      )}

      {state.at === "taken" && <Taken attempt={attempt} next={next} />}

      {state.at === "stale" && (
        <>
          <h1 className="font-display text-title">That link has expired</h1>
          <p className="mt-3 max-w-[300px] text-body leading-relaxed text-stone-500">
            Links work once. If you&apos;ve already confirmed, sign in.
          </p>
          <Link href="/signin" className={`${ACTION_CLASS} mt-7 max-w-[320px]`}>
            Sign in
          </Link>
        </>
      )}
    </main>
  );
}

/**
 * A Google sign-up whose Google account already has Ethos, when
 * GoogleTakenSwitch has let go or already ran for this attempt (#414).
 * It was "That Google account is taken" over a Sign in that went to
 * /signin, where Google had to be found and tapped again: Timothy's
 * "sending me back" (#426). The account is theirs, so the one tap is
 * Google's own sign-in, here, begun where they first tapped Google.
 */
function Taken({ attempt, next }: { attempt: OAuthAttempt | null; next: string | null }) {
  const google = useGoogleSignIn("signin", next, attempt?.from ?? "/signin");
  return (
    <>
      <GoogleTile />
      <h1 className="font-display mt-5 text-title text-balance">
        That Google account already has Ethos
      </h1>
      <p className="mt-3 max-w-[300px] text-body leading-relaxed text-stone-500">
        Sign in with it.
      </p>
      {/* Google's own button, as on the auth screens (D49): it is the
          screen's one tap, so there is no terracotta here. Held, never
          greyed, while the browser leaves (#307). */}
      <button
        type="button"
        onClick={() => {
          if (!google.pending) void google.start();
        }}
        aria-busy={google.pending || undefined}
        className={`${GOOGLE_BUTTON} mt-7 max-w-[320px]`}
      >
        <GoogleMark />
        {google.pending ? "Opening Google…" : "Continue with Google"}
      </button>
      {google.error && (
        <p role="alert" className="mt-3 max-w-[300px] text-caption text-rust">
          {google.error}
        </p>
      )}
      {/* The email form itself, coming back to the same page. */}
      <Link
        href={authHref("signup", next)}
        className="text-link press mt-2 inline-flex min-h-11 items-center px-3"
      >
        Use an email instead
      </Link>
    </>
  );
}

/** Google's four-colour G on a raised tile: says whose door this was
    before a word is read. */
function GoogleTile() {
  return (
    <span
      aria-hidden
      className="elev-1 flex h-14 w-14 items-center justify-center rounded-card border border-card-edge bg-raised"
    >
      <GoogleMark size={26} />
    </span>
  );
}
