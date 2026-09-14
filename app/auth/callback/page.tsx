"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ACTION_CLASS } from "@/components/LessonScreen";
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
        <p className="text-body text-stone-500">Confirming…</p>
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
          <h1 className="font-display mt-6 text-title">You&apos;re in.</h1>
          <p className="mt-3 max-w-[300px] text-body leading-relaxed text-stone-500">
            {email ? `${email} is confirmed.` : "Your email is confirmed."}{" "}
            Everything you&apos;ve already recorded came with you.
          </p>
          <Link href="/" className={`${ACTION_CLASS} mt-7 max-w-[320px]`}>
            Back to the floor
          </Link>
        </>
      )}

      {state === "stale" && (
        <>
          <h1 className="font-display text-title">
            That link has already been used.
          </h1>
          <p className="mt-3 max-w-[300px] text-body leading-relaxed text-stone-500">
            Confirmation links work once. If you&apos;ve already confirmed,
            just sign in.
          </p>
          <Link href="/signin" className={`${ACTION_CLASS} mt-7 max-w-[320px]`}>
            Sign in
          </Link>
        </>
      )}
    </main>
  );
}
