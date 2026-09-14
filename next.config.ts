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
const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
