"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { FIELD_BARE_CLASS, FormError, LABEL_CLASS, PASSWORD_HELP } from "@/components/AuthForm";
import { NewPasswordField, ShowPassword, useHidOnSubmit } from "@/components/NewPassword";
import { PAGE_CLASS } from "@/components/settings/Rows";
import { SaveProgress } from "@/components/settings/SaveProgress";
import { Skeleton } from "@/components/ui/Skeleton";
import { changePassword } from "@/lib/account-settings";
import { SETTINGS_ACCOUNT, withEmail } from "@/lib/auth";
import { useAccount } from "@/lib/use-account";
import { useTapAboveKeys } from "@/lib/keyboard-up";
import { ACTION_CLASS, DISABLED_CLASS } from "@/lib/ui";

/**
 * Password (#479): change it, with the one you have now checked first;
 * or, for an account that only ever signed in with Google, set its
 * first one (lib/account-settings.ts). The new one is the sign-up's own
 * field (#462, #463): its outline closes at eight characters, a password
 * everyone tries is said at once, and both fields have Show.
 */
export default function PasswordPage() {
  const { account } = useAccount();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field?: "current" | "password" } | null>(null);
  const [done, setDone] = useState(false);
  const currentField = useRef<HTMLInputElement>(null);
  const nextField = useRef<HTMLInputElement>(null);
  const [shown, setShown] = useHidOnSubmit(currentField);
  const tap = useRef<HTMLButtonElement>(null);
  /* The keyboard never covers the tap (#441). */
  const room = useTapAboveKeys(tap);

  const first = account?.kind === "account" && !account.password;

  // The field at fault takes the cursor back.
  useEffect(() => {
    if (error?.field === "current") currentField.current?.focus();
    else if (error?.field === "password") nextField.current?.focus();
  }, [error]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (account?.kind !== "account" || !account.email) return;
    setBusy(true);
    setError(null);
    const r = await changePassword({ email: account.email, current: first ? undefined : current, next });
    setBusy(false);
    if (r.ok) {
      setDone(true);
      setCurrent("");
      setNext("");
    } else setError({ text: r.error ?? "That didn't go through. Try again.", field: r.field });
  }

  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="Password" back={{ href: "/settings/account", label: "Account" }} />

      {account === undefined ? (
        <Skeleton className="mt-6 h-[300px] w-full" rounded="rounded-card" />
      ) : account.kind !== "account" ? (
        <SaveProgress next={SETTINGS_ACCOUNT} />
      ) : done ? (
        <div role="status" className="arrive mt-5">
          <h2 className="detail-head">{first ? "Password set" : "Password changed"}</h2>
          <p className="mt-2 text-read text-pretty text-stone-800">
            Sign in with <span translate="no" className="font-semibold text-ink [overflow-wrap:anywhere]">{account.email}</span> and the new one from now on.
          </p>
          <Link href="/settings/account" className={`${ACTION_CLASS} mt-6`}>
            Back to Account
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="card elev-2 mt-5 p-5">
          {/* The account's email, for a password manager to file the new one under. */}
          <input type="email" name="username" autoComplete="username" value={account.email ?? ""} readOnly hidden />
          {!first && (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <label className={LABEL_CLASS} htmlFor="current-password">
                  Password now
                </label>
                <Link href={withEmail("/auth/forgot", account.email)} className="text-link">
                  Forgot?
                </Link>
              </div>
              <div className="relative mt-2">
                <input
                  ref={currentField}
                  id="current-password"
                  name="current-password"
                  type={shown ? "text" : "password"}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  aria-invalid={error?.field === "current" || undefined}
                  aria-describedby={error?.field === "current" ? "form-error" : undefined}
                  className={`${FIELD_BARE_CLASS} pr-18`}
                />
                <ShowPassword shown={shown} onToggle={() => setShown(!shown)} />
              </div>
            </>
          )}
          <label className={`${LABEL_CLASS} ${first ? "" : "mt-5"}`} htmlFor="password">
            {first ? "Password" : "New password"}
          </label>
          <NewPasswordField
            value={next}
            onChange={setNext}
            email={account.email ?? ""}
            inputRef={nextField}
            inputClassName={FIELD_BARE_CLASS}
            invalid={error?.field === "password"}
            errorId="form-error"
            help={PASSWORD_HELP}
          />
          {error && <FormError>{error.text}</FormError>}
          <button
            ref={tap}
            type="submit"
            disabled={busy || next === "" || (!first && current === "")}
            className={`${ACTION_CLASS} ${DISABLED_CLASS} mt-5`}
          >
            {busy ? "Saving…" : first ? "Set password" : "Change password"}
          </button>
        </form>
      )}
      {room > 0 && <div aria-hidden style={{ height: room }} />}
    </main>
  );
}
