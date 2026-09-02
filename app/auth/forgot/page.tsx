"use client";

import Link from "next/link";
import { useState } from "react";
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
      <Link href="/signin" className="inline-flex min-h-11 items-center self-start text-sm text-stone-500">
        ← back
      </Link>
      <h1 className="font-display mt-8 text-[30px] font-bold leading-tight">
        {sent ? "Check your inbox" : "Reset your password"}
      </h1>

      {sent ? (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-stone-500">
            If <span className="font-semibold text-ink">{email}</span> has an
            Ethos account, a reset link is on its way from{" "}
            <span className="font-semibold text-ink">hello@speakethos.com</span>
            . The link works once and expires in an hour.
          </p>
          <p className="mt-4 text-[13px] leading-relaxed text-stone-400">
            Nothing about your recordings or your streak changes while you sort this
            out.
          </p>
        </>
      ) : (
        <form onSubmit={submit} className="mt-5">
          <label className="label-data" htmlFor="email">
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
            className="mt-1.5 w-full rounded-full border border-stone-200 bg-surface px-5 py-3.5 text-[16px] placeholder:text-stone-300 focus:border-stone-300"
          />
          {error && (
            <p className="mt-4 rounded-[20px] bg-terracotta-50 px-4 py-3 text-[13.5px] text-terracotta-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="press mt-5 w-full rounded-full bg-terracotta-500 px-6 py-4 text-[17px] font-semibold text-cream disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send the link"}
          </button>
        </form>
      )}
    </main>
  );
}
