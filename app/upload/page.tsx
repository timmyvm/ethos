"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AudioScrubber } from "@/components/AudioScrubber";
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
        throw new Error(data?.error ?? "The scoring server didn't answer.");
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
    <main className="px-5 pb-24 pt-7">
      <h1 className="font-display text-[27px]">Upload a recording</h1>

      {phase === "pick" && (
        <>
          <p className="mt-2.5 text-[14px] leading-relaxed text-stone-500">
            A meeting, a voice memo, a run-through from your camera roll.
            The engine reads it like anything recorded here: fillers, pace,
            pauses, the Index.
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-stone-400">
            Up to {MAX_MB}MB, best under five minutes. It banks to your log
            as today&apos;s speaking.
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
          <label
            htmlFor="upload-file"
            className="press mt-6 block w-full cursor-pointer rounded-full bg-terracotta-500 px-6 py-4 text-center text-[16.5px] font-semibold text-cream transition-colors hover:bg-terracotta-600"
          >
            Choose a file
          </label>

          {error && (
            <p className="mt-4 rounded-[20px] bg-terracotta-50 px-4 py-3 text-[13.5px] leading-relaxed text-terracotta-700">
              {error}
            </p>
          )}
        </>
      )}

      {phase === "analyzing" && (
        <div className="mt-6 space-y-3">
          <p className="text-[14px] text-stone-500">
            Reading it. A few minutes of audio takes a little while.
          </p>
          <Skeleton className="h-24 rounded-[24px]" />
          <Skeleton className="h-40 rounded-[24px]" />
        </div>
      )}

      {phase === "done" && result && (
        <>
          <RepResult result={result} section="all" />
          {audioUrl && (
            <div className="mt-4">
              <AudioScrubber
                src={audioUrl}
                durationS={result.metrics.durationS}
                fillers={result.metrics.fillers}
                pauses={result.metrics.pauses}
              />
            </div>
          )}
          <div className="mt-6 flex gap-2.5">
            <button
              onClick={() => {
                setPhase("pick");
                setResult(null);
                if (audioUrl) URL.revokeObjectURL(audioUrl);
                setAudioUrl(null);
              }}
              className="press flex-1 rounded-full border border-stone-200 bg-surface px-5 py-3.5 text-[15px] font-semibold"
            >
              Another file
            </button>
            <Link
              href="/history"
              className="press flex-1 rounded-full bg-terracotta-500 px-5 py-3.5 text-center text-[15px] font-semibold text-cream"
            >
              See the log
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
