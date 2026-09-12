"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AudioScrubber } from "@/components/AudioScrubber";
import { ACTION_CLASS } from "@/components/LessonScreen";
import { RepResult } from "@/components/RepResult";
import { Skeleton } from "@/components/ui/Skeleton";
import { ensureSession } from "@/lib/supabase-browser";
import type { AnalyzeResponse } from "@/app/api/analyze/route";

/**
 * Upload-and-analyze (DECISIONS #185): a real meeting, a voice memo, a
 * practice run from the camera roll — through the exact engine every
 * recording gets. Real-stakes audio is the strongest mirror the product
 * can offer, and it was the one Wellspoken feature on the post-MVP list
 * (mechanics.md) nobody had built.
 *
 * The upload banks as a recording (lesson `upload`), so it counts like
 * speech you did today. No loudness envelope exists for a file, and the
 * engine already scores that honestly (#122: absent evidence, not
 * guessed evidence).
 */

const MAX_MB = 25;
/**
 * The scoring function has 60 seconds of wall time (Vercel Hobby), and
 * Whisper on a long meeting blows straight through it — reported live
 * as "the scoring server didn't answer" on a meeting upload. Gate by
 * DURATION before spending the upload, with the honest reason.
 */
const MAX_MINUTES = 6;

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
  const fileRef = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null);

  async function analyze(file: File) {
    lastFile.current = file;
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
    <main className="flex min-h-dvh flex-col px-5 pb-22 pt-7">
      <h1 className="font-display text-title">Upload a recording</h1>

      {phase === "pick" && (
        <>
          <p className="mt-2 text-body text-stone-500">
            A meeting, a voice memo, a run-through from your camera roll.
            The engine reads it like anything recorded here: fillers, pace,
            pauses, the Index.
          </p>
          <p className="mt-1.5 text-caption leading-relaxed text-stone-400">
            Up to {MAX_MB}MB and {MAX_MINUTES} minutes. It banks to your
            log as today&apos;s speaking. A long meeting? Trim it to the
            part where you talk.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="audio/*,video/webm,video/mp4"
            className="sr-only"
            id="upload-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void analyze(f);
            }}
          />
          {/* The tap sits at the bottom of the phone, where every
              other single-action screen puts it. */}
          <div className="flex-1" />
          <label
            htmlFor="upload-file"
            className={`${ACTION_CLASS} mt-7 cursor-pointer`}
          >
            Choose a file
          </label>

          {/* A failure keeps the card grammar: the terracotta wash is
              the coach bubble's material, not an error's (#234). */}
          {error && (
            <p
              role="alert"
              className="elev-1 mt-4 rounded-card border border-card-edge bg-raised p-4 text-caption leading-relaxed text-terracotta-700"
            >
              {error}
            </p>
          )}
        </>
      )}

      {phase === "analyzing" && (
        <div className="mt-7 space-y-3" role="status">
          <p className="text-body text-stone-500">
            Reading it. A few minutes of audio takes a little while.
          </p>
          {/* A skeleton carries the shadow of what replaces it (#234):
              the debrief's cards land at level 1. */}
          <Skeleton rounded="rounded-card" className="elev-1 h-24" />
          <Skeleton rounded="rounded-card" className="elev-1 h-40" />
        </div>
      )}

      {phase === "done" && result && (
        <>
          <RepResult result={result} section="all" />
          {audioUrl && (
            <div className="mt-7">
              <AudioScrubber
                src={audioUrl}
                durationS={result.metrics.durationS}
                fillers={result.metrics.fillers}
                pauses={result.metrics.pauses}
              />
            </div>
          )}
          <div className="mt-7 flex gap-2.5">
            <button
              onClick={() => {
                setPhase("pick");
                setResult(null);
                if (audioUrl) URL.revokeObjectURL(audioUrl);
                setAudioUrl(null);
              }}
              className="press font-display min-h-12 flex-1 rounded-control border border-edge bg-surface px-4 text-[14px] font-bold"
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
