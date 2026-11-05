"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { introFirst, needsAccount, readAccountState } from "@/lib/account-gate";
import { googleSwitching } from "@/lib/google-taken";
import { firstRun } from "@/lib/onboarding";
import { authHref } from "@/lib/use-paywall-return";

/**
 * An account before the app (#410): a guest, or a device with no session
 * that has been through the introduction, is sent to sign up from any
 * screen that is not open without one (lib/account-gate.ts), and comes
 * back to that screen once the account exists. A fresh device is sent
 * through the introduction from any such screen, as Today sends it. The
 * session is read from this device (getSession), so the check costs no
 * network call, and a session it cannot read sends nobody anywhere.
 */
export function AccountGate() {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    let live = true;
    const here = `${window.location.pathname}${window.location.search}`;
    const fresh = firstRun();
    // Decided before the page's own reads mint a session (as Today does).
    if (introFirst(window.location.pathname, fresh)) {
      router.replace("/welcome");
      return;
    }
    void readAccountState().then((state) => {
      // Leaving for Google to sign in with an account that exists (#414).
      if (!live || !state || googleSwitching()) return;
      if (needsAccount(state, window.location.pathname, fresh)) {
        router.replace(authHref("signup", here));
      }
    });
    return () => {
      live = false;
    };
  }, [path, router]);
  return null;
}
