import type { NextConfig } from "next";

/**
 * `distDir` is read from the environment so a production build can be
 * pointed somewhere else while a dev server is running. `next build`
 * writes .next by default, which is the directory `next dev` is serving
 * out of — so a build during a look-loop session pulls the chunks out
 * from under the browser and every screenshot comes back as a 404 page.
 *
 *   NEXT_DIST_DIR=.next-build npx next build
 */

/**
 * The browser's own guards (#457, the security sweep). Ethos sent none.
 * The Supabase session, refresh token included, lives in localStorage,
 * so one injected script would have been a whole account, and any site
 * could frame the app over a tap.
 *
 * Every origin the page talks to is its own, but one: Supabase, for
 * the database, sign-in and a recording's signed audio link (named by
 * the build's own NEXT_PUBLIC_SUPABASE_URL). Fonts are next/font's, the
 * pose model and its WASM are staged under /pose, Speed Insights posts
 * to /_vercel on this origin, and Stripe and Google are whole-page
 * navigations, which a policy does not govern.
 *
 *  - `'unsafe-inline'` scripts: Next's own inline payloads and the six
 *    boot scripts in app/layout.tsx. A nonce would make every page
 *    dynamic; what keeps an injected script harmless is `connect-src`,
 *    which leaves it nowhere to send a session.
 *  - `'wasm-unsafe-eval'`: MediaPipe's pose WASM, on-device (Video).
 *  - Production only: `next dev` evaluates its modules and would be
 *    refused.
 */
function securityHeaders(): { key: string; value: string }[] {
  const supabase = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
    } catch {
      return "";
    }
  })();
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `media-src 'self' blob: ${supabase}`.trim(),
    `connect-src 'self' ${supabase}`.trim(),
    "font-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(self), microphone=(self), screen-wake-lock=(self), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}

const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [{ source: "/(.*)", headers: securityHeaders() }];
  },
};

export default nextConfig;
