"use client";

import Link from "next/link";
import { useState } from "react";
import { AudioScrubber } from "@/components/AudioScrubber";
import { IconUpload } from "@/components/Icon";
import { RepResult } from "@/components/RepResult";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { ensureSession } from "@/lib/supabase-browser";
import { ACTION_CLASS } from "@/lib/ui";
import type { AnalyzeResponse } from "@/app/api/analyze/route";

/**
 * Upload-and-analyze (DECISIONS #185): a real meeting, a voice memo, a
 * run-through from the camera roll, through the exact engine every
 * recording gets. Real-stakes audio is the strongest mirror the product
 * can offer.
 *
 * The upload banks as a recording (lesson `upload`), so it counts as
 * today's practice. No loudness envelope exists for a file, and the
 * engine already scores that honestly (#122: absent evidence, not
 * guessed evidence).
 *
 * The pick step is this screen's empty state (modes-4): one line, a
 * drop tile that says what goes in and how much, and the one tap at the
 * bottom. Both the tile and the button are labels for one hidden input,
 * and both light the focus ring when it has the keyboard (modes-21).
 */

const MAX_MB = 25;
/**
 * The scoring function has 60 seconds of wall time (Vercel Hobby), and
 * Whisper on a long meeting blows straight through it, reported live
 * as "the scoring server didn't answer" on a meeting upload. Gate by
 * DURATION before spending the upload, with the honest reason.
 */
const MAX_MINUTES = 6;

/** The hidden input lights both of its labels (modes-21). */
const PEER_FOCUS =
  "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-terracotta-500";

/** Read a media file's duration without uploading it. Null = unknown
 *  (some webm containers report Infinity); unknown proceeds. */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    const timer = setTimeout(() => done(null), 5000);
    a.onloadedmetadata = () => {
      clearTimeout(timer);
      done(Number.isFinite(a.duration) ? a.duration : null);
    };
    a.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    a.src = url;
  });
}

export default function UploadPage() {
  const [phase, setPhase] = useState<"pick" | "analyzing" | "done">("pick");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  async function analyze(file: File) {
    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That file is over ${MAX_MB}MB. Trim it and try again.`);
      return;
    }
    const duration = await readDuration(file);
    if (duration !== null && duration > MAX_MINUTES * 60) {
      setError(
        `That's ${Math.round(duration / 60)} minutes. Scoring tops out around ${MAX_MINUTES}; trim it to the part you spoke and try again.`
      );
      return;
    }
    setPhase("analyzing");
    try {
      const token = await ensureSession();
      const form = new FormData();
      form.append("audio", file, file.name || "upload.webm");
      form.append("lessonId", "upload");
      form.append("captureMode", "voice");
      form.append("tzOffset", String(new Date().getTimezoneOffset()));
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const data = (await res.json().catch(() => null)) as
        | (AnalyzeResponse & { error?: string })
        | null;
      if (!res.ok || !data || data.error) {
        throw new Error(
          data?.error ??
            (res.status === 504 || res.status === 502
              ? `Scoring timed out. Files under about ${MAX_MINUTES} minutes work; trim it and try again.`
              : "The scoring server didn't answer.")
        );
      }
      setResult(data);
      setAudioUrl(URL.createObjectURL(file));
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through.");
      setPhase("pick");
    }
  }

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-[var(--nav-clear)] pt-7">
      <ScreenHeader
        title="Upload a recording"
        back={{ href: "/games", label: "Practice" }}
      />

      {phase === "pick" && (
        <>
          <p className="mt-3 text-read text-stone-800 text-pretty">
            Score a meeting, a voice memo or a run-through.
          </p>

          <input
            type="file"
            accept="audio/*,video/webm,video/mp4"
            className="peer sr-only"
            id="upload-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void analyze(f);
            }}
          />
          {/* The drop tile: what goes in and how much of it. R3
              (principle 7): it takes the free height, so the screen is a
              line, a big place to drop a file and the tap, with no band
              of blank between them; a big drop zone is the natural fill
              (220px on the smallest phone). A file dropped on it (a
              desktop browser) goes the same way as a picked one. Both
              labels stay siblings of the input, so its focus ring can
              reach them (peer). */}
          <label
            htmlFor="upload-file"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void analyze(f);
            }}
            className={`press mt-7 flex min-h-[220px] flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-[var(--color-sand-dashed)] bg-surface text-center ${PEER_FOCUS}`}
          >
            <span aria-hidden className="game-tile game-tile-plain">
              <IconUpload size={22} />
            </span>
            <span className="font-display text-row text-ink">Audio or video</span>
            <span className="text-caption tabular-nums text-stone-500">
              Up to {MAX_MB}MB, {MAX_MINUTES} min
            </span>
          </label>

          {/* A failure in the error grammar (system-10): rust on the
              control surface, never terracotta, which means tap. It takes
              the caption's place, and the tile gives up the height it
              needs, so the button below stays put. */}
          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-control border border-edge bg-surface px-4 py-3 text-caption leading-relaxed text-rust"
            >
              {error}
            </p>
          ) : (
            <p className="mt-3 text-caption text-stone-500">
              Counts as today&apos;s practice.
            </p>
          )}

          {/* The tap at the foot of the column, over the tab bar's
              clearance, where every other single-action screen puts it. */}
          <label
            htmlFor="upload-file"
            className={`${ACTION_CLASS} mt-6 cursor-pointer ${PEER_FOCUS}`}
          >
            Choose a file
          </label>
        </>
      )}

      {phase === "analyzing" && (
        <div className="mt-3 space-y-3" role="status">
          <p className="text-body text-stone-500">
            Reading it… A few minutes of audio takes a little while.
          </p>
          {/* A skeleton carries the shadow of what replaces it (#234):
              the debrief's cards land at level 1. */}
          <Skeleton rounded="rounded-card" className="elev-1 h-24" />
          <Skeleton rounded="rounded-card" className="elev-1 h-40" />
        </div>
      )}

      {phase === "done" && result && (
        <>
          {/* The player rides on the words section, above the
              transcript, and the static filler chips go, since the
              pills on the player play them (A4's RepResult props). */}
          <RepResult
            result={result}
            section="all"
            player={
              audioUrl ? (
                <AudioScrubber
                  src={audioUrl}
                  durationS={result.metrics.durationS}
                  fillers={result.metrics.fillers}
                  pauses={result.metrics.pauses}
                />
              ) : undefined
            }
          />
          <div className="mt-7 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setPhase("pick");
                setResult(null);
                if (audioUrl) URL.revokeObjectURL(audioUrl);
                setAudioUrl(null);
              }}
              className="press font-display min-h-12 flex-1 rounded-control border border-edge bg-surface px-4 text-row"
            >
              Another file
            </button>
            <Link href="/history" className={`${ACTION_CLASS} flex-1`}>
              See the log
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
