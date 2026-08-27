"use client";

import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { createAccount } from "@/lib/auth";

/**
 * Sign-up (§0.2): email and password, no social login.
 *
 * Reached from the "save your progress" gate, which only ever appears
 * after a rep has landed (DECISIONS #15). Nobody is asked to make an
 * account before the product has worked once.
 */
export default function SignUpPage() {
  return (
    <AuthForm
      mode="signup"
      title="Keep what you've earned."
      submitLabel="Create my account"
      onSubmit={createAccount}
      footer={
        <>
          Already have one?{" "}
          <Link href="/signin" className="font-semibold text-terracotta-600">
            Sign in
          </Link>
        </>
      }
    />
  );
}
