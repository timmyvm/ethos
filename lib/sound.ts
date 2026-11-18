/**
 * Ethos's one sound kit (DECISIONS #505). Every sound the app makes goes
 * through here: one audio context for the whole app, one switch, one
 * master chain. What each sound is lives in `lib/sound-recipes.ts`; this
 * file only plays it.
 *
 * Synthesised, as the chime (#138) and the room's pops (#475) were: no
 * audio file, nothing to download, nothing on the first paint, works
 * offline. Rendered offline by `scripts/sound-audition.mjs`, which writes
 * every sound to docs/sound-audition/ with its peak and loudness.
 *
 * Where a sound may play:
 *  - only with Sound on (Settings, Accessibility, Sound: `prefs.sound`,
 *    on by default). Reduced motion does not silence it; the switch does.
 *  - only after a tap: a phone plays nothing from an audio context no
 *    gesture started. The context is made inside a tap that asks for it
 *    (`unlockSound`: Record, Hostile's record, the Settings switch, and
 *    at merge every tap of the introduction), and kept for the visit. A
 *    sound asked for before then is dropped, never queued for a later
 *    tap: XP on a You opened cold counts up quiet.
 *  - never past an iPhone's ring/silent switch. A sound asks for the
 *    "ambient" audio session (lib/audio-session.ts, iOS 16.4 on) when the
 *    session is the browser's own choice, which mixes with whatever else
 *    is playing and is silent with the switch on; Web Audio on an older
 *    iPhone follows the switch anyway. A take that is playing keeps its
 *    "playback" session, and the recorder says "auto" before it opens
 *    the mic.
 *  - never while a mic is open (#138): the envelope (lib/envelope.ts)
 *    scores every gap, and a sound through the speaker would be scored as
 *    one the speaker made. Every call site is a screen after the take.
 *
 * The chain, one per context: each sound has its own gain into the
 * master, and a send into a room (a convolver on an impulse generated
 * from a fixed seed, about a second and a half of soft, darkening
 * tail); the master runs through a high-pass at 140 Hz (a phone speaker
 * cannot move air below it and only distorts trying), a shelf down 4 dB
 * over 6 kHz (a phone speaker is shrill up there) and a limiter, so no
 * pile-up of coins can ever clip.
 */

import { setAudioSession } from "./audio-session";
import { readPrefs } from "./prefs";
import { BRASS_FILTER, VOICES, recipe, recipeLength, seeded, type Hiss, type Note, type Recipe, type SoundId } from "./sound-recipes";

type AudioContextCtor = new () => AudioContext;

let ctx: AudioContext | null = null;

function ctor(): AudioContextCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

/** The app's context, if a tap has made one. */
export function soundContext(): AudioContext | null {
  return ctx && ctx.state !== "closed" ? ctx : null;
}

/**
 * Inside a tap: make the context if there is none, wake it if the phone
 * paused it, and on first making it play one silent sample, which an
 * older iPhone needs before it lets a context sound later. Returns the
 * context, or null where there is no Web Audio (everything plays on,
 * mute). Cheap to call on every tap: an awake context is left alone.
 * The introduction's blips share it (lib/intro-sound.ts on wt-onboard,
 * `introContext` / `unlockIntroSound`, at merge).
 */
export function unlockSound(): AudioContext | null {
  if (!soundContext()) {
    const C = ctor();
    try {
      ctx = C ? new C() : null;
    } catch {
      ctx = null;
    }
    if (ctx) {
      try {
        const b = ctx.createBuffer(1, 1, ctx.sampleRate);
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(ctx.destination);
        s.start(0);
      } catch {}
    }
  }
  const c = soundContext();
  /* Mix with whatever else is playing, and follow the silent switch,
     from the first sample (a recorder asks for "auto" again before its
     mic opens). */
  if (c) ambient();
  if (c && c.state !== "running") void c.resume().catch(() => {});
  /* The chain now, in the tap: its limiter starts clamped and takes
     about half a second to let go, long before a take earns anything. */
  if (c) {
    try {
      master(c);
    } catch {}
  }
  return c;
}

