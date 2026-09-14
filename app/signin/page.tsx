"use client";

import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { signIn } from "@/lib/auth";

export default function SignInPage() {
  return (
    <AuthForm
      mode="signin"
      title="Welcome back."
      submitLabel="Sign in"
      onSubmit={signIn}
      footer={
        <>
          {/* One accent text link per footer: the door somebody came
              here to find. The recovery link is the quiet one. */}
          <Link
            href="/auth/forgot"
            className="press inline-flex min-h-11 items-center px-1 font-semibold text-stone-500"
          >
            Forgot your password?
          </Link>
          <span className="mx-1 text-stone-300">·</span>
          <Link
            href="/signup"
            className="press inline-flex min-h-11 items-center px-1 font-semibold text-terracotta-700"
          >
            Create an account
          </Link>
        </>
      }
    />
  );
}
