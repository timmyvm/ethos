"use client";

import { useRef, useState } from "react";
import type { RepRow } from "@/lib/client-data";

/**
 * The day-1-vs-day-N card, rendered to a PNG the user can post.
 * vision.md principle 4: the retention asset and the marketing asset
 * are the same artifact — so it exports at story size, brand-correct,
 * with no scoreboard bragging, just the two numbers and the days.
 *
 * Canvas-drawn (no html2canvas): fewer deps, exact control, and it
 * works offline in the PWA.
 */
export function ShareCard({ reps }: { reps: RepRow[] }) {
  const [url, setUrl] = useState<string | null>(null);
  const busy = useRef(false);

  if (reps.length < 2) return null;

  const first = reps[0];
  const last = reps[reps.length - 1];
  const days =
    Math.round(
      (new Date(last.created_at).getTime() -
        new Date(first.created_at).getTime()) /
        86_400_000
    ) + 1;
  const fpm = (r: RepRow) =>
    r.duration_s > 0 ? r.filler_count / (r.duration_s / 60) : 0;

  async function draw() {
    if (busy.current) return;
    busy.current = true;
    try {
      const W = 1080;
      const H = 1920;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g = c.getContext("2d");
      if (!g) return;

      // Cream ground, brand.md — no pure white, no pure black.
      //
      // Literal, and staying literal: this canvas leaves the app. A
      // shared image is a piece of Ethos in someone else's feed, so it
      // wears the brand's light palette whatever theme the phone that
      // made it was in (Checkpoint 1, finding 3 — deliberate).
      g.fillStyle = "#FAF7F2";
      g.fillRect(0, 0, W, H);

      g.fillStyle = "#292524";
      g.font = "700 64px 'Space Grotesk', sans-serif";
      g.fillText("ethos", 90, 200);

      g.fillStyle = "#78716C";
      g.font = "400 38px 'Space Mono', monospace";
      g.fillText(`DAY 1  →  DAY ${days}`, 90, 300);

      // The two numbers, big.
      const rows: [string, string, string, boolean][] = [
        [
          "Fillers / min",
          fpm(first).toFixed(1),
          fpm(last).toFixed(1),
          fpm(last) < fpm(first),
        ],
        [
          "Words / min",
          String(first.wpm),
          String(last.wpm),
          Math.abs(last.wpm - 145) < Math.abs(first.wpm - 145),
        ],
        [
          "Held pauses",
          String((first.pauses ?? []).filter((p) => p.kind !== "beat").length),
          String((last.pauses ?? []).filter((p) => p.kind !== "beat").length),
          true,
        ],
      ];
      if (first.ethos_index !== null && last.ethos_index !== null) {
        rows.unshift([
          "Your Ethos",
          String(first.ethos_index),
          String(last.ethos_index),
          last.ethos_index > first.ethos_index,
        ]);
      }

      let y = 480;
      for (const [label, a, b, better] of rows) {
        g.fillStyle = "#78716C";
        g.font = "400 34px 'Space Mono', monospace";
        g.fillText(label.toUpperCase(), 90, y);

        g.font = "700 110px 'Space Grotesk', sans-serif";
        g.fillStyle = "#D6D3D1";
        g.fillText(a, 90, y + 120);
        const aw = g.measureText(a).width;

        g.fillStyle = "#A8A29E";
        g.font = "400 60px 'Space Grotesk', sans-serif";
        g.fillText("→", 90 + aw + 40, y + 120);

        g.fillStyle = better ? "#F59E0B" : "#292524";
        g.font = "700 110px 'Space Grotesk', sans-serif";
        g.fillText(b, 90 + aw + 130, y + 120);

        y += 300;
      }

      // Footer: the honest line.
      g.fillStyle = "#78716C";
      g.font = "400 32px 'Space Mono', monospace";
      g.fillText(`${reps.length} RECORDINGS · EVERY NUMBER MEASURED`, 90, H - 140);

      g.fillStyle = "#E76F51";
      g.fillRect(90, H - 100, 120, 8);

      setUrl(c.toDataURL("image/png"));
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="mt-4">
      {url ? (
        <div className="rounded-[18px] border border-hairline bg-surface lift p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Your progress card" className="w-full rounded-xl" />
          <a
            href={url}
            download="ethos-progress.png"
            className="mt-3 block w-full rounded-[14px] bg-terracotta-500 px-6 py-3.5 text-center text-[15px] font-semibold text-cream"
          >
            Save the card
          </a>
        </div>
      ) : (
        <button
          onClick={draw}
          className="w-full rounded-[18px] border border-hairline bg-surface lift p-4 text-[13.5px] font-semibold"
        >
          Make a shareable card →
        </button>
      )}
    </div>
  );
}
