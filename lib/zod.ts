/**
 * zod, set once for this app (security audit, 11 Nov, second pass).
 *
 * zod 4 builds its object parsers with `new Function` when it can, and
 * asks whether it can by trying one. The page's Content-Security-Policy
 * has no 'unsafe-eval' (lib/security-headers.ts), so in a browser that
 * try is refused and reported on every page that loads a schema, and
 * lib/hostile.ts is one the browser loads. `jitless` tells zod not to
 * ask: it parses with plain code everywhere, which for the few small
 * objects read here costs nothing anyone could measure.
 *
 * Import `z` from here, never from "zod", so the setting is in force
 * before the first schema is made.
 */
import { z } from "zod";

z.config({ jitless: true });

export { z };
