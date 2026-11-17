"use client";

import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { preloadPose } from "@/components/DemosArt";
import { IntroDemos } from "@/components/IntroDemos";
import { SpeechBubble } from "@/components/SpeechBubble";
import { TapTick } from "@/components/ui/TapTick";
import { DOOR_COPY } from "@/content/tester";
import { setAudioSession } from "@/lib/audio-session";
import { buzz } from "@/lib/prefs";
import { askMic, askMotion, openMic, whenVisible, type Ask } from "@/lib/room-media";
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
/** Demos's sheet rising over the whole room on Next, before the name. */
const HAND_OFF_MS = 520;
/**
 * Where the tilt counts as landed, on the -1 to 1 scale: 0.04 of a degree,
 * a tenth of a pixel on the pen, the deepest layer. Closer than this the
 * frame loop stops rather than redraw a room nobody can see move.
 */
const TILT_REST = 0.002;

type Stage = "door" | "scene" | "ending";

type Line = { key: number; plan: StreamPlan; shown: number };

/** A turn heard. `cut`: the page was put away before it ended. */
type Heard = { trace: TurnTrace; cut: boolean };

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
 *
 * The frame loop runs only while the room is moving: once the spring has
 * landed on where the phone points it stops, and the next reading that
 * moves the room wakes it. A hidden page stops it outright; back in
 * front, the centre is how the phone is held then. Leaving the room
 * (Next, Skip, Not now) stops it with everything else.
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
    let sx: Axis = { p: 0, v: 0 };
    let sy: Axis = { p: 0, v: 0 };
    let last = 0;
    let raf = 0;
    const hidden = () => document.visibilityState === "hidden";
    const settled = () =>
      Math.abs(sx.p - target.x) < TILT_REST &&
      Math.abs(sy.p - target.y) < TILT_REST &&
      Math.abs(sx.v) < TILT_REST * 10 &&
      Math.abs(sy.v) < TILT_REST * 10;
    const draw = () => {
      store.set({ x: sx.p, y: sy.p });
      const el = host.current;
      if (el) {
        el.style.setProperty("--room-tilt-x", sx.p.toFixed(4));
        el.style.setProperty("--room-tilt-y", sy.p.toFixed(4));
      }
    };
    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      sx = springStep(sx, target.x, dt);
      sy = springStep(sy, target.y, dt);
      const rest = settled();
      if (rest) {
        sx = { p: target.x, v: 0 };
        sy = { p: target.y, v: 0 };
      }
      draw();
      if (!rest && !hidden()) raf = requestAnimationFrame(tick);
    };
    /* A new place to go: the loop runs again, if it had stopped. */
    const aim = (t: Tilt) => {
      target = t;
      if (raf || hidden() || settled()) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (typeof e.beta !== "number" || typeof e.gamma !== "number") return;
      motion = true;
      aim(tracker.current.update(inScreen({ beta: e.beta, gamma: e.gamma }, screenAngle()), performance.now()));
    };
    const onMove = (e: PointerEvent) => {
      if (motion || e.pointerType !== "mouse") return;
      const r = host.current?.getBoundingClientRect();
      if (!r) return;
      aim(pointerTilt(e.clientX - r.left, e.clientY - r.top, r.width, r.height));
    };
    const onLeave = () => {
      if (!motion) aim(ZERO);
    };
    const onShow = () => {
      if (hidden()) {
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      /* Back in front: the centre is how the phone is held now. */
      tracker.current.reset();
      aim(ZERO);
    };
    window.addEventListener("deviceorientation", onOrient);
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onShow);
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

/**
 * The chunks landed so far, each popping in as it lands. Each word is its
 * own box, so a chunk of two ("hear you,") pops in together but wraps
 * between its words exactly as the plain line does: the whole line, set
 * invisibly, holds the bubble's room, and a chunk that would not break
 * where the line breaks wrapped a line further, past that room and, on
 * a 320 screen, over Next.
 */