/** Whether a sound may play now: Sound on (unless forced), and a running context. */
function live(force: boolean): AudioContext | null {
  const c = soundContext();
  if (!c) return null;
  if (c.state !== "running") {
    /* A phone pauses a context it interrupted (a call, the lock screen);
       ask, but play nothing until it answers. */
    if (c.state === "suspended") void c.resume().catch(() => {});
    return null;
  }
  if (!force && !readPrefs().sound) return null;
  return c;
}

/** Whether a sound would play now (Sound on, a tap made the context, the phone has not paused it). */
export function canSound(): boolean {
  return live(false) !== null;
}

/* ------------------------------------------------------------------ */
/* The chain                                                           */
/* ------------------------------------------------------------------ */

/** The master's level after the limiter. */
export const MASTER_OUT = 0.89;
/** The limiter: everything over -3 dBFS is held there. */
export const LIMIT = { threshold: -3, knee: 0, ratio: 20, attack: 0.001, release: 0.12 } as const;
/** The room: seconds of tail, and how fast it dies. */
export const ROOM = { seconds: 1.5, decay: 4.6, seed: 505 } as const;

type Master = { input: GainNode; room: ConvolverNode; noise: AudioBuffer; born: number };
/** The limiter's own settling: a sound asked for sooner waits for it. */
export const SETTLE_S = 0.5;
const masters = new WeakMap<BaseAudioContext, Master>();

/** The room's impulse: two channels of seeded noise, a soft onset, an exponential tail, darker as it dies. */
export function roomImpulse(c: BaseAudioContext): AudioBuffer {
  const rate = c.sampleRate;
  const length = Math.round(ROOM.seconds * rate);
  const buf = c.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const rng = seeded(ROOM.seed + ch);
    const data = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      /* A one-pole low-pass whose corner falls over the tail. */
      const a = 0.35 + 0.55 * (t / ROOM.seconds);
      lp = lp * a + (rng() * 2 - 1) * (1 - a);
      const env = Math.exp(-t * ROOM.decay) * (1 - Math.exp(-t * 180));
      data[i] = lp * env * 2.2;
    }
  }
  return buf;
}

/** One second of seeded white noise, for the hiss. */
function noiseBuffer(c: BaseAudioContext): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const data = buf.getChannelData(0);
  const rng = seeded(ROOM.seed * 7);
  for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1;
  return buf;
}

/** The context's master, built once: room, high-pass, shelf, limiter, out. */
export function master(c: BaseAudioContext): Master {
  const have = masters.get(c);
  if (have) return have;
  const input = c.createGain();
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 140;
  hp.Q.value = 0.7;
  const shelf = c.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 6000;
  shelf.gain.value = -4;
  const limit = c.createDynamicsCompressor();
  limit.threshold.value = LIMIT.threshold;
  limit.knee.value = LIMIT.knee;
  limit.ratio.value = LIMIT.ratio;
  limit.attack.value = LIMIT.attack;
  limit.release.value = LIMIT.release;
  const out = c.createGain();
  out.gain.value = MASTER_OUT;
  input.connect(hp).connect(shelf).connect(limit).connect(out).connect(c.destination);
  const room = c.createConvolver();
  room.buffer = roomImpulse(c);
  const roomOut = c.createGain();
  roomOut.gain.value = 0.9;
  room.connect(roomOut).connect(input);
  const m = { input, room, noise: noiseBuffer(c), born: c.currentTime };
  masters.set(c, m);
  return m;
}

/** The master's input on this context: where any of the app's sounds should go. */
export function soundOut(c: BaseAudioContext): AudioNode {
  return master(c).input;
}

function panner(c: BaseAudioContext, pan: number | undefined, into: AudioNode): AudioNode {
  if (!pan || typeof (c as AudioContext).createStereoPanner !== "function") return into;
  const p = c.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(into);
  return p;
}

