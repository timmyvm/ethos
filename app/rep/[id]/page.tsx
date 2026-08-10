"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { RepResult, type ResultView } from "@/components/RepResult";
import { fetchRep, type RepRow } from "@/lib/client-data";
import { computeMetrics } from "@/lib/metrics";

/** One rep from the log, rebuilt from its stored row. */
export default function RepDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [rep, setRep] = useState<RepRow | null | undefined>(undefined);

  useEffect(() => {
    fetchRep(id)
      .then(setRep)
      .catch(() => setRep(null));
  }, [id]);

  if (rep === undefined) {
    return (
      <main className="px-5 pb-24 pt-7">
        <p className="text-[13.5px] text-stone-500">Loading…</p>
      </main>
    );
  }

  if (!rep) {
    return (
      <main className="px-5 pb-24 pt-7">
        <Link href="/history" className="text-sm text-stone-500">
          ← the log
        </Link>
        <p className="mt-6 text-[14px] font-semibold">Rep not found.</p>
      </main>
    );
  }

  // Stored rows keep the derived fields; the metric shape is rebuilt
  // from what was saved rather than recomputed from audio.
  const metrics = {
    ...computeMetrics([], rep.duration_s),
    durationS: rep.duration_s,
    wpm: rep.wpm,
    fillerCount: rep.filler_count,
    fillersPerMin:
      rep.duration_s > 0
        ? Math.round((rep.filler_count / (rep.duration_s / 60)) * 100) / 100
        : 0,
    fillers: rep.fillers ?? [],
    pauses: rep.pauses ?? [],
    heldPauses: (rep.pauses ?? []).filter((p) => p.kind !== "beat").length,
    composedPauses: (rep.pauses ?? []).filter((p) => p.kind === "pre").length,
    midSentencePauses: (rep.pauses ?? []).filter((p) => p.kind === "mid")
      .length,
    stars: rep.stars as 1 | 2 | 3,
  };

  const dims = rep.dimensions;
  const view: ResultView = {
    transcript: rep.transcript,
    metrics,
    tier1: dims?.tier1 ?? { pause: 0, fillers: 0, pace: 0, range: 0 },
    anchors: dims?.anchors ?? { hedgeCount: 0, restartCount: 0 },
    coach:
      rep.focus && rep.supply && dims?.tier2
        ? {
            focus: rep.focus,
            strength: rep.strength ?? "",
            supply: rep.supply,
            coachLine: "",
            dimensions: dims.tier2,
          }
        : null,
    ethosIndex: rep.ethos_index,
    previousIndex: null,
  };

  const d = new Date(rep.created_at);

  return (
    <main className="px-5 pb-24 pt-7">
      <Link href="/history" className="text-sm text-stone-500">
        ← the log
      </Link>
      <div className="label-data mt-4">
        {d.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </div>
      <RepResult result={view} />
    </main>
  );
}
