"use client";

import { useEffect, useState } from "react";
import { GOOGLE_PENDING_MS, callbackProblem, readOAuthAttempt, signInWithGoogle } from "@/lib/auth";
import {
  SWITCHED_KEY,
  TAKEN_KEY,
  markGoogleSwitching,
  onBackWithoutFinishing,
  shouldSwitch,
  takenScreenHref,
  warnsFirst,
} from "@/lib/google-taken";
import { nextFrom } from "@/lib/use-paywall-return";

/**
 * Back from Google with "that Google account already has Ethos" (#414,
 * lib/google-taken.ts): sign in with it instead of landing on the
 * account ask again. A plain screen covers whatever page Supabase sent
 * the person to while the sign-in leaves for Google, and lets go when
 * they come back without finishing.
 */
export function GoogleTakenSwitch() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let taken = false;
    let switchedAt: string | null = null;
    try {
      taken = sessionStorage.getItem(TAKEN_KEY) !== null;
      sessionStorage.removeItem(TAKEN_KEY);
      switchedAt = sessionStorage.getItem(SWITCHED_KEY);
    } catch {}
    if (!taken) taken = callbackProblem(window.location.href).kind === "taken";
    const attempt = readOAuthAttempt();
    /* A guest holding recordings reads what a sign-in leaves before it
       signs in: the callback's taken screen says it (#426, review). A
       return that landed anywhere else is taken there, the account gate
       held while it goes. */
    if (warnsFirst(taken, attempt)) {
      if (window.location.pathname !== "/auth/callback") {
        markGoogleSwitching(true);
        window.location.replace(
          takenScreenHref(nextFrom(window.location.search) ?? nextFrom(attempt!.from))
        );
      }
      return;
    }
    if (!shouldSwitch(taken, attempt, switchedAt)) return;
    try {
      sessionStorage.setItem(SWITCHED_KEY, String(attempt!.at));
    } catch {}
    markGoogleSwitching(true);
    setOn(true);
    /* Backed out of Google or a dismissed sheet hands the page, and the
       account gate, back. Not torn down with the effect: the cover stays
       until one of these, or a failed call, lets it go. */
    let stop = () => {};
    const release = () => {
      stop();
      markGoogleSwitching(false);
      setOn(false);
    };
    stop = onBackWithoutFinishing(release, GOOGLE_PENDING_MS);
    /* A sign-in from here on, begun where they tapped Google: the
       callback then greets a sign-in, and never says what this guest
       recorded came with it (#426). Its new attempt is a sign-in, so a
       reload of this return is never switched twice. */
    void signInWithGoogle("signin", nextFrom(window.location.search) ?? nextFrom(attempt!.from), attempt!.from)
      .then((r) => {
        if (!r.ok) release();
      })
      .catch(release);
  }, []);
  if (!on) return null;
  return (
    <div
      role="status"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-ground px-8 text-center"
    >
      <p className="max-w-[300px] text-body leading-relaxed text-stone-500">
        That Google account already has Ethos. Signing you in…
      </p>
    </div>
  );
}
