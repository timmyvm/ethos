"use client";

import Image from "next/image";

/**
 * The coin, at its four moments (decisions 11 Aug, §0.4).
 *
 * Filled variants are the shipped SVG assets in public/coin/. The empty
 * variant is inlined instead so it can draw itself in `currentColor` —
 * a fixed grey either glows on the dark ground or vanishes on the cream
 * one, and an empty slot has to read the same in both.
 *
 * Amber stays earned-only (brand.md): an unearned coin is never gold.
 */
export type CoinVariant = "coin" | "stack" | "burst" | "empty";

const SRC: Record<Exclude<CoinVariant, "empty">, string> = {
  coin: "/coin/coin.svg",
  stack: "/coin/coin-stack.svg",
  burst: "/coin/coin-burst.svg",
};

export function Coin({
  variant = "coin",
  size = 28,
  className = "",
}: {
  variant?: CoinVariant;
  size?: number;
  className?: string;
}) {
  if (variant === "empty") {
    return (
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        aria-hidden
        className={`shrink-0 text-stone-400 ${className}`}
      >
        <circle cx="32" cy="32" r="30" fill="currentColor" opacity="0.28" />
        <circle cx="32" cy="30.5" r="23" fill="currentColor" opacity="0.22" />
        <path
          d="M22 20h20a4 4 0 0 1 4 4v11a4 4 0 0 1-4 4H31l-7 6v-6h-2a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4Z"
          fill="currentColor"
          opacity="0.34"
        />
      </svg>
    );
  }

  return (
    <Image
      src={SRC[variant]}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`}
      draggable={false}
    />
  );
}
