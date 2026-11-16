/**
 * What the room asks the phone for, and how it hears you (#475).
 *
 * The asks ride the hold that opens the room. An iPhone only asks for
 * motion inside a person's own tap (DeviceOrientationEvent's
 * requestPermission must be called in a click or a touchend), so both
 * asks are made synchronously in the lift that completes the hold,
 * before anything is awaited, and answered afterwards.
 *
 * The mic is open only for your turns (`openMic`), and closed between
 * them: a line never streams over an open mic, and the pops under it
 * never play into one. What it hears is a level a frame, read from an
 * analyser; nothing is recorded and nothing leaves the phone.
 *
 * Every API here is felt for before it is used, so a native shell or a
 * browser without one gets the plain fallback (no motion: a still room;
 * no mic: the scene plays and Demos says so) rather than an error.
 */

import { setAudioSession } from "./audio-session";

export type Ask = "granted" | "denied" | "unavailable";

/** The mic, asked inside the gesture. The stream is let go at once. */
export function askMic(): Promise<Ask> {
  const md = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  if (!md || typeof md.getUserMedia !== "function") return Promise.resolve("unavailable");
  setAudioSession("auto");
  let pending: Promise<MediaStream>;
  try {
    pending = md.getUserMedia({ audio: true });
  } catch {
    return Promise.resolve("unavailable");
  }
  return pending.then(
    (stream) => {
      stream.getTracks().forEach((t) => t.stop());
      return "granted" as const;
    },
    (e: unknown) => {
      const name = e instanceof DOMException ? e.name : "";
      return name === "NotAllowedError" || name === "SecurityError" ? ("denied" as const) : ("unavailable" as const);
    }
  );
}

type MotionCtor = { requestPermission?: () => Promise<"granted" | "denied" | "default"> };

/**
 * Motion, asked inside the gesture where the phone wants it asked (an
 * iPhone); granted without asking where it does not (Android); and
 * unavailable where there is no such sensor API at all.
 */
export function askMotion(): Promise<Ask> {
  if (typeof window === "undefined" || typeof window.DeviceOrientationEvent === "undefined") {
    return Promise.resolve("unavailable");
  }
  const ctor = window.DeviceOrientationEvent as unknown as MotionCtor;
  if (typeof ctor.requestPermission !== "function") return Promise.resolve("granted");
  try {
    return ctor.requestPermission().then(
      (r) => (r === "granted" ? "granted" : "denied"),
      () => "denied" as const
    );
  } catch {
    return Promise.resolve("denied");
  }
}

/** The RMS of a frame of samples, 0 to 1. */
export function rms(buf: ArrayLike<number>): number {
  if (buf.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

export type Mic = {
  /** This frame's level, 0 to 1. */
  level: () => number;
  /** Lets the mic go: tracks stopped, the session handed back. */
  close: () => void;
};

/**
 * Opens the mic for one turn, through the room's own audio context.
 * Rejects where there is no mic to open; the flow then plays on as it
 * does with no mic at all.
 */
export async function openMic(ctx: AudioContext | null): Promise<Mic> {
  const md = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  if (!ctx || !md || typeof md.getUserMedia !== "function") throw new Error("no mic");
  setAudioSession("auto");
  const stream = await md.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      source.disconnect();
    } catch {}
    stream.getTracks().forEach((t) => t.stop());
    setAudioSession("ambient");
  };
  let source: MediaStreamAudioSourceNode;
  let analyser: AnalyserNode;
  try {
    if (ctx.state !== "running") await ctx.resume().catch(() => {});
    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    setAudioSession("ambient");
    throw e;
  }
  const floats = typeof analyser.getFloatTimeDomainData === "function" ? new Float32Array(analyser.fftSize) : null;
  const bytes = floats ? null : new Uint8Array(analyser.fftSize);
  return {
    level() {
      if (closed) return 0;
      if (floats) {
        analyser.getFloatTimeDomainData(floats);
        return rms(floats);
      }
      analyser.getByteTimeDomainData(bytes!);
      let s = 0;
      for (let i = 0; i < bytes!.length; i++) {
        const v = (bytes![i] - 128) / 128;
        s += v * v;
      }
      return Math.sqrt(s / bytes!.length);
    },
    close,
  };
}
