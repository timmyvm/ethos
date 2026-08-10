"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AudioScrubber } from "@/components/AudioScrubber";
import { RepResult, type ResultView } from "@/components/RepResult";
import { fetchRep, repAudioUrl, type RepRow } from "@/lib/client-data";
import { computeMetrics } from "@/lib/metrics";
import { topicFromLessonId } from "@/lib/rep-config";
import { modById } from "@/lib/stress-mods";

/** One rep from the log, rebuilt from its stored row. */
export default function RepDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [rep, setRep] = useState<RepRow | null | undefined>(undefined);
  const [audio, setAudio] = useState<string | null>(null);

  useEffect(() => {
    fetchRep(id)
      .then((r) => {
        setRep(r);
        if (r?.audio_path) repAudioUrl(r.audio_path).then(setAudio).catch(() => {});
      })
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
    accuracy: rep.accuracy,
  };

  const d = new Date(rep.created_at);
  const topic = topicFromLessonId(rep.lesson_id);

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
        {rep.mode === "boss" && " · boss"}
      </div>
      {rep.mods?.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {rep.mods.map((id) => (
            <span
              key={id}
              className="rounded-full bg-stone-900 px-2.5 py-1 text-[11.5px] font-semibold text-cream"
            >
              {modById(id)?.name ?? id}
            </span>
          ))}
          <span className="label-data">×{rep.xp_multiplier} XP</span>
        </div>
      )}
      <RepResult result={view} topic={topic} />
      {audio && (
        <div className="mt-4">
          <AudioScrubber
            src={audio}
            durationS={rep.duration_s}
            fillers={rep.fillers ?? []}
            pauses={rep.pauses ?? []}
          />
        </div>
      )}
    </main>
  );
}
