"use client";

import { useRef, useState } from "react";
import type { RepRow } from "@/lib/client-data";
import { ACTION_CLASS } from "@/lib/ui";

/** Fillers a minute, or `null` when a recording has no length to divide by. */
const fpm = (r: RepRow): number | null =>
  r.duration_s > 0 ? r.filler_count / (r.duration_s / 60) : null;

/**
 * Day 1 vs now (you-11, M23): your first recording beside your latest,
 * as two numbers you can read before you press anything, then the tap
 * that turns them into a picture to post.
 *
 * vision.md principle 4: the retention asset and the marketing asset
 * are the same artifact, so the picture exports at story size,
 * brand-correct, with no scoreboard bragging, just the numbers and the
 * days. Canvas-drawn (no html2canvas): fewer deps, exact control, and it
 * works offline in the PWA.
 *
 * It carries no outer margin; the parent places it (STATE). `quiet`
 * steps the button down to the surface door when something else on the
 * screen holds the one terracotta tap.
 */
export function ShareCard({ reps, quiet = false }: { reps: RepRow[]; quiet?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const busy = useRef(false);

  if (reps.length < 2) return null;

  const first = reps[0];
  const last = reps[reps.length - 1];
  const was = fpm(first);
  const now = fpm(last);

  async function draw() {
    if (busy.current) return;
    busy.current = true;
    try {
      const days =
        Math.round(
          (new Date(last.created_at).getTime() -
            new Date(first.created_at).getTime()) /
            86_400_000
        ) + 1;
      const W = 1080;
      const H = 1920;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g = c.getContext("2d");
      if (!g) return;

      // Paper ground, brand.md: no pure white, no pure black.
      //
      // Literal, and staying literal: this canvas leaves the app. A
      // shared image is a piece of Ethos in someone else's feed, so it
      // wears the brand's light palette whatever theme the phone that
      // made it was in (Checkpoint 1, finding 3, deliberate). The
      // values are the Instrument set (#201).
      const face =
        getComputedStyle(document.body)
          .getPropertyValue("--font-display-face")
          .trim() || "Outfit";
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, W, H);

      g.fillStyle = "#201e1d";
      g.font = `800 64px ${face}, sans-serif`;
      g.fillText("ETHOS", 90, 200);

      g.fillStyle = "#75706a";
      g.font = "700 38px Figtree, sans-serif";
      g.fillText(`DAY 1  →  DAY ${days}`, 90, 300);

      // The two numbers, big. A row whose first or last reading is
      // missing is left out rather than drawn as a zero.
      const rows: [string, string, string, boolean][] = [];
      if (was !== null && now !== null) {
        rows.push(["Fillers / min", was.toFixed(1), now.toFixed(1), now < was]);
      }
      rows.push(
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
        ]
      );
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
      g.fillText(`${reps.length} RECORDINGS, EVERY NUMBER MEASURED`, 90, H - 140);

      g.fillStyle = "#c67139";
      g.fillRect(90, H - 100, 120, 8);

      setUrl(c.toDataURL("image/png"));
    } finally {
      busy.current = false;
    }
  }

  const tap = quiet
    ? "press font-display block min-h-12 w-full rounded-control bg-surface px-6 py-3.5 text-center text-body font-bold"
    : ACTION_CLASS;

  return (
    <section className="card p-5">
      <h2 className="detail-head">Day 1 vs now</h2>
      <p className="mt-0.5 text-caption text-stone-500">Fillers a minute</p>
      {/* Then and now, side by side: the first reading in stone, the
          latest in ink. A recording with no length has no rate, so it
          shows a dash, never a 0. */}
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {/* The term reads first and sits under its number
            (column-reverse), the way the stats on the card above do. */}
        <div className="flex flex-col-reverse">
          <dt className="mt-1 text-caption text-stone-500">Day 1</dt>
          <dd className="font-display text-num-m tabular-nums text-stone-500">
            {was === null ? "–" : was.toFixed(1)}
          </dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt className="mt-1 text-caption text-stone-500">Now</dt>
          <dd className="font-display text-num-m tabular-nums">
            {now === null ? "–" : now.toFixed(1)}
          </dd>
        </div>
      </dl>
      {url ? (
        /* The card the tap produced: it arrives in place of the button
           it replaced, rather than cutting in when the canvas finishes. */
        <div className="arrive mt-5">
          {/* The story ratio, stated: the canvas is 1080x1920 and a data
              URL has no intrinsic size until it decodes, so without this
              the picture arrives at one height and grows to another
              mid-animation. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Your progress card"
            width={1080}
            height={1920}
            className="aspect-[1080/1920] w-full rounded-control border border-card-edge"
          />
          <a href={url} download="ethos-progress.png" className={`${tap} mt-3`}>
            Save the card
          </a>
        </div>
      ) : (
        <button type="button" onClick={draw} className={`${tap} mt-5`}>
          Make the card
        </button>
      )}
    </section>
  );
}
