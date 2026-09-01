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

      // Paper ground, brand.md — no pure white, no pure black.
      //
      // Literal, and staying literal: this canvas leaves the app. A
      // shared image is a piece of Ethos in someone else's feed, so it
      // wears the brand's light palette whatever theme the phone that
      // made it was in (Checkpoint 1, finding 3 — deliberate). The
      // values are the Instrument set (#201).
      const face =
        getComputedStyle(document.body)
          .getPropertyValue("--font-display-face")
          .trim() || "Outfit";
      g.fillStyle = "#f5ead8";
      g.fillRect(0, 0, W, H);

      g.fillStyle = "#201e1d";
      g.font = `800 64px ${face}, sans-serif`;
      g.fillText("ETHOS", 90, 200);

      g.fillStyle = "#75706a";
      g.font = "700 38px Figtree, sans-serif";
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
        g.fillStyle = "#75706a";
        g.font = "700 34px Figtree, sans-serif";
        g.fillText(label.toUpperCase(), 90, y);

        g.font = `800 110px ${face}, sans-serif`;
        g.fillStyle = "#b7ae9f";
        g.fillText(a, 90, y + 120);
        const aw = g.measureText(a).width;

        g.fillStyle = "#a49a8b";
        g.font = "400 60px Figtree, sans-serif";
        g.fillText("→", 90 + aw + 40, y + 120);

        // Sage = earned, on the card exactly as in the app (#165).
        g.fillStyle = better ? "#7a8a5e" : "#201e1d";
        g.font = `800 110px ${face}, sans-serif`;
        g.fillText(b, 90 + aw + 130, y + 120);

        y += 300;
      }

      // Footer: the honest line.
      g.fillStyle = "#75706a";
      g.font = "700 32px Figtree, sans-serif";
      g.fillText(`${reps.length} RECORDINGS · EVERY NUMBER MEASURED`, 90, H - 140);

      g.fillStyle = "#c67139";
      g.fillRect(90, H - 100, 120, 8);

      setUrl(c.toDataURL("image/png"));
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="mt-4">
      {url ? (
        <div className="rounded-[14px] border border-edge p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Your progress card" className="w-full rounded-[10px]" />
          <a
            href={url}
            download="ethos-progress.png"
            className="press font-display mt-3 block w-full rounded-xl bg-terracotta-500 px-6 py-3 text-center text-[15px] font-bold text-cream"
          >
            Save the card
          </a>
        </div>
      ) : (
        <button
          onClick={draw}
          className="press font-display w-full rounded-[10px] border border-stone-200 px-4 py-[11px] text-[13.5px] font-bold"
        >
          Make a shareable card →
        </button>
      )}
    </div>
  );
}
