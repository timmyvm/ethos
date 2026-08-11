"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AudioScrubber } from "@/components/AudioScrubber";
import { Paywall } from "@/components/Paywall";
import { PresenceDetail, PresenceScore } from "@/components/PresenceCard";
import { RepResult, type ResultView } from "@/components/RepResult";
import {
  Skeleton,
  SkeletonRegion,
  SkeletonStat,
} from "@/components/Skeleton";
import {
  fetchProfile,
  fetchRep,
  repAudioUrl,
  type RepRow,
} from "@/lib/client-data";
import { computeMetrics } from "@/lib/metrics";
import { fromRow } from "@/lib/presence";
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
  const [premium, setPremium] = useState(false);
  const [paywall, setPaywall] = useState<string | null>(null);

  useEffect(() => {
    fetchRep(id)
      .then((r) => {
        setRep(r);
        if (r?.audio_path) repAudioUrl(r.audio_path).then(setAudio).catch(() => {});
      })
      .catch(() => setRep(null));
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => {});
  }, [id]);

  if (rep === undefined) {
    return (
      <main className="px-5 pb-24 pt-7">
        <Skeleton className="h-3 w-16" />
        <SkeletonRegion label="Loading this rep" className="mt-4">
          <Skeleton className="h-2.5 w-40" />
          <div className="mt-3 flex items-baseline gap-3.5">
            <Skeleton className="h-14 w-28" />
            <div className="flex-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-3 w-20" />
            </div>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <Skeleton className="h-[62px] w-[62px]" rounded="rounded-[14px]" />
            <Skeleton className="h-20 flex-1" rounded="rounded-[14px]" />
          </div>
          <Skeleton className="mt-4 h-24 w-full" rounded="rounded-2xl" />
          <div className="mt-4 flex gap-3">
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
          </div>
        </SkeletonRegion>
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
  const delivery = fromRow(rep.delivery_metrics);

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

      {/*
       * Presence, if this rep was recorded on camera. There is no
       * playback here and there never will be: the clip existed in the
       * tab that recorded it and nowhere else. What survives is the five
       * numbers and the timestamps.
       */}
      {delivery && (
        <div className="mt-6 border-t border-sand pt-5">
          <PresenceScore
            score={delivery.presenceScore}
            previous={null}
            premium={premium}
            onUpgrade={() => setPaywall("Presence · premium")}
          />
          <PresenceDetail
            metrics={delivery}
            moments={rep.delivery_moments ?? []}
            premium={premium}
            videoUrl={null}
            onUpgrade={() => setPaywall("Delivery readout · premium")}
          />
        </div>
      )}

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

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
    </main>
  );
}
