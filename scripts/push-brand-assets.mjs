// Pushes public/ binaries to the Supabase `brand` bucket.
//
// scripts/vercel-fetch-assets.mjs pulls these at build time, because the
// MCP deploy path can't carry binaries. That means a changed image is not
// deployed until it's here — the bucket is the source the build reads.
//
// Run from the repo root:  node scripts/push-brand-assets.mjs
// Needs SUPABASE_SERVICE_ROLE_KEY in .env.local (gitignored, never logged).
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error(".env.local is missing Supabase URL or service key");

const TYPES = { webp: "image/webp", png: "image/png" };

const FILES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "demos.webp",
      "demos-speaking.webp",
      "demos-listening.webp",
      "demos-celebrate.webp",
      "demos-workout.webp",
      "demos-asleep.webp",
      "icon-192.webp",
      "icon-512.webp",
      "apple-touch-icon.png",
    ];

let failed = 0;
for (const name of FILES) {
  const body = readFileSync(`public/${name}`);
  const res = await fetch(`${URL}/storage/v1/object/brand/${name}`, {
    method: "PUT",
    headers: {
      // The sb_secret_* key format is not a JWT, so storage rejects it as a
      // bare bearer token — it has to arrive as an apikey as well.
      Authorization: `Bearer ${KEY}`,
      apikey: KEY,
      "Content-Type": TYPES[name.split(".").pop()] ?? "application/octet-stream",
      "cache-control": "3600",
      "x-upsert": "true",
    },
    body,
  });
  if (!res.ok) failed++;
  console.log(
    name.padEnd(24),
    res.ok ? `ok ${Math.round(body.length / 1024)}KB` : `FAILED ${res.status}`
  );
}
if (failed) process.exit(1);