function playNote(c: BaseAudioContext, n: Note, t0: number, into: AudioNode, stops: AudioScheduledSourceNode[]): void {
  const at = t0 + n.at;
  const top = at + n.attack;
  const end = top + n.decay;
  const out = panner(c, n.pan, into);
  let dest: AudioNode = out;
  if (n.voice === "brass") {
    /* The section's lip: the filter opens on the attack and settles. */
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.9;
    lp.frequency.setValueAtTime(n.freq * BRASS_FILTER.from, at);
    lp.frequency.linearRampToValueAtTime(n.freq * BRASS_FILTER.peak, top);
    lp.frequency.exponentialRampToValueAtTime(n.freq * BRASS_FILTER.settle, Math.min(end, top + 0.25));
    lp.connect(out);
    dest = lp;
  }
  for (const p of VOICES[n.voice]) {
    const g = c.createGain();
    const pEnd = top + Math.max(0.012, n.decay * p.decay);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(n.peak * p.gain, top);
    g.gain.exponentialRampToValueAtTime(0.0001, pEnd);
    const o = c.createOscillator();
    o.type = p.wave;
    const f = n.freq * p.ratio;
    o.frequency.setValueAtTime(f, at);
    if (n.glide && n.glide !== 1) o.frequency.exponentialRampToValueAtTime(f * n.glide, end);
    if (p.detune) o.detune.value = p.detune;
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(pEnd + 0.03);
    stops.push(o);
  }
}

