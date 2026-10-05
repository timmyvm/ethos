"use client";

import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { signIn } from "@/lib/auth";

export default function SignInPage() {
  return (
    <AuthForm
      mode="signin"
      title="Welcome back"
      submitLabel="Sign in"
      onSubmit={signIn}
      /* Recovery sits on the field it recovers (auth-16), the way every
         sign-in screen people already know does it. */
      passwordAside={
        <Link
          href="/auth/forgot"
          className="text-link press -my-3 inline-flex min-h-11 items-center"
        >
          Forgot?
        </Link>
      }
      footer={
        /* One door left in the footer: the one somebody without an
           account came here to find. */
        <Link
          href="/signup"
          className="text-link press inline-flex min-h-11 items-center px-1 text-terracotta-700"
        >
          Create an account
        </Link>
      }
    />
  );
}
