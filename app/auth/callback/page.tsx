"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GoogleMark } from "@/components/AuthForm";
import { ACTION_CLASS } from "@/components/LessonScreen";
import {
  callbackCarriesSession,
  callbackProblem,
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

  useEffect(() => {
    let live = true;
    const href = window.location.href;
    const tried = readOAuthAttempt();
    setAttempt(tried);
    const problem = callbackProblem(href);
    if (problem.kind === "google") {
      setState({ at: "google" });
      return;
    }
    if (problem.kind === "taken") {
      setState({ at: "taken" });
      return;
    }
    if (problem.kind === "link") {
      setState({ at: "stale" });
      return;
    }
    // Only wait out a slow exchange when something is actually coming.
    const expecting = callbackCarriesSession(href) || tried !== null;
    waitForAccount(expecting ? 5000 : 0)
      .then((s) => {
        if (!live) return;
        if (s.signedIn && !s.anonymous) {
          forgetOAuthAttempt();
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
          <Image
            src="/demos-celebrate.webp"
            alt=""
            width={140}
            height={140}
            className="demos w-[140px]"
          />
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
          <Link href="/" className={`${ACTION_CLASS} mt-7 max-w-[320px]`}>
            Back to the floor
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

      {state.at === "taken" && (
        <>
          <GoogleTile />
          <h1 className="font-display mt-5 text-title">
            That Google account is taken
          </h1>
          {/* The headline already says whose it is; the body only says
              what to do. humanise()'s longer line is for the inline
              AuthForm error, which has no headline over it. */}
          <p className="mt-3 max-w-[300px] text-body leading-relaxed text-stone-500">
            Sign in with it instead.
          </p>
          <Link href="/signin" className={`${ACTION_CLASS} mt-7 max-w-[320px]`}>
            Sign in
          </Link>
          {/* The email form itself, wherever the attempt began: from the
              introduction, "back where you started" is its plan. */}
          <Link
            href="/signup"
            className="text-link press mt-2 inline-flex min-h-11 items-center px-3"
          >
            Use an email instead
          </Link>
        </>
      )}

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