function playHiss(c: BaseAudioContext, h: Hiss, t0: number, noise: AudioBuffer, into: AudioNode, stops: AudioScheduledSourceNode[]): void {
  const at = t0 + h.at;
  const end = at + h.dur;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = h.q;
  bp.frequency.setValueAtTime(h.from, at);
  if (h.to !== h.from) bp.frequency.exponentialRampToValueAtTime(h.to, end);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(h.peak, at + h.attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  src.connect(bp).connect(g).connect(into);
  src.start(at, (h.at * 7919) % 0.9);
  src.stop(end + 0.03);
  stops.push(src);
}

/**
 * A sound laid on the clock: stop() fades it out in 40ms (one not yet
 * started never sounds); drop() stops it only if it has not started, so a
 * screen left mid-sound lets it ring out.
 */
export type Playing = { stop: () => void; drop: () => void; startsAt: number; endsAt: number };

/**
 * Lay a recipe on any context, live or offline, at `t0` on its clock,
 * into its master. Used by `playSound` and by the offline renderer.
 */
export function renderRecipe(c: BaseAudioContext, r: Recipe, t0: number): Playing {
  const m = master(c);
  const bus = c.createGain();
  bus.gain.value = r.gain;
  bus.connect(m.input);
  if (r.wet > 0) {
    const send = c.createGain();
    send.gain.value = r.wet;
    bus.connect(send).connect(m.room);
  }
  const stops: AudioScheduledSourceNode[] = [];
  for (const n of r.notes) playNote(c, n, t0, bus, stops);
  for (const h of r.hiss) playHiss(c, h, t0, m.noise, bus, stops);
  const endsAt = t0 + recipeLength(r);
  let stopped = false;
  return {
    startsAt: t0,
    endsAt,
    drop() {
      if (c.currentTime < t0) this.stop();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      const now = c.currentTime;
      try {
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(bus.gain.value, now);
        bus.gain.linearRampToValueAtTime(0, now + 0.04);
      } catch {}
      for (const s of stops) {
        try {
          s.stop(now + 0.05);
        } catch {}
      }
    },
  };
}

/** Ask for the ambient session, unless a take is playing ("playback") or nothing can be asked. */
function ambient(): void {
  const session = (typeof navigator === "undefined" ? undefined : (navigator as { audioSession?: { type?: string } }).audioSession) ?? null;
  if (session && session.type === "auto") setAudioSession("ambient");
}

export type PlayOptions = {
  /** A tick's step: each one a little higher. */
  step?: number;
  /** The audition page: plays with Sound off (it is a button that says Play). Still needs the tap. */
  force?: boolean;
  /** Seconds from now, on the audio clock: a moment's later cues land on time whatever the page is doing. */
  delayS?: number;
};

/**
 * Play a sound now, if one may play. Returns a handle to stop it, or null
 * when nothing played (Sound off, no tap yet, the phone paused audio).
 */
export function playSound(id: SoundId, opts: PlayOptions = {}): Playing | null {
  const c = live(!!opts.force);
  if (!c) return null;
  try {
    ambient();
    /* A sound timed to something on screen leaves early by the output's
       own lag, so it reaches the ear with the frame it belongs to. */
    const lag = Math.min(0.15, (c.baseLatency || 0) + ((c as { outputLatency?: number }).outputLatency || 0));
    const delay = Math.max(0, (opts.delayS ?? 0) - (opts.delayS ? lag : 0));
    const t0 = Math.max(c.currentTime + 0.01, master(c).born + SETTLE_S) + delay;
    return renderRecipe(c, recipe(id, opts.step ?? 0), t0);
  } catch {
    return null;
  }
}

/**
 * The introduction's blips (lib/intro-sound.ts on wt-onboard), on the
 * kit's context and switch. Same shape as its `Blip`, so at merge its
 * `play` becomes this.
 */
export type Blip = {
  type: "sine" | "triangle";
  freq: number;
  endFreq: number;
  peak: number;
  attackS: number;
  decayS: number;
  at: number;
};
export const BLIP_LOWPASS_HZ = 2600;

export function playBlips(blips: readonly Blip[]): void {
  const c = live(false);
  if (!c) return;
  try {
    for (const b of blips) {
      const at = c.currentTime + 0.005 + b.at;
      const end = at + b.attackS + b.decayS;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(b.peak, at + b.attackS);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = BLIP_LOWPASS_HZ;
      const o = c.createOscillator();
      o.type = b.type;
      o.frequency.setValueAtTime(b.freq, at);
      if (b.endFreq !== b.freq) o.frequency.exponentialRampToValueAtTime(b.endFreq, end);
      /* The blips were tuned straight to the speaker; they keep that. */
      o.connect(g).connect(lp).connect(c.destination);
      o.start(at);
      o.stop(end + 0.03);
    }
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Cues on a moment's clock                                            */
/* ------------------------------------------------------------------ */

type CueLike = { sound: SoundId; atMs: number; slot: string; step?: number };
/** Lays one cue on its clock, `delayMs` from now; returns its cancel. */
export type Schedule = (c: CueLike, delayMs: number) => () => void;

/*
 * On the audio clock, all at once: a star's ding lands with its star
 * even when the page is busy drawing the glance (a timer would wait for
 * the main thread; the audio thread does not). A cancelled sound that has
 * not started never does.
 */
const onAudioClock: Schedule = (c, delayMs) => {
  const p = playSound(c.sound, { step: c.step, delayS: delayMs / 1000 });
  return () => p?.drop();
};
const realNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * Plays a moment's cues on its clock, from when it starts. A later read
 * that changes the cues (a level-up worked out after the stored row
 * lands) replaces what has not played yet, slot by slot: a slot already
 * played never plays again, a slot still waiting takes its new sound,
 * and a slot new to the list plays at its time, or at once if that has
 * passed.
 */
export class CueRunner {
  private start: number | null = null;
  private waiting = new Map<string, { key: string; atMs: number; cancel: () => void }>();
  private played = new Set<string>();
  constructor(
    private schedule: Schedule = onAudioClock,
    private now: () => number = realNow
  ) {}

  private elapsed(): number {
    if (this.start === null) this.start = this.now();
    return this.now() - this.start;
  }

  /** Slots whose time has come have played: they are no longer anyone's to replace. */
  private settle(elapsed: number): void {
    for (const [slot, w] of this.waiting) {
      if (w.atMs <= elapsed) {
        this.waiting.delete(slot);
        this.played.add(slot);
      }
    }
  }

  run(cues: readonly CueLike[]): void {
    const elapsed = this.elapsed();
    this.settle(elapsed);
    const keyOf = (c: CueLike) => `${c.sound}@${c.atMs}`;
    const want = new Map(cues.map((c) => [c.slot, c] as const));
    for (const [slot, w] of this.waiting) {
      const next = want.get(slot);
      if (!next || keyOf(next) !== w.key) {
        w.cancel();
        this.waiting.delete(slot);
      }
    }
    for (const c of cues) {
      if (this.played.has(c.slot) || this.waiting.has(c.slot)) continue;
      const delay = Math.max(0, c.atMs - elapsed);
      this.waiting.set(c.slot, { key: keyOf(c), atMs: elapsed + delay, cancel: this.schedule(c, delay) });
    }
  }

  /** Leaving the moment: whatever has not started never will; what is sounding rings out. */
  cancel(): void {
    this.settle(this.elapsed());
    for (const w of this.waiting.values()) w.cancel();
    this.waiting.clear();
  }
}

/** Tests only. */
export function resetSoundForTests(): void {
  ctx = null;
}