function Chunks({ plan, shown }: { plan: StreamPlan; shown: number }) {
  return (
    <>
      {plan.chunks.slice(0, shown).map((c, i) => (
        <span key={i}>
          {c.text
            .trim()
            .split(/\s+/)
            .map((w, j) => (
              <Fragment key={j}>
                {(i > 0 || j > 0) && " "}
                <span className="room-chunk">{w}</span>
              </Fragment>
            ))}
        </span>
      ))}
    </>
  );
}

/**
 * A box that grows to its words, a line at a time: the words are laid
 * out at the box's width (which the whole line has already set), and its
 * height follows them on a short curve, so a line wrapping grows the
 * bubble smoothly and nothing already there moves.
 */
function Grow({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="room-grow" style={height === null ? undefined : { height }}>
      <div ref={inner}>{children}</div>
    </div>
  );
}

/**
 * His speech: a white bubble the art places over his head. Seen, not
 * read (the live region reads it).
 *
 * It streams the way an AI chat does: the bubble opens at the width the
 * whole line will take (a hidden copy of the line sets it, so it never
 * slides or reflows while the words land), the words arrive a chunk at a
 * time, and the bubble grows a line at a time upward as they wrap.
 *
 * Where it stands is CSS, from the art's two lengths: a bubble wider than
 * the room right of the anchor slides back left over his head by the
 * difference, its tail sliding the other way along its foot so it stays
 * on the anchor (`.room-bubble`). The art glides the anchor between his
 * poses and the slide glides with it. Its own width is measured once,
 * here, because it is the one length the CSS cannot know.
 */
