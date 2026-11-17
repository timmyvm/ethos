"use client";

import Link from "next/link";
import { DemosArt } from "@/components/DemosArt";
import { useEffect, useState } from "react";
import { GOOGLE_BUTTON, GoogleMark } from "@/components/AuthForm";
import { ACTION_CLASS } from "@/components/LessonScreen";
import { carryKeptForLink, carryStashed } from "@/lib/tester-client";
import { useGoogleSignIn } from "@/lib/use-oauth-return";
import { authHref, nextFrom, onwardLink } from "@/lib/use-paywall-return";
import {
  callbackCarriesSession,
  callbackProblem,
  callbackScreen,
  callbackWelcome,
  forgetOAuthAttempt,
  freshAccount,
  readOAuthAttempt,
  resentLink,
  settingsLanding,
  waitForAccount,
  SETTINGS_ACCOUNT,
  type OAuthAttempt,
  type SettingsLanding,
} from "@/lib/auth";
import { readAccount } from "@/lib/account-settings";
import { finishedWithin, INTRO_PATH } from "@/lib/auth-landing";
import { SWITCHED_KEY } from "@/lib/google-taken";
import { supabaseBrowser } from "@/lib/supabase-browser";

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
 *
 * Settings' round trips land here too (#479, lib/auth.ts
 * `settingsLanding`): an email change's link says the email changed, or
 * that the other address's link is still to open (`half`, which needs
 * no session); Google linked from Settings says so, and a Google account
 * that has its own Ethos account goes back to Settings, never on to a
 * sign-in that would leave this account.
 */
type State =
  | { at: "waiting" }
  | {
      at: "ok";
      email: string | null;
      /** The introduction is not finished: the way on is it (#497). */
      onboard?: boolean;
      /** The account was made by this round trip (lib/auth.ts `freshAccount`). */
      fresh?: boolean;
    }
  | { at: "google" }
  | { at: "taken" }
  | { at: "stale" }
  | { at: "half" };

