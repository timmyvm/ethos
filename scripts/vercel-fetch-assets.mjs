// Deploy bridge: file-upload deploys to Vercel can't carry the full tree
// efficiently, so binary assets — and any source file missing from the
// upload — are pulled from the project's public Supabase bucket at build
// time. Files already present (git-linked deploys ship everything) are
// never overwritten, so this is a no-op outside bridge deploys.
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";

const BASE =
  "https://dthjdyitvieyufufkkly.supabase.co/storage/v1/object/public/brand";

const FILES = [
  ["public/demos.webp", "demos.webp"],
  ["public/demos-speaking.webp", "demos-speaking.webp"],
  ["public/icon-192.webp", "icon-192.webp"],
  ["public/icon-512.webp", "icon-512.webp"],
  ["public/apple-touch-icon.png", "apple-touch-icon.png"],
  ["lib/coach.ts", "src/lib/coach.ts"],
  ["app/rep/page.tsx", "src/app/rep/page.tsx"],
  ["app/api/analyze/route.ts", "src/app/api/analyze/route.ts"],
  ["components/PauseBar.tsx", "src/components/PauseBar.tsx"],
  ["components/Stars.tsx", "src/components/Stars.tsx"],
  ["components/DimensionList.tsx", "src/components/DimensionList.tsx"],
];

for (const [local, remote] of FILES) {
  if (existsSync(local)) continue;
  const res = await fetch(`${BASE}/${remote}`);
  if (!res.ok) throw new Error(`${remote}: HTTP ${res.status}`);
  mkdirSync(dirname(local), { recursive: true });
  writeFileSync(local, Buffer.from(await res.arrayBuffer()));
  console.log("fetched", local);
}