function HisBubble({ line }: { line: Line }) {
  const bubble = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const b = bubble.current;
    if (!b) return;
    const measure = () => b.style.setProperty("--room-bubble-w", `${b.offsetWidth}px`);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="room-bubble-shell" aria-hidden>
      <div ref={bubble} className="room-bubble" data-room-line={line.key}>
        <p className="room-bubble-ghost">{line.plan.text}</p>
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
  const state = useRef<{
    start: number;
    raf: number;
    full: boolean;
    pressed: boolean;
    done: boolean;
    downAt: number;
    /** The pointer that last went down on it: "touch" is a finger. */
    downType: string;
  }>({
    start: 0,
    raf: 0,
    full: false,
    pressed: false,
    done: false,
    downAt: -Infinity,
    downType: "",
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
    s.downType = e.pointerType;
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
        /* Only a finger is asked to hold: its tap or hold was decided at
           the lift. Anything else that presses it is let in on its click:
           a keyboard, VoiceOver or TalkBack (whose double tap can arrive
           as a quick pointer press of its own, never a held one), and a
           mouse, whose click is as much a gesture as its hold. */
        const s = state.current;
        if (e.detail === 0 || s.downType !== "touch" || performance.now() - s.downAt > 1500) finish(true);
      }}
    >
      <span className="room-hold-label room-hold-shine">{label}</span>
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
  signedIn = false,
  onDone,
  onSkip,
}: {
  script?: RoomScript;
  /** An account is signed in (#497): the door drops Sign in and Tester code. */
  signedIn?: boolean;
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
  /* Next pressed: where the sheet's top stood, for the ground rising from it. */
  const [handOff, setHandOff] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<RoomVerdict | null>(null);

  const popper = useRef<Popper | null>(null);
  const abort = useRef<AbortController | null>(null);
  /* Ends the turn now: Done, leaving, or the page put away ("hidden"). */
  const endTurn = useRef<((why?: "hidden") => void) | null>(null);
  const meter = useRef<HTMLDivElement>(null);
  const doneBtn = useRef<HTMLButtonElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
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

  /* A hidden page ends a turn rather than listening to a pocket, and the
     mic with it; the scene waits for the page to come back (`direct`),
     and the turn cut short is asked again then. */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") endTurn.current?.("hidden");
    };
    const onPageHide = () => endTurn.current?.("hidden");
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
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

  /**
   * One turn: the mic open, its level read every frame, until the turn
   * ends. `cut` when the page was put away mid-turn: what was heard is
   * dropped and the turn is asked again once the page is back.
   */
  const listen = (b: Extract<RoomBeat, { kind: "turn" }>, signal: AbortSignal): Promise<Heard | null> =>
    openMic(popper.current?.context ?? null).then(
      (m) =>
        new Promise<Heard | null>((resolve) => {
          if (signal.aborted) {
            m.close();
            resolve(null);
            return;
          }
          /* Put away while the phone was opening the mic: let it go again
             before a frame is heard, and ask for the turn once back. */
          if (document.visibilityState === "hidden") {
            m.close();
            resolve({ trace: { samples: [] }, cut: true });
            return;
          }
          const gate = createVoiceGate(ruleOf(b));
          const samples: LevelSample[] = [];
          const t0 = performance.now();
          let raf = 0;
          let over = false;
          const bars = () => meter.current?.querySelectorAll<HTMLElement>("span") ?? [];
          const finish = (why?: "hidden") => {
            if (over) return;
            over = true;
            cancelAnimationFrame(raf);
            m.close();
            endTurn.current = null;
            setTurn(null);
            resolve({ trace: { samples }, cut: why === "hidden" });
          };
          endTurn.current = finish;
          signal.addEventListener("abort", () => finish(), { once: true });
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
      /* A phone put away waits here: nothing streams to a pocket. */
      await whenVisible(document, signal);
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
      let got = await listen(b, signal);
      /* Put away mid-turn: the mic closed with the page, and the turn is
         asked again, whole, once the page is back. */
      while (got?.cut && !signal.aborted) {
        await whenVisible(document, signal);
        if (signal.aborted) return;
        got = await listen(b, signal);
      }
      setWho(null);
      if (signal.aborted) return;
      if (!got) {
        heard = false;
        setMic("unavailable");
      } else {
        traces.push(got.trace);
      }
      await sleep(AFTER_TURN_MS, signal);
    }
    await whenVisible(document, signal);
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
      await whenVisible(document, signal);
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

  const lastBeat = script.beats[script.beats.length - 1]?.id;

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
          {/* Someone signed in to an account that has not done the
              introduction meets the door too (#497): neither door is
              theirs to use, so the row stands empty at its height. */}
          <div className="room-top">
            {!signedIn && (
              <>
                <Link href="/signin" className="room-link">
                  {ROOM_COPY.signIn}
                </Link>
                {/* The tester's door (docs/testers.md): the quietest thing on
                    the first screen, where it has always been. */}
                <Link href="/tester?from=welcome" className="room-link">
                  {DOOR_COPY.welcome}
                </Link>
              </>
            )}
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
        /* Skip steps back once his last line starts: there is nothing
           left to skip, and on a short phone his longest line reaches up
           into this row. */
        <div className="room-top room-top-end" data-gone={beat === lastBeat ? "" : undefined}>
          <button
            type="button"
            className="room-link"
            tabIndex={beat === lastBeat ? -1 : undefined}
            aria-hidden={beat === lastBeat ? true : undefined}
            onClick={() => leave(onSkip)}
          >
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

      {handOff !== null && (
        <div aria-hidden className="room-cover" style={{ "--room-cover-from": `${handOff}px` } as CSSProperties} />
      )}

      {stage === "ending" && (
        /*
         * Demos steps in on a sheet of the app's own ground, in the grammar
         * of the screen that follows him (the name question): his coin at
         * the left, his bubble beside it. Short, so the room stays in view
         * above him, and the walk's next screen is the same shape.
         */
        <div ref={sheet} className="room-sheet rounded-t-sheet" data-leaving={handOff === null ? undefined : ""}>
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
                    <Grow>
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
              onClick={() => {
                if (handOff !== null) return;
                /* The hand-off: the app's ground rises from the sheet's
                   top over the room, Demos's words fade, and the name
                   question comes up on the same ground, so the walk goes
                   on from the room rather than cutting away from it. */
                setHandOff(sheet.current?.offsetTop ?? 0);
                window.setTimeout(() => {
                  if (!abort.current?.signal.aborted) leave(onDone);
                }, reduced ? 200 : HAND_OFF_MS);
              }}
            >
              {ROOM_COPY.next}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
