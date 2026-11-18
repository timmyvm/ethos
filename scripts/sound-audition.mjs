/**
 * The sound kit's ears (#505). Nobody building Ethos can hear a phone
 * from here, so every sound is rendered the way a phone would make it:
 * the kit itself (lib/sound.ts, lib/sound-recipes.ts), bundled, run in
 * Chromium's own Web Audio through an OfflineAudioContext, master chain
 * and limiter included. Then measured, and written where Timothy can
 * play it:
 *
 *   docs/sound-audition/index.html    every sound and every moment's
 *                                     sequence, a Play button each
 *   docs/sound-audition/*.mp3         the renders, 96 kbps
 *   docs/sound-audition/report.json   length, sample peak, true peak,
 *                                     loudness (EBU R128) and file size
 *
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/sound-audition.mjs [outDir]
 *
 * Needs ffmpeg for the loudness and the MP3s. Exits non-zero when any
 * render's sample peak passes -1 dBFS, or its true peak passes -0.5.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(new URL("..", import.meta.url).pathname);
const out = resolve(process.argv[2] ?? join(root, "docs/sound-audition"));
mkdirSync(out, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "ethos-sound-"));
const RATE = 44_100;

/* The kit, as the browser gets it, with what the page needs to render a moment. */
const entry = `
import { renderRecipe, master } from "./lib/sound";
import { recipe, recipeLength, glanceCues, countTicks, RECIPES } from "./lib/sound-recipes";
window.EthosSound = { renderRecipe, master, recipe, recipeLength, glanceCues, countTicks, ids: [...Object.keys(RECIPES), "tick"] };
`;
const bundle = await build({
  stdin: { contents: entry, resolveDir: root, loader: "ts" },
  bundle: true,
  format: "iife",
  write: false,
  platform: "browser",
  target: "es2020",
  logLevel: "silent",
});
const kitJs = bundle.outputFiles[0].text;

/* The glance's clock as RepResult runs it: the count (600), then the stars 120 apart. */
const CLOCK = { landAfter: 600, starStep: 120, starMs: 300, reduced: false };

/** Every render: a sound alone, or a moment's sequence of cues. */
const SOLO = [
  ["star-1", "One star: a real answer"],
  ["star-2", "Second star"],
  ["star-3", "Third star"],
  ["payout", "Three stars: the payout"],
  ["lesson", "A lesson done"],
  ["level", "A level reached"],
  ["best", "A personal best"],
  ["round", "A round won (a game, or Hostile's claim held)"],
  ["boss", "The week's boss done"],
  ["streak", "The streak: the flame lights, the count rolls"],
  ["streak-milestone", "The streak at 7, 14 or 30 days"],
  ["tick", "One XP tick"],
];
const MOMENTS = [
  ["glance-1", "The results: one star", { stars: 1 }],
  ["glance-2", "The results: two stars", { stars: 2 }],
  ["glance-3", "The results: three stars, paid out", { stars: 3 }],
  ["glance-2-lesson", "A lesson's last practice, two stars", { stars: 2, lessonDone: true }],
  ["glance-3-lesson", "A lesson's last practice, three stars", { stars: 3, lessonDone: true }],
  ["glance-2-best", "A personal best, two stars", { stars: 2, best: true }],
  ["glance-3-boss", "The week's boss, three stars", { stars: 3, boss: true }],
  ["glance-2-level", "A level reached, two stars", { stars: 2, level: true }],
  ["xp-10", "XP today counting up by 10", "xp"],
];

const pw = await import(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const chromium = pw.chromium ?? pw.default?.chromium;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><title>render</title>");
await page.addScriptTag({ content: kitJs });

/** Render cues offline in the page; returns the stereo samples as base64 Int16 and the float peak. */
async function render(cues) {
  return page.evaluate(
    async ({ cues, RATE }) => {
      const K = window.EthosSound;
      /* Four seconds of silence first: the limiter starts clamped and
         takes a moment to let go, which a live context has long done by
         the time a take earns anything (the kit builds it in the tap). */
      const PRE = 4;
      const end = PRE + Math.max(...cues.map((c) => c.atMs / 1000 + K.recipeLength(K.recipe(c.sound, c.step ?? 0)))) + 0.4;
      const ctx = new OfflineAudioContext(2, Math.ceil(end * RATE), RATE);
      K.master(ctx);
      for (const c of cues) K.renderRecipe(ctx, K.recipe(c.sound, c.step ?? 0), PRE + 0.02 + c.atMs / 1000);
      const buf = await ctx.startRendering();
      const L = buf.getChannelData(0).subarray(PRE * RATE);
      const R = buf.getChannelData(1).subarray(PRE * RATE);
      let peak = 0;
      const pcm = new Int16Array(L.length * 2);
      for (let i = 0; i < L.length; i++) {
        peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
        pcm[i * 2] = Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767)));
        pcm[i * 2 + 1] = Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767)));
      }
      let s = "";
      const bytes = new Uint8Array(pcm.buffer);
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { b64: btoa(s), peak, seconds: L.length / RATE };
    },
    { cues, RATE }
  );
}

