"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { needsAccount } from "@/lib/account-gate";
import { googleSwitching } from "@/lib/google-taken";
import { firstRun } from "@/lib/onboarding";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { authHref } from "@/lib/use-paywall-return";

/**
 * An account before the app (#410): a guest, or a device with no session
 * that has been through the introduction, is sent to sign up from any
 * screen that is not open without one (lib/account-gate.ts), and comes
 * back to that screen once the account exists. The session is read from
 * this device (getSession), so the check costs no network call.
 */
export function AccountGate() {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    const db = supabaseBrowser();
    if (!db) return;
    let live = true;
    const here = `${window.location.pathname}${window.location.search}`;
    const fresh = firstRun();
    void db.auth
      .getSession()
      .then(({ data }) => {
        // Leaving for Google to sign in with an account that exists (#414).
        if (!live || googleSwitching()) return;
        const user = data.session?.user ?? null;
        const state = {
          signedIn: user !== null,
          anonymous: user?.is_anonymous ?? false,
          pendingEmail: Boolean(user?.new_email),
        };
        if (needsAccount(state, window.location.pathname, fresh)) {
          router.replace(authHref("signup", here));
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [path, router]);
  return null;
}
