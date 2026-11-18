"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { setAudioSession } from "@/lib/audio-session";
import { repAudioUrl } from "@/lib/client-data";
import { hushOthers, shouldStop } from "@/components/TakeAudio";

/** What a chip plays: a stretch of one stored recording. */
export interface RecordingMoment {
  repId: string;
  from: number;
  until: number;
}

/**
 * One audio element for moments from several recordings (#507): the
 * sentence you said, and each later recording that used the better
 * phrase. Each recording's link is asked of the server once (app/api/audio
 * signs it for this account alone) and kept for the visit. One sound at a
 * time, as useTakeAudio plays a take: a new moment replaces the last, and
 * anything else on the page gives way.
 */
export function useMoments(): {
  element: ReactNode;
  playing: RecordingMoment | null;
  /** Recordings whose audio could not be had: their times stand as text. */
  lost: ReadonlySet<string>;
  play: (m: RecordingMoment) => void;
  stop: () => void;
} {
  const ref = useRef<HTMLAudioElement | null>(null);
  const links = useRef(new Map<string, string | null>());
  const stopAt = useRef<number | null>(null);
  const [playing, setPlaying] = useState<RecordingMoment | null>(null);
  const [lost, setLost] = useState<ReadonlySet<string>>(new Set());
  const [src, setSrc] = useState<string | null>(null);
  const want = useRef<RecordingMoment | null>(null);

  const ended = useCallback(() => {
    stopAt.current = null;
    setPlaying(null);
    setAudioSession("auto");
  }, []);

  const start = useCallback((a: HTMLAudioElement, m: RecordingMoment) => {
    a.currentTime = Math.max(0.001, m.from);
    stopAt.current = m.until;
    hushOthers(document.querySelectorAll<HTMLMediaElement>("audio, video"), a);
    setAudioSession("playback");
    a.play().catch(() => {
      setAudioSession("auto");
      setPlaying(null);
    });
  }, []);

  const play = useCallback(
    (m: RecordingMoment) => {
      want.current = m;
      setPlaying(m);
      void (async () => {
        let link = links.current.get(m.repId);
        if (link === undefined) {
          link = await repAudioUrl(m.repId).catch(() => null);
          links.current.set(m.repId, link);
        }
        if (want.current !== m) return;
        if (!link) {
          setLost((s) => new Set([...s, m.repId]));
          setPlaying(null);
          return;
        }
        const a = ref.current;
        if (!a) return;
        if (a.getAttribute("src") === link) start(a, m);
        else setSrc(link);
      })();
    },
    [start]
  );

  const stop = useCallback(() => {
    want.current = null;
    ref.current?.pause();
    ended();
  }, [ended]);

  /* A new link: once it can play, the moment asked for plays. */
  useEffect(() => {
    const a = ref.current;
    const m = want.current;
    if (!a || !src || !m) return;
    const go = () => start(a, m);
    a.addEventListener("loadedmetadata", go, { once: true });
    a.load();
    return () => a.removeEventListener("loadedmetadata", go);
  }, [src, start]);

  useEffect(
    () => () => {
      setAudioSession("auto");
    },
    []
  );

  const element = (
    /* eslint-disable-next-line jsx-a11y/media-has-caption */
    <audio
      ref={ref}
      src={src ?? undefined}
      preload="metadata"
      data-say-audio
      onTimeUpdate={(e) => {
        if (shouldStop(e.currentTarget.currentTime, stopAt.current)) e.currentTarget.pause();
      }}
      onPause={ended}
      onEnded={ended}
      onError={() => {
        const m = want.current;
        if (m) setLost((s) => new Set([...s, m.repId]));
        ended();
      }}
    />
  );
  return { element, playing, lost, play, stop };
}

/**
 * A moment's chip: the house chip's grammar (components/rep/MomentChip.tsx:
 * surface, edge, the terracotta play mark), with a day before the time
 * where it names a recording ("Mon 0:33"). Plain text where the
 * recording's audio could not be had, never a dead button.
 */
export function SayChip({
  moment,
  label,
  clock,
  day,
  player,
}: {
  moment: RecordingMoment;
  /** The chip's accessible name, starting with what it shows. */
  label: string;
  clock: string;
  day?: string;
  player: ReturnType<typeof useMoments>;
}) {
  const on = player.playing?.repId === moment.repId && player.playing.from === moment.from;
  if (player.lost.has(moment.repId)) {
    return (
      <span data-say-chip="" className="font-display text-link tabular-nums text-stone-500">
        {day ? `${day} ` : ""}
        {clock}
      </span>
    );
  }
  return (
    <button
      type="button"
      data-say-chip=""
      aria-label={label}
      aria-pressed={on}
      onClick={() => (on ? player.stop() : player.play(moment))}
      className="moment-chip align-baseline"
    >
      <span className="moment-pill" data-playing={on || undefined}>
        <svg aria-hidden width="8" height="8" viewBox="0 0 10 10" className="shrink-0 text-terracotta-500">
          {on ? <path d="M1.5 1h2.5v8H1.5zM6 1h2.5v8H6z" fill="currentColor" /> : <path d="M2 1l7 4-7 4z" fill="currentColor" />}
        </svg>
        {day && <span className="font-semibold">{day}</span>}
        {clock}
      </span>
    </button>
  );
}
