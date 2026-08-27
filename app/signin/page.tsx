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
          <Link href="/auth/forgot" className="font-semibold text-terracotta-600">
            Forgot your password?
          </Link>
          <span className="mx-2 text-stone-300">·</span>
          <Link href="/signup" className="font-semibold text-terracotta-600">
            Create an account
          </Link>
        </>
      }
    />
  );
}
