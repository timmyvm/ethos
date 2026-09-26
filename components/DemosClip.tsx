"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { clipSrc, hasClip, type ClipPose } from "@/lib/idle-clips";
import { prefersReducedMotion } from "@/lib/prefs";

export { hasClip, type ClipPose };

/**
 * Demos's idle, played over his still (DECISIONS #316).
 *
 * A still that sways on a CSS loop is a sticker being moved; a character
 * that blinks, waves and glances at the thing in his paws is alive. The
 * clips are Kling renders of each 3D pose with the pose itself as the
 * first AND the last frame, so every clip starts and ends on the still
 * that is already on screen: the swap from still to clip is invisible,
 * and a clip that stops holds the still again.
 *
 * Why a canvas and not a <video>: he stands on coloured stages, so the
 * clip needs transparency, and no one video format carries alpha in every
 * browser (Safari plays neither alpha WebM nor, from anything we can
 * encode, alpha HEVC). Each clip is an ordinary video with the colour
 * (premultiplied) stacked over its alpha as grey, and a twelve-line
 * shader puts them back together. Plain H.264 and VP9 play everywhere.
 *
 * It only ever adds. The still renders first, from the server, as it
 * always did; the clip loads after, fades in on the first frame it
 * actually draws, and anything that fails along the way (no WebGL, a
 * codec the browser lacks, iOS Low Power Mode refusing autoplay, a lost
 * context) leaves the still exactly where it was. Reduced motion and
 * Save-Data never fetch a byte of it.
 *
 * It plays, rests, and plays again, because a character that never stops
 * moving is a screensaver: the first play waits `delayMs` (on a screen
 * where he speaks, until his words have landed, #288), then each rest is
 * a few seconds, drawn afresh each time so the rhythm never ticks. It
 * pauses while off screen or while the tab is hidden.
 */

/** Rest between plays, drawn per rest so two screens never beat in time. */
const REST_MS: [number, number] = [2600, 5200];

