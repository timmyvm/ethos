/**
 * Stage the on-device pose assets into public/pose/.
 *
 * Pose detection runs client-side (decisions 11 Aug, §1) — raw video
 * never leaves the machine. Self-hosting the runtime is the other half
 * of that promise: loading the WASM and the model from Google's CDN
 * would mean every Voice + Video rep announces itself to a third party
 * before a single frame is analysed, which makes "video never leaves
 * your device" technically true and practically weaselly.
 *
 * The WASM ships inside @mediapipe/tasks-vision, so it's a copy. The
 * model is a 5.5MB binary that doesn't, so it's a download — cached in
 * public/pose/ and gitignored, fetched at build time.
 *
 * NEVER fatal. A build without pose assets still ships the entire audio
 * loop; the mode toggle just reports Voice + Video as unavailable
 * instead of pretending to measure a body it can't see.
 */

import { createWriteStream } from "node:fs";
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "public", "pose");
const wasmSrc = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const MODEL_FILE = "pose_landmarker_lite.task";
/** Anything smaller than this is a truncated download or an error page. */
const MODEL_MIN_BYTES = 1_000_000;

async function exists(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

async function copyWasm() {
  const files = await readdir(wasmSrc);
  await Promise.all(
    files.map((f) => copyFile(join(wasmSrc, f), join(outDir, f)))
  );
  return files.length;
}

async function fetchModel() {
  const dest = join(outDir, MODEL_FILE);
  const cached = await exists(dest);
  if (cached >= MODEL_MIN_BYTES) return `cached (${mb(cached)})`;

  const res = await fetch(MODEL_URL);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));

  const size = await exists(dest);
  if (size < MODEL_MIN_BYTES) throw new Error(`truncated at ${mb(size)}`);
  return mb(size);
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const count = await copyWasm();
  console.log(`pose: copied ${count} wasm files`);
  const model = await fetchModel();
  console.log(`pose: model ${model}`);
}

main().catch((e) => {
  console.warn(
    `pose: assets unavailable (${e.message}). Voice + Video will report ` +
      `itself as unavailable; the audio loop is unaffected.`
  );
  process.exit(0);
});
