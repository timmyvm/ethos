import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

/**
 * `distDir` is read from the environment so a production build can be
 * pointed somewhere else while a dev server is running. `next build`
 * writes .next by default, which is the directory `next dev` is serving
 * out of — so a build during a look-loop session pulls the chunks out
 * from under the browser and every screenshot comes back as a 404 page.
 *
 *   NEXT_DIST_DIR=.next-build npx next build
 *
 * `headers` puts the security headers on every response
 * (lib/security-headers.ts).
 */
const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          dev: process.env.NODE_ENV !== "production",
          preview: process.env.VERCEL_ENV === "preview",
        }),
      },
    ];
  },
};

export default nextConfig;