const VERT = `
attribute vec2 p;
varying vec2 uv;
void main() {
  uv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

/* The frame is colour over alpha; with the texture flipped, colour is
   the top half of v (0.5 to 1) and alpha the bottom (0 to 0.5). The
   colour was stored premultiplied, and the canvas composites
   premultiplied, so the two halves go straight out. */
const FRAG = `
precision mediump float;
uniform sampler2D t;
varying vec2 uv;
void main() {
  vec3 c = texture2D(t, vec2(uv.x, 0.5 + uv.y * 0.5)).rgb;
  float a = texture2D(t, vec2(uv.x, uv.y * 0.5)).r;
  gl_FragColor = vec4(min(c, vec3(a)), a);
}`;

function saveData(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } })
    .connection;
  return Boolean(c?.saveData);
}

export function DemosClip({
  pose,
  delayMs = 600,
  onLive,
  className = "",
}: {
  pose: ClipPose;
  /** Before the first play. */
  delayMs?: number;
  /** Called once the clip has drawn a frame, so the still can step back. */
  onLive?: (live: boolean) => void;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const onLiveRef = useRef(onLive);
  onLiveRef.current = onLive;

  useEffect(() => {
    if (prefersReducedMotion() || saveData()) return;
    const box = host.current;
    if (!box) return;

    /* A canvas of its own per run: a context lost on cleanup stays lost
       on its canvas, and a remount (React's development double effect,
       a pose change) handed the old canvas would inherit a dead one. */
    const cv = document.createElement("canvas");
    cv.style.cssText =
      "display:block;width:100%;height:100%;opacity:0;transition:opacity 150ms ease-out";
    const gl = cv.getContext("webgl", {
      premultipliedAlpha: true,
      alpha: true,
      antialias: false,
    });
    if (!gl) return;
    box.appendChild(cv);

    let disposed = false;
    let raf = 0;
    let rest: ReturnType<typeof setTimeout> | undefined;
    let visible = false;
    let shown = false;

    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      cv.remove();
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    /* In the DOM, invisible: older iOS will not decode frames for a
       video that is not attached, and a texture of an undecoded video
       is a black square. */
    const video = document.createElement("video");
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.setAttribute("aria-hidden", "true");
    video.style.cssText =
      "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none";
    for (const [ext, type] of [
      ["webm", 'video/webm; codecs="vp9"'],
      /* No codecs string: libx264's profile is its own choice, and a
         hint that names the wrong one makes Safari skip a file it plays. */
      ["mp4", "video/mp4"],
    ] as const) {
      const s = document.createElement("source");
      s.src = clipSrc(pose, ext);
      s.type = type;
      video.appendChild(s);
    }
    box.appendChild(video);

    const draw = () => {
      if (disposed || video.readyState < 2) return;
      const w = video.videoWidth;
      const h = video.videoHeight / 2;
      if (!w || !h) return;
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!shown) {
        shown = true;
        cv.style.opacity = "1";
        onLiveRef.current?.(true);
      }
    };

    /* Draw once per decoded frame where the browser can say when one
       lands (Chrome, Safari 15.4+): a 24fps clip on a 60Hz or 120Hz
       screen would otherwise upload the same frame two to five times. */
    type FrameVideo = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (id: number) => void;
    };
    const fv = video as FrameVideo;
    let vfc = 0;
    const stopTicking = () => {
      cancelAnimationFrame(raf);
      if (vfc) fv.cancelVideoFrameCallback?.(vfc);
      vfc = 0;
    };
    const tick = () => {
      vfc = 0;
      draw();
      if (video.paused || video.ended || disposed) return;
      if (fv.requestVideoFrameCallback) vfc = fv.requestVideoFrameCallback(tick);
      else raf = requestAnimationFrame(tick);
    };

    const play = () => {
      if (disposed || !visible || document.hidden) return;
      video.currentTime = 0;
      video.play().then(
        () => {
          stopTicking();
          tick();
        },
        () => {
          /* Autoplay refused (Low Power Mode): he stays the still. */
        }
      );
    };

    const scheduleRest = (ms?: number) => {
      clearTimeout(rest);
      const [lo, hi] = REST_MS;
      rest = setTimeout(play, ms ?? lo + Math.random() * (hi - lo));
    };

    video.addEventListener("ended", () => {
      draw();
      scheduleRest();
    });
    video.addEventListener("error", () => {
      /* No source this browser can play: the still stays. */
    });

    const seen = new IntersectionObserver(
      ([entry]) => {
        const was = visible;
        visible = entry.isIntersecting;
        if (visible && !was) scheduleRest(shown ? undefined : delayMs);
        if (!visible) {
          clearTimeout(rest);
          video.pause();
        }
      },
      { threshold: 0.2 }
    );
    seen.observe(box);

    const onVisibility = () => {
      if (document.hidden) {
        clearTimeout(rest);
        video.pause();
      } else if (visible) scheduleRest();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onLost = (e: Event) => {
      e.preventDefault();
      disposed = true;
      cv.style.opacity = "0";
      onLiveRef.current?.(false);
    };
    cv.addEventListener("webglcontextlost", onLost);

    return () => {
      disposed = true;
      stopTicking();
      clearTimeout(rest);
      seen.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cv.removeEventListener("webglcontextlost", onLost);
      video.pause();
      video.removeAttribute("src");
      while (video.firstChild) video.removeChild(video.firstChild);
      video.load();
      video.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      cv.remove();
      onLiveRef.current?.(false);
    };
  }, [pose, delayMs]);

  return (
    <div
      ref={host}
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
    />
  );
}

/**
 * A still with its clip over it, for the places that place Demos as a
 * plain image rather than through DemosArt (the topic card, the scoring
 * wait). The parent positions it; the clip fills the same box.
 */
export function DemosFigure({
  pose,
  src,
  width,
  height,
  className = "",
  delayMs,
}: {
  pose: ClipPose;
  src: string;
  width: number;
  height: number;
  className?: string;
  delayMs?: number;
}) {
  const [live, setLive] = useState(false);
  return (
    <>
      <Image
        src={src}
        alt=""
        width={width}
        height={height}
        priority
        className={`${className} ${live ? "opacity-0" : ""}`}
      />
      <DemosClip pose={pose} delayMs={delayMs} onLive={setLive} />
    </>
  );
}
