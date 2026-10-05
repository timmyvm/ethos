"use client";

import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { createAccount } from "@/lib/auth";

/**
 * Sign-up (§0.2): Google, or email and password (Google since 27 Aug).
 *
 * Reached from the "save your progress" gate, which only ever appears
 * after a recording has landed (DECISIONS #15). Nobody is asked to make
 * an account before the product has worked once.
 *
 * The title claims what was earned only when there is something on this
 * device to keep; AuthForm decides that once its reads are in, so the
 * title never changes after it is drawn (auth-12).
 */
export default function SignUpPage() {
  return (
    <AuthForm
      mode="signup"
      title="Create your account"
      progressTitle="Keep what you've earned"
      submitLabel="Create my account"
      onSubmit={createAccount}
      footer={
        <p className="text-caption text-stone-500">
          Already have one?{" "}
          <Link
            href="/signin"
            className="text-link press inline-flex min-h-11 items-center px-1 text-terracotta-700"
          >
            Sign in
          </Link>
        </p>
      }
    />
  );
}
