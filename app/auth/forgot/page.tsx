"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  FIELD_CLASS,
  FormError,
  LABEL_CLASS,
  Shell,
} from "@/components/AuthForm";
import { ACTION_CLASS, DISABLED_CLASS } from "@/lib/ui";
import { sendReset } from "@/lib/auth";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  // The one field is the one at fault: the cursor goes back into it.
  useEffect(() => {
    if (error) field.current?.focus();
  }, [error]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await sendReset(email);
    setBusy(false);
    if (result.ok) {
      setNote(result.note ?? null);
      setSent(true);
    } else setError(result.error ?? "That didn't work.");
  }

  return (
    <Shell
      title={sent ? "Check your inbox" : "Reset your password"}
      back={{ href: "/signin", label: "Sign in" }}
    >
      {sent ? (
        <div className="arrive flex flex-1 flex-col">
          <p className="mt-3 text-read text-stone-800 text-pretty">
            If{" "}
            <span
              translate="no"
              className="font-semibold text-ink [overflow-wrap:anywhere]"
            >
              {email}
            </span>{" "}
            has an Ethos account, a reset link is on its way from{" "}
            <span
              translate="no"
              className="font-semibold text-ink [overflow-wrap:anywhere]"
            >
              hello@speakethos.com
            </span>
            . The link works once and expires in an hour.
          </p>
          {note && (
            <p className="mt-3 text-caption leading-relaxed text-stone-500">
              {note}
            </p>
          )}
          <p className="mt-4 text-caption leading-relaxed text-stone-400">
            Nothing about your recordings or your streak changes while you
            sort this out.
          </p>
          {/* Nothing to type, so the way on sits at the bottom (auth-11);
              it used to have no action at all. */}
          <div className="mt-auto pt-8">
            <Link href="/signin" className={ACTION_CLASS}>
              Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        /* One field and one tap: the lifted panel is the screen. */
        <form onSubmit={submit} noValidate className="card elev-2 mt-6 p-5">
          <label className={LABEL_CLASS} htmlFor="email">
            Email
          </label>
          <input
            ref={field}
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "form-error" : undefined}
            className={FIELD_CLASS}
          />
          {error && <FormError>{error}</FormError>}
          <button
            type="submit"
            disabled={busy}
            className={`${ACTION_CLASS} ${DISABLED_CLASS} mt-5`}
          >
            {busy ? "Sending…" : "Email me a reset link"}
          </button>
        </form>
      )}
    </Shell>
  );
}
