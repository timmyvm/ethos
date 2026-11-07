"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

/** A stretch of the take being played, start and stop on its clock. */
export interface TakeSpan {
  from: number;
  until: number;
}

/**
 * The take's one audio element and the one way to play it (#424). Hear
 * it back's player, its filler and cut-in chips, a word's "Said at" and
 * the Pause row's moments all play through here, so one recording never
 * sounds twice over itself and a new play always replaces the last.
 */
export interface TakeAudio {
  /** The element, to render once on the screen. Null when there is no take. */
  element: ReactNode;
  ref: RefObject<HTMLAudioElement | null>;
  /** There is a take, and it has not failed to load or decode. */
  playable: boolean;
  /** The stretch playing now, when a play was given an end. */
  span: TakeSpan | null;
  /** Play from `from`; with `until`, stop there. */
  play: (from: number, until?: number) => void;
  pause: () => void;
}

export function useTakeAudio(src: string | null | undefined, durationS: number): TakeAudio {
  const ref = useRef<HTMLAudioElement | null>(null);
  const stopAt = useRef<number | null>(null);
  const [span, setSpan] = useState<TakeSpan | null>(null);
  /** The source that failed, so a new take starts out playable again. */
  const [failed, setFailed] = useState<string | null>(null);

  const endSpan = useCallback(() => {
    stopAt.current = null;
    setSpan(null);
  }, []);

  /*
   * Every start names its position (#406). On an iPhone a recording that
   * has never been seeked can sit unloaded at 0 and play nothing, so a
   * play always seeks first, a millisecond in when it starts from the top.
   */
  const play = useCallback(
    (from: number, until?: number) => {
      const a = ref.current;
      if (!a) return;
      const end = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : durationS;
      a.currentTime = Math.max(0.001, Math.min(end - 0.05, from));
      if (until !== undefined && until > from) {
        stopAt.current = until;
        setSpan({ from, until });
      } else {
        endSpan();
      }
      a.play().catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "NotSupportedError" && src) setFailed(src);
        endSpan();
      });
    },
    [durationS, endSpan, src]
  );

  const pause = useCallback(() => ref.current?.pause(), []);

  // A new take is a new element: nothing carries over from the last.
  useEffect(() => endSpan, [src, endSpan]);

  const element = src ? (
    /* eslint-disable-next-line jsx-a11y/media-has-caption */
    <audio
      ref={ref}
      src={src}
      preload="metadata"
      data-take
      onTimeUpdate={(e) => {
        const at = stopAt.current;
        if (at !== null && e.currentTarget.currentTime >= at) e.currentTarget.pause();
      }}
      onPause={endSpan}
      onEnded={endSpan}
      onError={() => setFailed(src)}
    />
  ) : null;

  return { element, ref, playable: !!src && failed !== src, span, play, pause };
}
