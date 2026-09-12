"use client";

import Link from "next/link";
import { useState } from "react";
import { FIELD_CLASS, FormError } from "@/components/AuthForm";
import { ACTION_CLASS } from "@/components/LessonScreen";
import { DISABLED_CLASS } from "@/lib/ui";
import { sendReset } from "@/lib/auth";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await sendReset(email);
    setBusy(false);
    if (result.ok) setSent(true);
    else setError(result.error ?? "That didn't work.");
  }

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-10 pt-7">
      <Link
        href="/signin"
        className="press inline-flex min-h-11 items-center self-start text-[13px] font-semibold text-stone-500"
      >
        ← back
      </Link>
      <h1 className="font-display mt-7 text-title">
        {sent ? "Check your inbox" : "Reset your password"}
      </h1>

      {sent ? (
        <>
          <p className="mt-3 text-body leading-relaxed text-stone-500">
            If <span className="font-semibold text-ink">{email}</span> has an
            Ethos account, a reset link is on its way from{" "}
            <span className="font-semibold text-ink">hello@speakethos.com</span>
            . The link works once and expires in an hour.
          </p>
          <p className="mt-4 text-caption leading-relaxed text-stone-400">
            Nothing about your recordings or your streak changes while you sort this
            out.
          </p>
        </>
      ) : (
        /* One field and one tap: the lifted panel is the screen. */
        <form
          onSubmit={submit}
          className="elev-2 mt-6 rounded-card border border-card-edge bg-raised p-4"
        >
          <label className="label-micro" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className={FIELD_CLASS}
          />
          {error && <FormError>{error}</FormError>}
          <button
            type="submit"
            disabled={busy}
            className={`${ACTION_CLASS} ${DISABLED_CLASS} mt-5`}
          >
            {busy ? "Sending…" : "Send the link"}
          </button>
        </form>
      )}
    </main>
  );
}