function wav(pcm) {
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(2, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 4, 28);
  head.writeUInt16LE(4, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

/** EBU R128 integrated loudness and true peak, from ffmpeg. */
function loudnessOf(file) {
  let text = "";
  try {
    text = execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats -i "${file}" -af ebur128=peak=true -f null - 2>&1`], { encoding: "utf8" });
  } catch (e) {
    text = String(e.stdout ?? "");
  }
  const summary = text.slice(text.lastIndexOf("Summary:"));
  const lufs = Number(/I:\s+(-?[\d.]+|-inf) LUFS/.exec(summary)?.[1] ?? NaN);
  const tp = Number(/Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(summary)?.[1] ?? NaN);
  return { lufs, truePeak: tp };
}

const db = (x) => (x > 0 ? Math.round(20 * Math.log10(x) * 10) / 10 : -Infinity);
const report = [];
let failed = false;

async function take(id, label, cues) {
  const r = await render(cues);
  const pcm = Buffer.from(r.b64, "base64");
  const wavFile = join(scratch, `${id}.wav`);
  writeFileSync(wavFile, wav(pcm));
  const { lufs, truePeak } = loudnessOf(wavFile);
  const mp3 = join(out, `${id}.mp3`);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", wavFile, "-codec:a", "libmp3lame", "-b:a", "96k", mp3]);
  const row = {
    id,
    label,
    seconds: Math.round(r.seconds * 100) / 100,
    peakDbfs: db(r.peak),
    truePeakDbfs: truePeak,
    lufs,
    bytes: statSync(mp3).size,
    cues: cues.map((c) => `${c.sound}${c.step ? `#${c.step}` : ""}@${c.atMs}`).join(" "),
  };
  if (!(row.peakDbfs <= -1) || !(truePeak <= -0.5)) failed = true;
  report.push(row);
  console.log(
    `${id.padEnd(18)} ${String(row.seconds).padStart(5)}s  peak ${String(row.peakDbfs).padStart(6)} dBFS  true ${String(truePeak).padStart(6)}  ${String(lufs).padStart(6)} LUFS  ${String(Math.round(row.bytes / 1024)).padStart(3)} KB`
  );
}

for (const [id, label] of SOLO) await take(id, label, [{ sound: id, atMs: 0, slot: id }]);
for (const [id, label, win] of MOMENTS) {
  const cues =
    win === "xp"
      ? await page.evaluate(() => window.EthosSound.countTicks(25.4, 31, 300))
      : await page.evaluate(([w, c]) => window.EthosSound.glanceCues(w, c), [win, CLOCK]);
  await take(id, label, cues);
}
await browser.close();

writeFileSync(join(out, "report.json"), JSON.stringify({ rate: RATE, rendered: "Chromium OfflineAudioContext, the kit's own master chain", sounds: report }, null, 2) + "\n");

/* The page: plain, light and dark, one Play per render, its numbers beside it. */
const rows = (list) =>
  list
    .map(
      (r) => `      <li>
        <button type="button" data-src="${r.id}.mp3"><span aria-hidden="true">▶</span> Play</button>
        <div><b>${r.label}</b><small>${r.seconds}s · peak ${r.peakDbfs} dBFS · ${Number.isFinite(r.lufs) ? r.lufs : "–"} LUFS · ${Math.round(r.bytes / 1024)} KB</small></div>
      </li>`
    )
    .join("\n");
const solo = report.filter((r) => SOLO.some(([id]) => id === r.id));
const moments = report.filter((r) => MOMENTS.some(([id]) => id === r.id));
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ethos sound audition</title>
<style>
  :root { --ground: #ffffff; --surface: #f4f4f4; --ink: #17140f; --muted: #6b6560; --edge: rgba(0,0,0,.09); color-scheme: light dark; }
  @media (prefers-color-scheme: dark) { :root { --ground: #121212; --surface: #1c1c1c; --ink: #f2f2f2; --muted: #a8a29e; --edge: rgba(255,255,255,.12); } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--ground); color: var(--ink); font: 15px/1.4 system-ui, -apple-system, sans-serif; }
  main { max-width: 560px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: -0.012em; }
  h2 { font-size: 17px; margin: 28px 0 8px; }
  p { color: var(--muted); margin: 0; }
  ul { list-style: none; margin: 0; padding: 0; border-radius: 16px; background: var(--surface); overflow: hidden; }
  li { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-top: 1px solid var(--edge); }
  li:first-child { border-top: 0; }
  li div { display: flex; flex-direction: column; min-width: 0; }
  small { color: var(--muted); font-size: 13px; }
  button { flex: none; min-width: 76px; height: 44px; border: 0; border-radius: 999px; background: var(--ink); color: var(--ground); font: 600 15px system-ui, sans-serif; cursor: pointer; }
  button[aria-pressed="true"] { opacity: .6; }
</style>
</head>
<body>
<main>
  <h1>Ethos sounds</h1>
  <p>Every sound the app makes, rendered by the app's own kit. Turn the silent switch off to hear them on an iPhone.</p>
  <h2>The moments, as the results play them</h2>
  <ul>
${rows(moments)}
  </ul>
  <h2>Each sound alone</h2>
  <ul>
${rows(solo)}
  </ul>
</main>
<script>
  const player = new Audio();
  let lit = null;
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-src]");
    if (!b) return;
    player.pause();
    player.src = b.dataset.src;
    player.currentTime = 0;
    player.play();
    if (lit) lit.removeAttribute("aria-pressed");
    lit = b;
    b.setAttribute("aria-pressed", "true");
  });
  player.addEventListener("ended", () => lit && lit.removeAttribute("aria-pressed"));
</script>
</body>
</html>
`;
writeFileSync(join(out, "index.html"), html);
console.log(`\n${report.length} renders in ${out}`);
if (failed) {
  console.error("A render passes the ceiling: sample peak over -1 dBFS or true peak over -0.5 dBFS.");
  process.exit(1);
}
