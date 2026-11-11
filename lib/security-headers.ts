/**
 * The headers every response carries (security audit, 11 Nov). Before
 * this the site sent none but Vercel's own HSTS: any page could be put
 * in a frame on another site (a tap on Settings' "Delete account" under
 * somebody else's button), and a script that ever got onto a page could
 * send the session anywhere.
 *
 * The policy lists what the browser really talks to, read from the code:
 *   - this origin, for pages, /api, the pose model and its wasm
 *   - the Supabase project, for auth, data and signed recordings
 * Stripe Checkout, the billing portal and Google sign-in are whole-page
 * navigations, so nothing is framed and no third-party script loads.
 *
 * `script-src` keeps 'unsafe-inline': the five boot scripts in
 * app/layout.tsx and Next's own flight scripts are inline, and a nonce
 * would make every page render per request, where today each is static.
 * It still refuses a script from any other origin, eval, a frame, a form
 * posted elsewhere and a connection to a host not named here, which is
 * what stops a stolen session leaving.
 */

export interface HeaderEnv {
  supabaseUrl?: string;
  /** `next dev`: React needs eval and the dev server a websocket. */
  dev?: boolean;
  /** A Vercel preview: its comment toolbar loads from vercel.live. */
  preview?: boolean;
  /** Served by Vercel, over https only: plain-http requests are upgraded. */
  hosted?: boolean;
}

/**
 * The project's origin as the build was given it. It is this app's own
 * setting, so its scheme is taken as it comes: the look scripts and the
 * gates run against `http://supabase.local`, answered by Playwright, and
 * a policy that named only https would stop every one of them.
 */
function origin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(env: HeaderEnv): string {
  const supabase = origin(env.supabaseUrl);
  const supabaseWs = supabase?.replace(/^http/, "ws") ?? null;
  const live = env.preview ? ["https://vercel.live"] : [];
  const list = (...parts: (string | null | false | undefined)[]) =>
    parts.filter(Boolean).join(" ");

  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": list(
      "'self'",
      "'unsafe-inline'",
      // The on-device pose model compiles wasm (Calibrate, Video).
      "'wasm-unsafe-eval'",
      env.dev && "'unsafe-eval'",
      ...live
    ),
    "style-src": list("'self'", "'unsafe-inline'", ...live),
    "font-src": list("'self'", "data:", ...live),
    "img-src": list("'self'", "data:", "blob:", supabase, ...live),
    // A take being played back is a blob; a stored one is a signed URL.
    "media-src": list("'self'", "blob:", "data:", supabase),
    "connect-src": list("'self'", supabase, supabaseWs, env.dev && "ws:", ...live, env.preview && "wss://ws-us3.pusher.com"),
    "worker-src": "'self' blob:",
    "manifest-src": "'self'",
    "frame-src": env.preview ? "https://vercel.live" : "'none'",
    "frame-ancestors": "'none'",
    "form-action": "'self'",
    "base-uri": "'self'",
    "object-src": "'none'",
  };
  const policy = Object.entries(directives).map(([k, v]) => `${k} ${v}`);
  // Only where every request is https already: on a laptop it would turn
  // the fixtures' http://supabase.local into an https nobody answers.
  if (env.hosted) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function securityHeaders(env: HeaderEnv): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(env) },
    // For browsers older than frame-ancestors.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // The mic and the camera are the product; nothing else is asked for.
    {
      key: "Permissions-Policy",
      value:
        "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=()",
    },
    // Two years, subdomains included. Vercel sends its own without them.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    // A window this app opens, or one that opened it, shares nothing with it.
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];
}
