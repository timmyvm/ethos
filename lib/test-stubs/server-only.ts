/**
 * `server-only` throws wherever it is loaded without Next's server
 * condition, which is the point of it: a secret-holding file pulled into
 * a browser bundle stops the build. Vitest has no such condition, so the
 * tests load this empty file in its place (vitest.config.ts).
 */
export {};
