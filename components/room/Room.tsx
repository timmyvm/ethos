"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { preloadPose } from "@/components/DemosArt";
import { IntroDemos } from "@/components/IntroDemos";
import { SpeechBubble } from "@/components/SpeechBubble";
import { TapTick } from "@/components/ui/TapTick";
import { DOOR_COPY } from "@/content/tester";
import { setAudioSession } from "@/lib/audio-session";
import { buzz } from "@/lib/prefs";
import { askMic, askMotion, openMic, type Ask } from "@/lib/room-media";
import {
  INTERVIEW,
  ROOM_COPY,
  ruleOf,
  type RoomBeat,
  type RoomMood,
  type RoomScript,
  type RoomVerdict,
} from "@/lib/room-script";
import { createPopper, type Popper, type PopVoice } from "@/lib/room-sound";
import { inScreen, pointerTilt, springStep, TiltTracker, ZERO, type Axis, type Tilt } from "@/lib/room-tilt";
import { createVoiceGate, roomVerdict, type LevelSample, type TurnTrace } from "@/lib/room-verdict";
import { holdFor, planStream, playStream, type StreamPlan } from "@/lib/text-stream";
import { ACTION_CLASS } from "@/lib/ui";
import RoomArt, { type RoomArtProps } from "./RoomArt";

/**
 * The room (#475): the first minute of Ethos, played (lib/room-script.ts
 * holds what is said, components/room/RoomArt.tsx draws where).
 *
 *   door      the room behind frosted glass, "Hold to step in", Not now
 *   scene     his lines stream into his bubble; your turns open the mic
 *   ending    Demos rises in on a sheet: alright or horrible, then
 *             "What if that was real?", then Next into the questions
 *
 * Everything that is not the drawing lives here: the hold and the asks
 * it carries, the script's timing, the streamed text and its pops, the
 * mic and its level, the tilt and its smoothing, the verdict, Demos, and
 * the hand-off. No server is called, nothing is recorded, nothing is
 * sent (Timothy, 12 Nov).
 */

/** How long the hold takes to fill. */
const HOLD_MS = 800;
/** The frosted glass clearing, before his first line. */
const ENTER_MS = 900;
/** Between your turn ending and his next line. */
const AFTER_TURN_MS = 650;
/** Where a turn would be, when there is no mic to hear it. */
const NO_MIC_BEAT_MS = 900;
/** The sheet rising and Demos arriving on it, before he speaks. */
const DEMOS_IN_MS = 700;
/** The door's words fading once the room opens. */
const DOOR_FADE_MS = 260;

type Stage = "door" | "scene" | "ending";

type Line = { key: number; plan: StreamPlan; shown: number };

/* ------------------------------------------------------------------ */
/* The tilt: read, smoothed, and handed to the art every frame.        */
/* ------------------------------------------------------------------ */

type TiltStore = {
  get: () => Tilt;
  set: (t: Tilt) => void;
  subscribe: (f: () => void) => () => void;
};

function createTiltStore(): TiltStore {
  let value: Tilt = ZERO;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      if (Math.abs(next.x - value.x) < 0.0004 && Math.abs(next.y - value.y) < 0.0004) return;
      value = next;
      subs.forEach((f) => f());
    },
    subscribe(f) {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
  };
}

function screenAngle(): number {
  try {
    const a = window.screen?.orientation?.angle;
    if (typeof a === "number") return a;
    const legacy = (window as unknown as { orientation?: number }).orientation;
    return typeof legacy === "number" ? legacy : 0;
  } catch {
    return 0;
  }
}

/**
 * Reads the phone's tilt (or, with no motion, a mouse), and every frame
 * moves the smoothed value a critically damped step toward it. The art
 * subscribes to the store, so only the art redraws each frame; the
 * values also land on the host as `--room-tilt-x` and `--room-tilt-y`.
 */
