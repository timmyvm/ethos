"use client";

import { useEffect, useState } from "react";
import { callbackProblem, readOAuthAttempt, signInWithGoogle } from "@/lib/auth";
import { SWITCHED_KEY, TAKEN_KEY, markGoogleSwitching, shouldSwitch } from "@/lib/google-taken";
import { nextFrom } from "@/lib/use-paywall-return";

/**
 * Back from Google with "that Google account already has Ethos" (#414,
 * lib/google-taken.ts): sign in with it instead of landing on the
 * account ask again. A plain screen covers whatever page Supabase sent
 * the person to while the sign-in leaves for Google.
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
    if (!shouldSwitch(taken, attempt, switchedAt)) return;
    try {
      sessionStorage.setItem(SWITCHED_KEY, String(attempt!.at));
    } catch {}
    markGoogleSwitching(true);
    setOn(true);
    void signInWithGoogle("signin", nextFrom(window.location.search))
      .then((r) => {
        if (!r.ok) {
          markGoogleSwitching(false);
          setOn(false);
        }
      })
      .catch(() => {
        markGoogleSwitching(false);
        setOn(false);
      });
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
