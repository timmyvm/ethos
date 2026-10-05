"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { AudioScrubber } from "@/components/AudioScrubber";
import { Paywall, type PaywallAsk } from "@/components/Paywall";
import { PresenceDetail, PresenceScore } from "@/components/PresenceCard";
import { RepResult, type ResultView } from "@/components/RepResult";
import { TraitChip } from "@/components/TraitChip";
import { Disclosure } from "@/components/ui/Disclosure";
import { ErrorState } from "@/components/ui/ErrorState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { lessonById } from "@/content/lessons";
import {
  fetchProfile,
  fetchRep,
  repAudioUrl,
  type RepRow,
} from "@/lib/client-data";
import { parsePracticeId } from "@/lib/lesson-progress";
import { readable, readFailure } from "@/lib/load";
import { recordingName, recordingTrait } from "@/lib/log";
import { computeMetrics, substance } from "@/lib/metrics";
import { fromRow } from "@/lib/presence";
import { topicFromLessonId } from "@/lib/rep-config";
import { modById } from "@/lib/stress-mods";

/** Where back goes, on every state of this screen. */
const BACK = { href: "/history", label: "Log" };
/** The date line's height with no date to print, so the title holds
    one y from the skeleton to whichever state replaces it. */
const HELD = "\u00a0";

/** What the read settles to: the row (or null for none) and its audio. */
interface Stored {
  rep: RepRow | null;
  audio: string | null;
}

/**
 * The playback link, asked for inside the same read so the page lands
 * once: a player arriving after the page would swap the numbers'
 * static filler chips for itself (RepResult's hasPlayer) a beat after
 * the reader started on them. A link that fails is no player, never a
 * failed page: the recording is still all here.
 */
async function readStored(id: string): Promise<Stored> {
  const rep = await fetchRep(id);
  const audio = rep?.audio_path
    ? await repAudioUrl(rep.audio_path).catch(() => null)
    : null;
  return { rep, audio };
}

