"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { FIELD_CLASS, FormError, LABEL_CLASS } from "@/components/AuthForm";
import { PAGE_CLASS } from "@/components/settings/Rows";
import { SaveProgress } from "@/components/settings/SaveProgress";
import { Skeleton } from "@/components/ui/Skeleton";
import { changeEmail } from "@/lib/account-settings";
import { SETTINGS_ACCOUNT } from "@/lib/auth";
import { useAccount } from "@/lib/use-account";
import { useTapAboveKeys } from "@/lib/keyboard-up";
import { ACTION_CLASS, DISABLED_CLASS } from "@/lib/ui";

/**
 * Change email (#479): one field and one tap, in the auth screens' card
 * (#350). Supabase keeps the old address until the link it sends is
 * opened, so the page says where to look, not that it changed. The field
 * and its tap stand at the top of the page, so the keyboard never
 * covers the tap (#441).
 */
export default function ChangeEmailPage() {
  const { account } = useAccount();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ to: string; note?: string } | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const tap = useRef<HTMLButtonElement>(null);
  /* The keyboard never covers the tap (#441). */
  const room = useTapAboveKeys(tap);

  // The one field is the one at fault: the cursor goes back into it.
  useEffect(() => {
    if (error) field.current?.focus();
  }, [error]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await changeEmail(email, account?.email ?? null);
    setBusy(false);
    if (r.ok) setSent({ to: email.trim(), note: r.note });
    else setError(r.error ?? "That didn't go through. Try again.");
  }

  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="Change email" back={{ href: "/settings/account", label: "Account" }} />

      {account === undefined ? (
        <Skeleton className="mt-6 h-[214px] w-full" rounded="rounded-card" />
      ) : account.kind !== "account" ? (
        <SaveProgress next={SETTINGS_ACCOUNT} />
      ) : sent ? (
        <div role="status" className="arrive mt-5">
          <h2 className="detail-head">Check your inbox</h2>
          <p className="mt-2 text-read text-pretty text-stone-800">
            A link is on its way to <span translate="no" className="font-semibold text-ink [overflow-wrap:anywhere]">{sent.to}</span>. Your email changes when you open it. If{" "}
            <span translate="no" className="font-semibold text-ink [overflow-wrap:anywhere]">{account.email}</span> gets one too, open both.
          </p>
          {sent.note && <p className="mt-3 text-caption leading-relaxed text-stone-500">{sent.note}</p>}
          <Link href="/settings/account" className={`${ACTION_CLASS} mt-6`}>
            Back to Account
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="card elev-2 mt-5 p-5">
          <p className="text-caption text-stone-500">
            Now <span translate="no" className="font-semibold text-ink [overflow-wrap:anywhere]">{account.email}</span>
          </p>
          <label className={`${LABEL_CLASS} mt-4`} htmlFor="email">
            New email
          </label>
          <input
            ref={field}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="send"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "form-error" : undefined}
            className={FIELD_CLASS}
          />
          {error && <FormError>{error}</FormError>}
          <button ref={tap} type="submit" disabled={busy || email.trim() === ""} className={`${ACTION_CLASS} ${DISABLED_CLASS} mt-5`}>
            {busy ? "Sending…" : "Send the link"}
          </button>
        </form>
      )}
      {room > 0 && <div aria-hidden style={{ height: room }} />}
    </main>
  );
}
