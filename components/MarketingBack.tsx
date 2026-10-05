"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { BackLink, ScreenHeader } from "@/components/ui/ScreenHeader";

/**
 * The way back off the marketing pages (marketing-2, marketing-3).
 *
 * /about, /privacy and /terms are the acquisition pages a stranger
 * reads, and also three rows in Settings (#283). A stranger's way on is
 * Sign in, and their way back from the legal pages is the landing page;
 * somebody inside the app came from Settings and wants to go back
 * there. Settings links in with `?from=settings`, and that is the only
 * thing these pages read.
 *
 * Read here, in a client component under Suspense, so the pages stay
 * statically rendered: an async `searchParams` in the page would make
 * all three dynamic for the sake of one link. The static HTML is the
 * stranger's version (each page passes it as the Suspense fallback),
 * and somebody from Settings gets their back in the same slot once the
 * page hydrates, at the same height, so nothing below it moves.
 */
function useFromSettings(): boolean {
  return useSearchParams().get("from") === "settings";
}

/**
 * About's top row. From Settings: the back, on the leading edge where
 * every back in the app sits (BackLink's own geometry), and nothing
 * else. Otherwise: the stranger's row the page hands in (the wordmark
 * and Sign in).
 */
export function MarketingBack({ stranger }: { stranger: ReactNode }) {
  if (!useFromSettings()) return stranger;
  return (
    <div className="flex min-h-11 items-center">
      <BackLink href="/settings" label="Settings" />
    </div>
  );
}

/** The legal pages' header: back to Settings from inside the app,
    back to the landing page for everyone else. */
export function MarketingHeader({ title }: { title: string }) {
  const fromSettings = useFromSettings();
  return (
    <ScreenHeader
      title={title}
      back={
        fromSettings
          ? { href: "/settings", label: "Settings" }
          : { href: "/about", label: "Ethos" }
      }
    />
  );
}

/**
 * A link between the three pages that keeps `?from=settings`, so
 * somebody who opened About from Settings and then read the terms
 * still has Settings as their way back.
 */
export function MarketingLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <Link href={href} className={className}>
          {children}
        </Link>
      }
    >
      <KeepFrom href={href} className={className}>
        {children}
      </KeepFrom>
    </Suspense>
  );
}

function KeepFrom({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const fromSettings = useFromSettings();
  return (
    <Link href={fromSettings ? `${href}?from=settings` : href} className={className}>
      {children}
    </Link>
  );
}
