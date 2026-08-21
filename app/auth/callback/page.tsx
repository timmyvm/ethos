"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { sessionState } from "@/lib/auth";

/**
 * Where an email-confirmation link lands.
 *
 * The Supabase browser client reads the session out of the URL fragment
 * as it initialises, so there is nothing to do here but wait a beat and
 * then say plainly whether it worked. Password resets go straight to
 * /auth/reset instead of routing through here.
 */
export default function CallbackPage() {
  const [state, setState] = useState<"waiting" | "ok" | "stale">("waiting");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      sessionState()
        .then((s) => {
          setEmail(s.email);
          setState(s.signedIn && !s.anonymous ? "ok" : "stale");
        })
        .catch(() => setState("stale"));
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      {state === "waiting" && (
        <p className="text-[15px] text-stone-500">Confirming…</p>
      )}

      {state === "ok" && (
        <>
          <Image
            src="/demos-celebrate.webp"
            alt=""
            width={140}
            height={140}
            className="demos w-[140px]"
          />
          <h1 className="font-display mt-6 text-[28px] font-bold leading-tight">
            You&apos;re in.
          </h1>
          <p className="mt-3 max-w-[300px] text-[15px] leading-relaxed text-stone-500">
            {email ? `${email} is confirmed.` : "Your email is confirmed."}{" "}
            Everything you&apos;ve already recorded came with you.
          </p>
          <Link
            href="/"
            className="press mt-7 w-full max-w-[320px] rounded-[15px] bg-terracotta-500 px-6 py-4 text-[17px] font-semibold text-cream"
          >
            Back to the floor
          </Link>
        </>
      )}

      {state === "stale" && (
        <>
          <h1 className="font-display text-[26px] font-bold leading-tight">
            That link has already been used.
          </h1>
          <p className="mt-3 max-w-[300px] text-[15px] leading-relaxed text-stone-500">
            Confirmation links work once. If you&apos;ve already confirmed,
            just sign in.
          </p>
          <Link
            href="/signin"
            className="press mt-7 w-full max-w-[320px] rounded-[15px] bg-terracotta-500 px-6 py-4 text-[17px] font-semibold text-cream"
          >
            Sign in
          </Link>
        </>
      )}
    </main>
  );
}
