// Deploy bridge. The MCP file-upload deploy path can't carry a full
// Next.js tree (size limits, and binaries base64-inflate), so the
// source bundle and brand assets are pulled from the project's public
// Supabase bucket at build time.
//
// Anything already on disk wins — a git-linked deploy ships the real
// tree and this becomes a no-op.
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";

const BASE =
  "https://dthjdyitvieyufufkkly.supabase.co/storage/v1/object/public/brand";

const BINARIES = [
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

function write(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

for (const name of BINARIES) {
  const local = `public/${name}`;
  if (existsSync(local)) continue;
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  write(local, Buffer.from(await res.arrayBuffer()));
  console.log("asset", local);
}

// Source bundle: { "app/page.tsx": "...", ... }
const res = await fetch(`${BASE}/src-bundle.json`);
if (!res.ok) throw new Error(`src-bundle: HTTP ${res.status}`);
const bundle = await res.json();
let restored = 0;
for (const [path, contents] of Object.entries(bundle)) {
  if (existsSync(path)) continue;
  write(path, contents);
  restored++;
}
console.log(`restored ${restored} source files from bundle`);