export default function CallbackPage() {
  const [state, setState] = useState<State>({ at: "waiting" });
  const [attempt, setAttempt] = useState<OAuthAttempt | null>(null);
  /** The page that asked for the account, read after mount. */
  const [next, setNext] = useState<string | null>(null);
  /** The link an account that never confirmed got again (#426, review). */
  const [resent, setResent] = useState(false);
  /** A Settings round trip (#479): an email change or Google linked. */
  const [landing, setLanding] = useState<SettingsLanding>(null);
  /** A Google sign-up switched to that account's sign-in (#414). */
  const [switched, setSwitched] = useState(false);

  useEffect(() => {
    let live = true;
    const href = window.location.href;
    const tried = readOAuthAttempt();
    const again = resentLink(window.location.search);
    const fromSettings = settingsLanding(href);
    setAttempt(tried);
    setResent(again);
    setLanding(fromSettings);
    try {
      setSwitched(sessionStorage.getItem(SWITCHED_KEY) !== null);
    } catch {}
    // The link or Google's redirect carries it; a redirect that dropped
    // the query still has it in the page the attempt began on.
    setNext(nextFrom(window.location.search) ?? nextFrom(tried?.from));
    // A sign-up that met an account is covered by GoogleTakenSwitch while
    // it signs in with it (#414); the taken screen is what is under it.
    const screen = callbackScreen(callbackProblem(href));
    if (screen) {
      if (fromSettings?.kind === "google") forgetOAuthAttempt();
      setState({ at: screen });
      return;
    }
    // The first of an email change's two links: nothing to wait for.
    if (fromSettings?.kind === "email" && fromSettings.step === "half") {
      setState({ at: "half" });
      return;
    }
    // Only wait out a slow exchange when something is actually coming.
    const expecting = callbackCarriesSession(href) || tried !== null;
    waitForAccount(expecting ? 5000 : 0)
      .then((s) => {
        if (!live) return;
        if (s.signedIn && !s.anonymous && fromSettings?.kind === "google") {
          // Linking from Settings (#479 review): this account was signed
          // in before Google opened, so a session is no proof. "Google is
          // linked" only once the account has Google among its ways in.
          forgetOAuthAttempt();
          void readAccount().then((view) => {
            if (!live) return;
            setState(view && !view.google ? { at: "google" } : { at: "ok", email: s.email });
          });
        } else if (s.signedIn && !s.anonymous) {
          forgetOAuthAttempt();
          // Testing joined on the session this sign-in replaced: Google's
          // waits in this tab, a resent link's on this device (lib/auth.ts).
          void (again ? carryKeptForLink() : carryStashed());
          /* Whether this account has done the introduction (#497), and
             whether it was made just now, before anything is said: the
             line and the way on are drawn once, right. */
          void Promise.all([finishedWithin(), signedInUser()]).then(([finished, user]) => {
            if (!live) return;
            setState({ at: "ok", email: s.email, onboard: finished === false, fresh: freshAccount(user) });
          });
        } else {
          // Back from Google with nothing to show for it is a Google
          // that did not finish, not a used link.
          setState({ at: tried && !again ? "google" : "stale" });
        }
      })
      .catch(() => live && setState({ at: tried && !again ? "google" : "stale" }));
    return () => {
      live = false;
    };
  }, []);

  /* An email link opened in the tab a Google attempt began in is still
     an email link. */
  const viaGoogle = attempt !== null && !resent;
  const onward =
    state.at === "ok" && state.onboard && !landing ? { href: INTRO_PATH, label: "Next" } : onwardLink(next);

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
          <h1 className="font-display mt-6 text-title">
            {landing?.kind === "email" ? "Email changed" : landing?.kind === "google" ? "Google is linked" : <>You&apos;re in</>}
          </h1>
          <p className="mt-3 max-w-[300px] text-body leading-relaxed text-stone-500">
            {landing?.kind === "email"
              ? state.email
                ? `${state.email} is your email now.`
                : "Your new email is set."
              : landing?.kind === "google"
                ? "Sign in with Google or your email from now on."
                : callbackWelcome({ email: state.email, google: viaGoogle ? attempt : null, resent, fresh: state.fresh, switched })}
          </p>
          {/* On to the introduction when this account has not done it
              (#497), else the page that asked for the account (the
              Premium sheet included), or the floor. */}
          <Link href={onward.href} className={`${ACTION_CLASS} mt-7 max-w-[320px]`}>
            {onward.label}
          </Link>
        </>
      )}

      {state.at === "google" && landing?.kind === "google" && (
        /* Linking from Settings that did not finish (#479 review): this
           account is still signed in and unchanged, so the way is back. */
        <>
          <GoogleTile />
          <h1 className="font-display mt-5 text-title">Google didn&apos;t link</h1>
          <p className="mt-3 max-w-[300px] text-body leading-relaxed text-stone-500">Nothing changed on this account.</p>
          <Link href={SETTINGS_ACCOUNT} className={`${ACTION_CLASS} mt-7 max-w-[320px]`}>
            Back to Account
          </Link>
        </>
      )}
      {state.at === "google" && landing?.kind !== "google" && (
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

      {state.at === "taken" && landing?.kind === "google" && (
        /* Linking from Settings (#479): that Google account is another
           Ethos account. This one stays signed in, so the way is back. */
        <>
          <GoogleTile />
          <h1 className="font-display mt-5 text-title text-balance">That Google account has its own Ethos account</h1>
          <p className="mt-3 max-w-[300px] text-body leading-relaxed text-stone-500 text-pretty">
            Nothing changed on this one. Link a different Google account, or keep signing in with your email.
          </p>
          <Link href={SETTINGS_ACCOUNT} className={`${ACTION_CLASS} mt-7 max-w-[320px]`}>
            Back to Account
          </Link>
        </>
      )}
      {state.at === "taken" && landing?.kind !== "google" && <Taken attempt={attempt} next={next} />}

      {state.at === "half" && (
        <>
          <h1 className="font-display text-title">One more link</h1>
          <p className="mt-3 max-w-[300px] text-body leading-relaxed text-stone-500 text-pretty">
            That address is confirmed. Open the link sent to the other one, and your email changes.
          </p>
          <Link href={SETTINGS_ACCOUNT} className={`${ACTION_CLASS} mt-7 max-w-[320px]`}>
            Back to Account
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
  /* A pre-#410 guest's recordings stay on the guest when it signs in
     (#414): said here, before the sign-in, as the email path says it
     before its own (#426, review). GoogleTakenSwitch waits for this. */
  const held = attempt?.mode === "signup" ? (attempt.recordings ?? 0) : 0;
  return (
    <>
      <GoogleTile />
      <h1 className="font-display mt-5 text-title text-balance">
        That Google account already has Ethos
      </h1>
      <p className="mt-3 max-w-[300px] text-body leading-relaxed text-stone-500 text-pretty">
        {held > 0
          ? `Signing in to it leaves your ${held} recording${held === 1 ? "" : "s"} on this device.`
          : "Sign in with it."}
      </p>
      {/* Google's own button, as on the auth screens (D49): it is the
          screen's one tap, so there is no filled tap here. Held, never
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
      {/* The email form itself, coming back to the same page: where a
          guest's recordings attach to an email new to Ethos. */}
      <Link
        href={authHref("signup", next)}
        className="text-link press mt-2 inline-flex min-h-11 items-center px-3"
      >
        {held > 0 ? "Keep them with an email" : "Use an email instead"}
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

/** The signed-in user as the session holds it, identities included. */
async function signedInUser() {
  const db = supabaseBrowser();
  if (!db) return null;
  const { data } = await db.auth.getSession().catch(() => ({ data: { session: null } }));
  return data.session?.user ?? null;
}
