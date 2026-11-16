"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ActionRow, InfoRow, InfoRowSkeleton, LinkRow, PAGE_CLASS, Section } from "@/components/settings/Rows";
import { SaveProgress } from "@/components/settings/SaveProgress";
import { GoogleMark } from "@/components/AuthForm";
import { linkGoogle, signOutEverywhere } from "@/lib/account-settings";
import { SETTINGS_ACCOUNT } from "@/lib/auth";
import { SIGNED_OUT_HOME } from "@/lib/account-gate";
import { forgetPlanHint } from "@/lib/plan-hint";
import { forgetTesterHint } from "@/lib/tester-client";
import { prefersReducedMotion } from "@/lib/prefs";
import { useAccount } from "@/lib/use-account";

/**
 * Account (#479): the email, the password, the ways in, and signing out
 * of every device. Each is Supabase Auth's own (lib/account-settings.ts)
 * and each needs an account with an email; a guest session sees the
 * account ask instead, the way You asks.
 */
export default function AccountPage() {
  const { account } = useAccount();
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const door = useRef<HTMLButtonElement>(null);
  const confirmCard = useRef<HTMLDivElement>(null);
  const keep = useRef<HTMLButtonElement>(null);

  async function link() {
    setLinking(true);
    setLinkError(null);
    const r = await linkGoogle();
    // On success the browser is already on its way to Google.
    if (!r.ok) {
      setLinking(false);
      setLinkError(r.error ?? "Google didn't open. Try again.");
    }
  }

  /* The confirm opens in view, its way back first and focused (#445). */
  function ask() {
    flushSync(() => {
      setConfirming(true);
      setLeaveError(null);
    });
    keep.current?.focus({ preventScroll: true });
    confirmCard.current?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }
  function back() {
    flushSync(() => setConfirming(false));
    door.current?.focus({ preventScroll: true });
  }
  async function leaveEverywhere() {
    setLeaving(true);
    setLeaveError(null);
    const r = await signOutEverywhere();
    if (!r.ok) {
      setLeaving(false);
      setLeaveError(r.error ?? "That didn't go through. Try again.");
      return;
    }
    forgetPlanHint();
    forgetTesterHint();
    window.location.href = SIGNED_OUT_HOME;
  }

  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="Account" back={{ href: "/settings", label: "Settings" }} />

      {account === undefined ? (
        <Section className="mt-5">
          <InfoRowSkeleton />
          <InfoRowSkeleton />
        </Section>
      ) : account.kind !== "account" ? (
        <SaveProgress next={SETTINGS_ACCOUNT} />
      ) : (
        <>
          {/* The two things you type to sign in, as Duolingo's Profile
              holds them: each opens its own form. */}
          <Section
            className="mt-5"
            footer={
              account.pendingEmail
                ? `Waiting on ${account.pendingEmail}: open the link sent there.`
                : account.password
                  ? undefined
                  : "Set a password to sign in with your email as well as Google."
            }
          >
            <LinkRow href="/settings/account/email" label="Email" value={account.email} />
            <LinkRow href="/settings/account/password" label={account.password ? "Change password" : "Set a password"} />
          </Section>

          <Section title="Ways to sign in">
            <InfoRow label="Email and password" value={account.password ? "On" : "Not set"} />
            {account.google ? (
              <InfoRow label="Google" value="Linked" />
            ) : (
              <ActionRow
                label={linking ? "Opening Google…" : "Link Google"}
                note={linkError ?? undefined}
                onClick={() => void link()}
                disabled={linking}
                busy={linking}
                trailing={<GoogleMark size={18} />}
              />
            )}
          </Section>

          <Section title="Devices">
            {!confirming ? (
              <ActionRow
                buttonRef={door}
                label="Sign out of all devices"
                note="Every phone and browser, this one too."
                onClick={ask}
              />
            ) : (
              <div ref={confirmCard} className="group-row scroll-mb-[var(--nav-clear)] scroll-mt-16 py-4">
                <p className="text-read text-pretty text-stone-800">
                  Every phone and browser signed in to <span className="font-semibold text-ink [overflow-wrap:anywhere]">{account.email}</span> signs out, this one too. Your recordings stay on your account.
                </p>
                {leaveError && (
                  <p role="alert" className="mt-2 text-caption font-semibold text-rust">
                    {leaveError}
                  </p>
                )}
                {/* The way back leads, as every confirm on the phone does (#445). */}
                <div className="mt-3 flex gap-2">
                  <button
                    ref={keep}
                    type="button"
                    onClick={back}
                    disabled={leaving}
                    className="press font-display min-h-11 flex-1 rounded-tap border border-edge bg-ground px-4 py-2.5 text-row disabled:opacity-60"
                  >
                    Keep me signed in
                  </button>
                  <button
                    type="button"
                    onClick={() => void leaveEverywhere()}
                    disabled={leaving}
                    className="press font-display min-h-11 flex-1 rounded-tap border border-edge bg-ground px-4 py-2.5 text-row disabled:opacity-60"
                  >
                    {leaving ? "Signing out…" : "Sign out everywhere"}
                  </button>
                </div>
              </div>
            )}
          </Section>
        </>
      )}
    </main>
  );
}