/** One recording from the log, rebuilt from its stored row. */
export default function RepDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [stored, setStored] = useState<Stored | null>(null);
  const [failed, setFailed] = useState(false);
  const [premium, setPremium] = useState(false);
  const [paywall, setPaywall] = useState<PaywallAsk | null>(null);

  /*
   * log-12: a failed read and a missing row are different screens. The
   * catch used to send both to "Recording not found.", which tells
   * someone on a dead connection that the recording is gone. Through
   * `readable`, the 8s ceiling applies too, so a read that never
   * answers ends in the retry instead of a shimmer.
   */
  const load = useCallback(async () => {
    setFailed(false);
    setStored(null);
    const read = await readable(() => readStored(id));
    if (read.ok) setStored(read.data);
    else setFailed(true);
  }, [id]);

  useEffect(() => {
    void load();
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => {});
  }, [load]);

  if (failed) {
    return (
      <main className="px-5 pb-8 pt-7">
        <ScreenHeader title="Recording" eyebrow={HELD} back={BACK} />
        <ErrorState
          className="mt-4"
          {...readFailure("This recording")}
          onRetry={() => void load()}
        />
      </main>
    );
  }

  if (stored === null) {
    return (
      <main className="px-5 pb-8 pt-7">
        {/* The header is drawn for real, so the way back works while
            the read is in flight; only the date waits. "Recording" is
            what every recording is until its row says which. */}
        <ScreenHeader
          title="Recording"
          back={BACK}
          eyebrow={
            <span className="block py-1">
              <Skeleton className="h-3 w-36" />
            </span>
          }
        />
        <RecordingSkeleton />
      </main>
    );
  }

  const { rep, audio } = stored;

  if (!rep) {
    return (
      <main className="px-5 pb-8 pt-7">
        <ScreenHeader title="Recording" eyebrow={HELD} back={BACK} />
        <p className="font-display mt-4 text-row">Recording not found.</p>
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
    // Length and variety, from the stored words: the row has no word
    // count column and the screen printed "0 words" over the transcript.
    substance: substance(rep.transcript),
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

  const date = new Date(rep.created_at).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const topic = topicFromLessonId(rep.lesson_id);
  const delivery = fromRow(rep.delivery_metrics);
  const trait = recordingTrait(rep);
  const mods = rep.mods ?? [];
  // M27: a lesson's practice says which lesson, and opens it.
  const practice = parsePracticeId(rep.lesson_id);
  const lesson = practice ? lessonById(practice.lessonId) : null;

  return (
    <main className="px-5 pb-8 pt-7">
      {/* log-3: the screen names the recording the Log row named, with
          the date over it, and its way back stays in the bar from the
          transcript down. One idea per eyebrow: a boss says so after a
          comma, never a middot. */}
      <ScreenHeader
        eyebrow={rep.mode === "boss" ? `${date}, boss` : date}
        title={recordingName(rep)}
        back={BACK}
      />

      {/* The trait it practised (M11) and what made it harder, as the
          chips they are, one height in one row. A recording that
          practised no one trait wears no colour. */}
      {(trait || mods.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {trait && <TraitChip trait={trait} size="sm" />}
          {mods.map((m) => (
            <span
              key={m}
              className="font-display inline-flex h-[22px] items-center rounded-full bg-surface px-2 text-caption font-bold leading-none text-ink"
            >
              {modById(m)?.name ?? m}
            </span>
          ))}
          {mods.length > 0 && (
            <span className="ml-0.5 text-caption font-semibold text-stone-500">
              ×{rep.xp_multiplier} XP
            </span>
          )}
        </div>
      )}

      {/* The lesson it belongs to, one bare row with no card (Imprint's
          lesson sheet, "Featured in"): the art at 40, the lesson over
          the practice, the row's chevron. A plain <img>: the service
          worker caches /lessons/*.webp and could not cache next/image's
          resized URLs (#274). */}
      {lesson && practice && (
        <Link
          href={`/lessons/${lesson.id}`}
          className="press-row -mx-2 mt-3 flex min-h-11 items-center gap-3.5 rounded-control px-2 py-1.5"
        >
          <img
            src={lesson.art}
            alt=""
            width={40}
            height={40}
            decoding="async"
            className="size-10 shrink-0 rounded-[8px] bg-sand object-cover"
          />
          <span className="min-w-0 flex-1">
            <span className="font-display block truncate text-row">
              {lesson.title}
            </span>
            <span className="block text-caption text-stone-500">
              Practice {practice.practice} of {lesson.practices.length}
            </span>
          </span>
          <Disclosure />
        </Link>
      )}

      <RepResult
        result={view}
        topic={topic}
        player={
          audio ? (
            <AudioScrubber
              src={audio}
              durationS={rep.duration_s}
              fillers={rep.fillers ?? []}
              pauses={rep.pauses ?? []}
            />
          ) : undefined
        }
        hasPlayer={!!audio}
      />

      {/*
       * Presence, if this recording was made on camera. There is no
       * playback here and there never will be: the clip existed in the
       * tab that recorded it and nowhere else. What survives is the five
       * numbers and the timestamps.
       */}
      {delivery && (
        <div className="mt-7 border-t border-hairline pt-4">
          <PresenceScore
            score={delivery.presenceScore}
            previous={null}
            premium={premium}
            onUpgrade={() =>
              setPaywall({
                reason: "Presence · premium",
                headline: "See what the camera measured.",
              })
            }
          />
          <PresenceDetail
            metrics={delivery}
            moments={rep.delivery_moments ?? []}
            premium={premium}
            videoUrl={null}
            onUpgrade={() =>
              setPaywall({
                reason: "Delivery readout · premium",
                headline: "See what the camera measured.",
              })
            }
          />
        </div>
      )}

      {paywall && (
        <Paywall
          reason={paywall.reason}
          headline={paywall.headline}
          onClose={() => setPaywall(null)}
        />
      )}
    </main>
  );
}

/**
 * The stored recording while its row is in flight, shaped to what
 * replaces it (PRINCIPLES 8): the trait chip, the 56px hero with its
 * label and stars, Demos at 112 beside his bubble, the pause card, the
 * dimensions head and card, and the three stats as ONE card in three
 * columns (log-7), the way RepResult draws them now.
 */
function RecordingSkeleton() {
  return (
    <SkeletonRegion label="Loading this recording">
      <Skeleton className="mt-2 h-[22px] w-16" rounded="rounded-full" />
      <div className="mt-5 flex items-center gap-3.5">
        <Skeleton className="h-14 w-28" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="ml-auto h-5 w-[74px]" />
      </div>
      <Line className="mt-2 text-caption" width="w-32" />
      <div className="mt-7 flex items-start gap-3">
        <Skeleton className="size-28 shrink-0" rounded="rounded-full" />
        <Skeleton className="h-20 flex-1" rounded="rounded-card" />
      </div>
      <Skeleton className="mt-7 h-36 w-full" rounded="rounded-card" />
      <Line className="section-head mt-7" width="w-44" />
      {/* Nine measured rows and the sum, at DimensionList's height. */}
      <Skeleton className="mt-3 h-[499px] w-full" rounded="rounded-card" />
      <div className="card mt-3 grid grid-cols-3 divide-x divide-hairline">
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-3 py-4">
            <Line className="label-micro" width="w-12" />
            <Line className="font-display mt-1.5 text-num-m" width="w-10" />
            <Line className="mt-1 text-caption" width="w-16" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/**
 * One line of type at its role's own height, the words invisible and a
 * bar where they would be, so the line that replaces it is the same
 * height to the pixel (the Log's score card skeleton does the same).
 */
function Line({ className, width }: { className: string; width: string }) {
  return (
    <div className={`relative ${className}`}>
      <span className="invisible">Ag</span>
      <Skeleton className={`absolute inset-y-[22%] left-0 ${width}`} />
    </div>
  );
}
