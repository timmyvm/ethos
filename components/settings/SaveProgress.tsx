import Link from "next/link";
import { ACTION_CLASS } from "@/lib/ui";

/**
 * The account ask, where an account's settings would be (#479): a guest
 * session has no email to change, no password and nothing to sign out
 * of that would not lose its recordings. You's own ask, in its words
 * (DECISIONS #15): what an account keeps, then the one tap.
 */
export function SaveProgress({ next }: { next: string }) {
  return (
    <section className="card elev-2 mt-5 p-5">
      <h2 className="detail-head">Save your progress</h2>
      <p className="mt-1 text-caption text-pretty text-stone-500">
        Your recordings are only on this device. An account keeps them on any phone.
      </p>
      <Link href={`/signup?next=${encodeURIComponent(next)}`} className={`${ACTION_CLASS} mt-4`}>
        Create my account
      </Link>
      <div className="mt-3 text-center">
        <Link href={`/signin?next=${encodeURIComponent(next)}`} className="text-link text-terracotta-700">
          I already have one
        </Link>
      </div>
    </section>
  );
}
