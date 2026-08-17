/**
 * Cross-rep insights — patterns a single rep can't show. Every insight
 * is derived arithmetic over stored reps: no LLM, no guessing, and each
 * one carries the numbers it was computed from so the user can check it
 * (vision.md: no horoscope feedback).
 */

import type { RepRow } from "./client-data";

export interface Insight {
  id: string;
  headline: string;
  detail: string;
}

function fpm(r: RepRow): number {
  return r.duration_s > 0 ? r.filler_count / (r.duration_s / 60) : 0;
}

function heldPauses(r: RepRow): number {
  return (r.pauses ?? []).filter((p) => p.kind !== "beat").length;
}

function mean(ns: number[]): number {
  return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0;
}

/** Which filler dominates across the whole history. */
export function fillerTally(reps: RepRow[]): [string, number][] {
  const tally: Record<string, number> = {};
  for (const r of reps) {
    for (const f of r.fillers ?? []) {
      tally[f.word] = (tally[f.word] ?? 0) + 1;
    }
  }
  return Object.entries(tally).sort((a, b) => b[1] - a[1]);
}

/**
 * Where in a rep the fillers cluster, as five buckets across the
 * duration. Openings are the usual hotspot — worth showing rather than
 * telling.
 */
export function fillerHeatmap(reps: RepRow[], buckets = 5): number[] {
  const out = new Array(buckets).fill(0);
  for (const r of reps) {
    if (r.duration_s <= 0) continue;
    for (const f of r.fillers ?? []) {
      const idx = Math.min(
        buckets - 1,
        Math.floor((f.t / r.duration_s) * buckets)
      );
      out[idx]++;
    }
  }
  return out;
}

/** Best hour of day by filler rate, once there's enough spread. */
export function bestHour(reps: RepRow[]): { hour: number; fpm: number } | null {
  if (reps.length < 6) return null;
  const byHour: Record<number, number[]> = {};
  for (const r of reps) {
    const h = new Date(r.created_at).getHours();
    (byHour[h] ??= []).push(fpm(r));
  }
  const hours = Object.entries(byHour).filter(([, v]) => v.length >= 2);
  if (hours.length < 2) return null;
  const ranked = hours
    .map(([h, v]) => ({ hour: Number(h), fpm: mean(v) }))
    .sort((a, b) => a.fpm - b.fpm);
  return ranked[0];
}

export function insights(reps: RepRow[]): Insight[] {
  const out: Insight[] = [];
  if (reps.length < 3) return out;

  const recent = reps.slice(-5);
  const earlier = reps.slice(0, -5);

  // 1. Dominant filler
  const tally = fillerTally(reps);
  if (tally.length > 0) {
    const [word, count] = tally[0];
    const total = tally.reduce((a, [, n]) => a + n, 0);
    const share = Math.round((count / total) * 100);
    if (share >= 30) {
      out.push({
        id: "dominant-filler",
        headline: `"${word}" is ${share}% of your fillers`,
        detail: `${count} of ${total} across ${reps.length} reps. Killing one word moves the number more than trimming five.`,
      });
    }
  }

  // 2. Where they cluster
  const heat = fillerHeatmap(reps);
  const heatTotal = heat.reduce((a, b) => a + b, 0);
  if (heatTotal >= 8) {
    const peak = heat.indexOf(Math.max(...heat));
    const share = Math.round((heat[peak] / heatTotal) * 100);
    const where =
      peak === 0
        ? "the first twenty per cent"
        : peak === heat.length - 1
          ? "the last twenty per cent"
          : `the middle stretch`;
    if (share >= 30) {
      out.push({
        id: "filler-cluster",
        headline: `Most fillers land in ${where} of a rep`,
        detail: `${share}% of them. ${peak === 0 ? "Openings are where you are still finding the sentence. Plan the first line before you record." : "Worth knowing where the wobble sits."}`,
      });
    }
  }

  // 3. Pace trend
  if (earlier.length >= 2) {
    const a = mean(earlier.map((r) => r.wpm));
    const b = mean(recent.map((r) => r.wpm));
    const inZone = (n: number) => n >= 130 && n <= 160;
    if (!inZone(a) && inZone(b)) {
      out.push({
        id: "pace-fixed",
        headline: "Your pace moved into the zone",
        detail: `${Math.round(a)} wpm early on, ${Math.round(b)} across your last ${recent.length}. 130–160 is where a listener can keep up without you dragging.`,
      });
    } else if (b > 170) {
      out.push({
        id: "pace-fast",
        headline: "You're sprinting",
        detail: `${Math.round(b)} wpm across your last ${recent.length} reps. Above 160 the words arrive faster than the point does.`,
      });
    }
  }

  // 4. Silence
  const heldRecent = mean(recent.map(heldPauses));
  const heldEarly = earlier.length ? mean(earlier.map(heldPauses)) : 0;
  if (earlier.length >= 2 && heldRecent >= heldEarly + 1) {
    out.push({
      id: "silence-up",
      headline: "You're holding more silence",
      detail: `${heldEarly.toFixed(1)} held pauses a rep early on, ${heldRecent.toFixed(1)} now. That's the hardest habit on the list and it's moving.`,
    });
  }

  // 5. Best time of day
  const best = bestHour(reps);
  if (best) {
    const label = `${String(best.hour).padStart(2, "0")}:00`;
    out.push({
      id: "best-hour",
      headline: `You speak cleanest around ${label}`,
      detail: `${best.fpm.toFixed(1)} fillers a minute in that window, your lowest. Worth putting the rep there.`,
    });
  }

  // 6. Consistency
  if (reps.length >= 5) {
    const rates = reps.map(fpm);
    const m = mean(rates);
    const sd = Math.sqrt(mean(rates.map((r) => (r - m) ** 2)));
    if (sd < 1 && m < 4) {
      out.push({
        id: "consistent",
        headline: "Your floor is rising, not just your best day",
        detail: `Fillers stay within ${sd.toFixed(1)}/min of ${m.toFixed(1)} across every rep. Consistency is the part that survives pressure.`,
      });
    }
  }

  return out;
}