function useRoomTilt(store: TiltStore, host: React.RefObject<HTMLElement | null>, reduced: boolean) {
  const tracker = useRef(new TiltTracker());
  useEffect(() => {
    if (reduced) {
      store.set(ZERO);
      return;
    }
    let target: Tilt = ZERO;
    let motion = false;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (typeof e.beta !== "number" || typeof e.gamma !== "number") return;
      motion = true;
      target = tracker.current.update(inScreen({ beta: e.beta, gamma: e.gamma }, screenAngle()), performance.now());
    };
    const onMove = (e: PointerEvent) => {
      if (motion || e.pointerType !== "mouse") return;
      const r = host.current?.getBoundingClientRect();
      if (!r) return;
      target = pointerTilt(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    };
    const onLeave = () => {
      if (!motion) target = ZERO;
    };
    window.addEventListener("deviceorientation", onOrient);
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    let sx: Axis = { p: 0, v: 0 };
    let sy: Axis = { p: 0, v: 0 };
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      sx = springStep(sx, target.x, dt);
      sy = springStep(sy, target.y, dt);
      store.set({ x: sx.p, y: sy.p });
      const el = host.current;
      if (el) {
        el.style.setProperty("--room-tilt-x", sx.p.toFixed(4));
        el.style.setProperty("--room-tilt-y", sy.p.toFixed(4));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [store, host, reduced]);
  /* The centre is how the phone is held when the scene begins. */
  return useCallback(() => tracker.current.reset(), []);
}

/** The art, redrawn on its own each frame the tilt moves. */
function TiltedArt({ store, ...rest }: Omit<RoomArtProps, "tilt"> & { store: TiltStore }) {
  const tilt = useSyncExternalStore(store.subscribe, store.get, () => ZERO);
  return <RoomArt tilt={tilt} {...rest} />;
}

/* ------------------------------------------------------------------ */
/* Streamed words.                                                     */
/* ------------------------------------------------------------------ */

/** The chunks landed so far, each popping in as it lands. */
function Chunks({ plan, shown }: { plan: StreamPlan; shown: number }) {
  return (
    <>
      {plan.chunks.slice(0, shown).map((c, i) => (
        <span key={i}>
          {i > 0 && " "}
          <span className="room-chunk">{c.text.trimStart()}</span>
        </span>
      ))}
    </>
  );
}

/**
 * A box that grows to its words: the words are laid out at their own
 * width (never the box's), and the box follows them on a short curve, so
 * a chunk landing grows the bubble smoothly and nothing already there
 * moves to another line.
 */
function Grow({ children, fill = false, className = "" }: { children: ReactNode; fill?: boolean; className?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      className={`room-grow ${className}`}
      style={size ? (fill ? { height: size.h } : { width: size.w, height: size.h }) : undefined}
    >
      <div ref={inner} className={fill ? "room-grow-fill" : "room-grow-fit"}>
        {children}
      </div>
    </div>
  );
}

/**
 * The bubble keeps this far inside the room's edges: 12px, plus most of
 * the 34px his layer travels at full tilt, so turning the phone toward
 * an edge never carries his words off it.
 */
const BUBBLE_EDGE = 12 + 28;
/** Where the tail stands in from the bubble's own edge. */
const TAIL_IN = 18;

/**
 * His speech: a white bubble the art places by his head. Seen, not read
 * (the live region reads it).
 *
 * The art says where his mouth is; the bubble makes sure it can be read
 * from there. Its tail stays on the art's anchor, and if the words would
 * carry it past the room's edge the bubble slides back inside it as it
 * grows, the tail sliding the other way along its foot so it still
 * points at him. It is never cut off, wherever the anchor is.
 */
function HisBubble({ line }: { line: Line }) {
  const shell = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = shell.current;
    const b = bubble.current;
    if (!el || !b) return;
    const room = el.closest(".room");
    const right = el.closest('[data-room-tail="right"]') !== null;
    let shift = 0;
    /* The shell stays on the anchor (the slide is the bubble's own
       `translate`, which the shell's box never sees). The width fitted to
       is the words' own, which lands with each chunk, not the box's,
       which is still growing toward it: the slide and the growth then run
       on one curve together and the far edge never passes the room's. */
    const words = b.querySelector<HTMLElement>(".room-grow-fit") ?? b;
    const fit = () => {
      const box = room?.getBoundingClientRect();
      const anchor = el.getBoundingClientRect();
      const w = words.offsetWidth;
      if (!box || w === 0) return;
      const lo = box.left + BUBBLE_EDGE;
      const hi = box.right - BUBBLE_EDGE;
      const most = Math.max(0, w - 2 * TAIL_IN - 16);
      const next = right
        ? Math.min(Math.max(0, lo - (anchor.right - w)), most, Math.max(0, hi - anchor.right))
        : Math.min(Math.max(0, anchor.left + w - hi), most, Math.max(0, anchor.left - lo));
      if (Math.abs(next - shift) < 0.5) return;
      shift = next;
      b.style.setProperty("--room-bubble-shift", `${right ? shift : -shift}px`);
      b.style.setProperty("--room-tail-shift", `${shift}px`);
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(words);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={shell} className="room-bubble-shell" aria-hidden>
      <div ref={bubble} className="room-bubble" data-room-line={line.key}>
        <Grow>
          <p className="room-bubble-text">
            <Chunks plan={line.plan} shown={line.shown} />
          </p>
        </Grow>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The hold.                                                           */
/* ------------------------------------------------------------------ */

/**
 * "Hold to step in" (#475). It fills as it is held, and the room opens
 * when it is full and the finger lifts: the lift is the gesture an
 * iPhone asks motion and sound to come from, so `onComplete` runs inside
 * it, synchronously. Let go early and it empties. A keyboard or a screen
 * reader presses it like any button: their press is the gesture, and
 * there is no hold to ask of them.
 *
 * On an iPhone the tick (TapTick) comes at the lift, the one moment a
 * page can have one; with a Vibration API, a short buzz when it fills.
 */
function HoldToStep({ label, onComplete }: { label: string; onComplete: (keys: boolean) => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const state = useRef<{ start: number; raf: number; full: boolean; pressed: boolean; done: boolean; downAt: number }>({
    start: 0,
    raf: 0,
    full: false,
    pressed: false,
    done: false,
    downAt: -Infinity,
  });
  const [pressing, setPressing] = useState(false);
  const [full, setFull] = useState(false);
  const complete = useRef(onComplete);
  useEffect(() => {
    complete.current = onComplete;
  });

  const paint = (p: number) => btn.current?.style.setProperty("--hold", p.toFixed(4));

  /** `keys`: pressed from a keyboard or by assistive tech, not held. */
  const finish = (keys = false) => {
    const s = state.current;
    if (s.done) return;
    s.done = true;
    complete.current(keys);
  };

  /* Empties from wherever it was let go. */
  const release = () => {
    const s = state.current;
    cancelAnimationFrame(s.raf);
    s.pressed = false;
    setPressing(false);
    if (s.full || s.done) return;
    const from = Number(btn.current?.style.getPropertyValue("--hold") || 0);
    const t0 = performance.now();
    const back = (now: number) => {
      const k = Math.min(1, (now - t0) / 240);
      paint(from * (1 - (1 - Math.pow(1 - k, 3))));
      if (k < 1 && !state.current.pressed) s.raf = requestAnimationFrame(back);
    };
    s.raf = requestAnimationFrame(back);
  };

  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const s = state.current;
    if (s.done) return;
    cancelAnimationFrame(s.raf);
    s.pressed = true;
    s.downAt = performance.now();
    s.full = false;
    setFull(false);
    setPressing(true);
    const from = Number(btn.current?.style.getPropertyValue("--hold") || 0);
    s.start = performance.now() - from * HOLD_MS;
    const fill = (now: number) => {
      const p = Math.min(1, (now - s.start) / HOLD_MS);
      paint(p);
      if (p >= 1) {
        s.full = true;
        setFull(true);
        buzz(12);
        return;
      }
      s.raf = requestAnimationFrame(fill);
    };
    s.raf = requestAnimationFrame(fill);
  };

  /* The lift. A finger's is its touchend (the gesture WebKit asks for);
     a mouse's is its pointerup. */
  useEffect(() => {
    const el = btn.current;
    if (!el) return;
    const onTouchEnd = () => {
      if (state.current.full) finish();
      else release();
    };
    const onTouchCancel = () => {
      if (state.current.full) finish();
      else release();
    };
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchCancel);
    return () => {
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      ref={btn}
      type="button"
      data-room-hold=""
      data-pressing={pressing ? "" : undefined}
      data-full={full ? "" : undefined}
      className="room-hold press"
      onPointerDown={press}
      onPointerUp={(e) => {
        if (e.pointerType === "touch") return; // its touchend decides
        if (state.current.full) finish();
        else release();
      }}
      onPointerCancel={(e) => {
        if (e.pointerType === "touch") return;
        release();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse" && state.current.pressed && !state.current.full) release();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        /* A keyboard's or an assistive press: no pointer went down on it
           just now, so there is no hold to ask for. A finger's or a
           mouse's click was already decided at the lift. */
        if (e.detail === 0 || performance.now() - state.current.downAt > 1500) finish(true);
      }}
    >
      <span className="room-hold-label">{label}</span>
      <span aria-hidden className="room-hold-fill">
        <span className="room-hold-label">{label}</span>
      </span>
      <TapTick />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* The room.                                                           */
/* ------------------------------------------------------------------ */

export function Room({
  script = INTERVIEW,
  onDone,
  onSkip,
}: {
  script?: RoomScript;
  /** Demos's Next: into the questions. */
  onDone: () => void;
  /** Not now, or Skip mid-scene: into the questions, without the scene. */
  onSkip: () => void;
}) {
  const host = useRef<HTMLElement>(null);
  const [reduced] = useState(
    () => typeof document !== "undefined" && document.documentElement.dataset.motion === "reduce"
  );
  const [store] = useState(createTiltStore);
  const recentre = useRoomTilt(store, host, reduced);

  const [stage, setStage] = useState<Stage>("door");
  const [doorFading, setDoorFading] = useState(false);
  const [who, setWho] = useState<RoomArtProps["who"]>(null);
  const [mood, setMood] = useState<RoomMood>("idle");
  const [his, setHis] = useState<Line | null>(null);
  const [beat, setBeat] = useState<string>("door");
  const [turn, setTurn] = useState<string | null>(null);
  const [mic, setMic] = useState<Ask | "asking" | null>(null);
  const [said, setSaid] = useState("");
  const [demos, setDemos] = useState<Line[]>([]);
  const [demosLines, setDemosLines] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [verdict, setVerdict] = useState<RoomVerdict | null>(null);

  const popper = useRef<Popper | null>(null);
  const abort = useRef<AbortController | null>(null);
  const endTurn = useRef<(() => void) | null>(null);
  const meter = useRef<HTMLDivElement>(null);
  const doneBtn = useRef<HTMLButtonElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const keys = useRef(0);

  /* Demos's pose is fetched while the scene plays. */
  useEffect(() => {
    preloadPose("speaking", 128);
  }, []);

  /* Leaving, by any door: every timer, the mic and the sound let go. */
  useEffect(
    () => () => {
      abort.current?.abort();
      popper.current?.close();
      popper.current = null;
    },
    []
  );

  /* A hidden page ends a turn rather than listening to a pocket. */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") endTurn.current?.();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  /* Someone who came in from the keyboard is handed the one control as
     it comes: Done for each turn, then Next. A finger is not: a ring
     drawn round a button nobody reached for reads as a fault. */
  const fromKeys = useRef(false);
  useEffect(() => {
    if (turn && fromKeys.current) doneBtn.current?.focus({ preventScroll: true });
  }, [turn]);
  useEffect(() => {
    if (ready && fromKeys.current) nextBtn.current?.focus({ preventScroll: true });
  }, [ready]);

  const leave = (to: () => void) => {
    abort.current?.abort();
    endTurn.current?.();
    to();
  };

  /** A line, streamed chunk by chunk with a pop under each. */
  const stream = (voice: PopVoice, text: string, signal: AbortSignal, onPlan: (l: Line) => void, onShown: (n: number) => void) =>
    new Promise<StreamPlan>((resolve) => {
      const plan = planStream(text, { reduced });
      const key = ++keys.current;
      onPlan({ key, plan, shown: 0 });
      setSaid(text);
      const stop = playStream(
        plan,
        (i) => {
          onShown(i + 1);
          popper.current?.pop(voice);
        },
        () => resolve(plan)
      );
      signal.addEventListener(
        "abort",
        () => {
          stop();
          resolve(plan);
        },
        { once: true }
      );
    });

  const sleep = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(resolve, ms);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          resolve();
        },
        { once: true }
      );
    });

  /** One turn: the mic open, its level read every frame, until the turn ends. */
  const listen = (b: Extract<RoomBeat, { kind: "turn" }>, signal: AbortSignal): Promise<TurnTrace | null> =>
    openMic(popper.current?.context ?? null).then(
      (m) =>
        new Promise<TurnTrace | null>((resolve) => {
          if (signal.aborted) {
            m.close();
            resolve(null);
            return;
          }
          const gate = createVoiceGate(ruleOf(b));
          const samples: LevelSample[] = [];
          const t0 = performance.now();
          let raf = 0;
          let over = false;
          const bars = () => meter.current?.querySelectorAll<HTMLElement>("span") ?? [];
          const finish = () => {
            if (over) return;
            over = true;
            cancelAnimationFrame(raf);
            m.close();
            endTurn.current = null;
            setTurn(null);
            resolve({ samples });
          };
          endTurn.current = finish;
          signal.addEventListener("abort", finish, { once: true });
          setTurn(b.id);
          setSaid(ROOM_COPY.yourTurn);
          const tick = () => {
            const at = performance.now() - t0;
            const level = m.level();
            samples.push({ at, level });
            const g = gate.push(level, at);
            /* Five bars on one level, each with its own sway, so the
               meter reads as a voice and not as one bar five times. */
            const list = bars();
            for (let k = 0; k < list.length; k++) {
              const sway = 0.62 + 0.38 * Math.sin(at / (90 + k * 23) + k * 1.7);
              list[k].style.setProperty("--l", (g.meter * sway).toFixed(3));
            }
            if (g.ended) {
              finish();
              return;
            }
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }),
      () => null
    );

  /** The scene, beat by beat, then Demos. */
  const direct = async (micAnswer: Promise<Ask>, signal: AbortSignal) => {
    await sleep(reduced ? 300 : ENTER_MS, signal);
    const traces: TurnTrace[] = [];
    let heard = true;
    /* The mic's answer, when it comes: the first line streams while the
       phone is still asking, and only a turn waits for it. */
    const asked: { answer: Ask | null } = { answer: null };
    void micAnswer.then((a) => {
      asked.answer = a;
      setMic(a);
      /* The prompt's stream is let go: the pops follow the switch again. */
      setAudioSession("ambient");
    });
    for (const b of script.beats) {
      if (signal.aborted) return;
      setBeat(b.id);
      if (b.kind === "line") {
        setMood(b.mood);
        setWho("interviewer");
        const plan = await stream("him", b.text, signal, setHis, (n) =>
          setHis((h) => (h ? { ...h, shown: n } : h))
        );
        setWho(null);
        await sleep(plan.holdMs, signal);
        continue;
      }
      setMood(b.mood);
      const a = asked.answer ?? (await micAnswer);
      if (signal.aborted) return;
      if (a !== "granted" || !heard) {
        heard = false;
        await sleep(NO_MIC_BEAT_MS, signal);
        continue;
      }
      setWho("you");
      const trace = await listen(b, signal);
      setWho(null);
      if (signal.aborted) return;
      if (!trace) {
        heard = false;
        setMic("unavailable");
      } else {
        traces.push(trace);
      }
      await sleep(AFTER_TURN_MS, signal);
    }
    if (signal.aborted) return;

    /* Demos steps in, in words only. What he will say is known before
       he says it, so his bubble's room is held from the first frame. */
    const call = heard ? roomVerdict(traces) : null;
    const lines = call ? [script.verdict[call], ...script.after] : [script.noMic];
    setVerdict(call);
    setDemosLines(lines);
    setBeat("demos");
    setWho(null);
    setStage("ending");
    setHis(null);
    await sleep(reduced ? 200 : DEMOS_IN_MS, signal);
    for (let k = 0; k < lines.length; k++) {
      if (signal.aborted) return;
      const index = k;
      const plan = await stream(
        "demos",
        lines[k],
        signal,
        (l) => setDemos((d) => [...d.slice(0, index), l]),
        (n) => setDemos((d) => d.map((l, j) => (j === index ? { ...l, shown: n } : l)))
      );
      if (k < lines.length - 1) await sleep(holdFor(plan.text), signal);
    }
    if (signal.aborted) return;
    setReady(true);
  };

  /** Inside the lift: the sound, the mic and motion asked, then the scene. */
  const enter = (viaKeys: boolean) => {
    fromKeys.current = viaKeys;
    popper.current = createPopper();
    const micAnswer = askMic();
    void askMotion();
    setMic("asking");
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    recentre();
    setStage("scene");
    setBeat("enter");
    /* The door stays a moment, fading, after the lift: an iPhone delivers
       the tap's click (and with it TapTick's tick) after the touchend
       that opened the room, and a button already gone cannot tick. */
    setDoorFading(true);
    window.setTimeout(() => setDoorFading(false), DOOR_FADE_MS);
    void direct(micAnswer, ctl.signal);
  };

  /* Keyed by line: each line is a new bubble, with its own entrance. */
  const bubble = his ? <HisBubble key={his.key} line={his} /> : undefined;

  return (
    <main
      ref={host}
      className="room"
      data-stage={stage}
      data-beat={beat}
      data-turn={turn ?? undefined}
      data-mic={mic ?? undefined}
      data-verdict={verdict ?? undefined}
    >
      <h1 className="sr-only">{script.name}</h1>
      <div aria-hidden className="room-art">
        <TiltedArt store={store} who={who} mood={mood} reduceMotion={reduced} bubble={bubble} />
      </div>
      <div aria-hidden className="room-dim" />
      <div aria-hidden className="room-shade" />

      {/* Every line, once, whole, as it begins. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {said}
      </p>

      {(stage === "door" || doorFading) && (
        <div className="room-door-layer" data-fading={doorFading ? "" : undefined}>
          <div className="room-top">
            <Link href="/signin" className="room-link">
              {ROOM_COPY.signIn}
            </Link>
            {/* The tester's door (docs/testers.md): the quietest thing on
                the first screen, where it has always been. */}
            <Link href="/tester?from=welcome" className="room-link">
              {DOOR_COPY.welcome}
            </Link>
          </div>
          <div className="room-foot room-door">
            <HoldToStep label={ROOM_COPY.hold} onComplete={enter} />
            <button type="button" className="room-link room-not-now" onClick={() => leave(onSkip)}>
              {ROOM_COPY.notNow}
            </button>
          </div>
        </div>
      )}

      {stage === "scene" && !doorFading && (
        <div className="room-top room-top-end">
          <button type="button" className="room-link" onClick={() => leave(onSkip)}>
            {ROOM_COPY.skip}
          </button>
        </div>
      )}

      {stage === "scene" && turn && (
        <div className="room-foot">
          <div className="room-turn" data-room-turn={turn}>
            <div ref={meter} aria-hidden className="room-meter">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <span className="room-turn-label">{ROOM_COPY.yourTurn}</span>
            <button
              ref={doneBtn}
              type="button"
              className="room-tap press"
              onClick={() => endTurn.current?.()}
            >
              {ROOM_COPY.done}
              <TapTick />
            </button>
          </div>
        </div>
      )}

      {stage === "ending" && (
        /*
         * Demos steps in on a sheet of the app's own ground, in the grammar
         * of the screen that follows him (the name question): his coin at
         * the left, his bubble beside it. Short, so the room stays in view
         * above him, and the walk's next screen is the same shape.
         */
        <div className="room-sheet rounded-t-sheet">
          <div className="flex items-start gap-3">
            <div className="relative size-[clamp(96px,14vh,128px)] shrink-0 [container-type:size]">
              <IntroDemos pose="speaking" size={128} fit pop halo={{ tone: "sky", kind: "coin" }} />
            </div>
            {/* His bubble's room, held at its full size from the first
                frame by the whole of what he will say, drawn invisibly; the
                bubble he speaks from grows inside it from the tail down, so
                nothing moves as his words land. */}
            <div className="relative min-w-0 flex-1" data-room-demos="">
              <SpeechBubble tail="left" voice="lead" className="invisible">
                <div aria-hidden>
                  {demosLines.map((t, k) => (
                    <p key={k} className={k > 0 ? "mt-1" : undefined}>
                      {t}
                    </p>
                  ))}
                </div>
              </SpeechBubble>
              {demos.length > 0 && (
                /* The layer is what is placed: the bubble keeps its own
                   `relative`, which its tail is drawn against. */
                <div className="absolute inset-x-0 top-0">
                  <SpeechBubble tail="left" voice="lead" className="room-demos-bubble">
                    <Grow fill>
                      <div aria-hidden>
                        {demos.map((l, k) => (
                          <p key={l.key} className={k > 0 ? "mt-1" : undefined}>
                            <Chunks plan={l.plan} shown={l.shown} />
                          </p>
                        ))}
                      </div>
                    </Grow>
                  </SpeechBubble>
                </div>
              )}
            </div>
          </div>
          <div className="room-sheet-foot">
            <button
              ref={nextBtn}
              type="button"
              className={`${ACTION_CLASS} ${ready ? "arrive" : "invisible"}`}
              disabled={!ready}
              onClick={() => leave(onDone)}
            >
              {ROOM_COPY.next}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
