"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AudioScrubber } from "@/components/AudioScrubber";
import { Coin } from "@/components/Coin";
import { GainsRow } from "@/components/GainsRow";
import { ModeToggle } from "@/components/ModeToggle";
import { Moment } from "@/components/Moment";
import { ComparisonCard } from "@/components/ComparisonCard";
import { Paywall, type PaywallAsk } from "@/components/Paywall";
import { PermissionHelp } from "@/components/PermissionHelp";
import { PoseSkeleton } from "@/components/PoseSkeleton";
import { PresenceDetail, PresenceScore } from "@/components/PresenceCard";
import { RepResult } from "@/components/RepResult";
import { StreakCelebration } from "@/components/StreakCelebration";
import { ErrorState } from "@/components/ui/ErrorState";
import { achievements } from "@/lib/achievements";
import {
  fetchProfile,
  fetchReps,
  fetchXp,
  type RepRow,
} from "@/lib/client-data";
import { syncCoins } from "@/lib/coin-sync";
import {
  ENVELOPE_RATE,
  serializeEnvelope,
  type Envelope,
} from "@/lib/envelope";
import { startCrowdNoise, type CrowdNoise } from "@/lib/crowd-noise";
import { sessionState } from "@/lib/auth";
import { syncFreezes } from "@/lib/freeze-sync";
import { trainedDays } from "@/lib/days";
import {
  gateMoment,
  gatesShown,
  markGateShown,
  type GateMoment,
} from "@/lib/onboarding";
import {
  markProMomentShown,
  PRO_MOMENT_DAYS,
  proMomentDue,
  proMomentShown,
} from "@/lib/pro-moment";
import { starsByLesson, totalStars, unitStates } from "@/lib/path";
import { liveTipAt } from "@/lib/live-tips";
import { loadPose, samplePose, type PoseSampler } from "@/lib/pose-client";
import {
  ringNote,
  ringState,
  scorePresence,
  type PoseFrame,
  type PresenceResult,
  type RingState,
} from "@/lib/presence";
import {
  buzz,
  captureModeFor,
  readPrefs,
  writeCaptureMode,
  writePrefs,
  type CaptureMode,
} from "@/lib/prefs";
import { armReminder } from "@/lib/reminders";
import { nextMilestones, repGains, type RepGain } from "@/lib/progress";
import {
  anticipation,
  endNote,
  personalBests,
  type RewardMoment,
} from "@/lib/rewards";
import { nextFocus, type NextFocus } from "@/lib/schedule";
import { unlockSfx } from "@/lib/sfx";
import { computeStreak } from "@/lib/streak";
import { nextDrill } from "@/lib/drills";
import { draw, gameById } from "@/lib/games";
import { repHref, resolveRepConfig, type RepConfig } from "@/lib/rep-config";
import {
  clearInFlight,
  markInFlight,
  newOutboxId,
  outboxDelete,
  outboxPut,
  replayForm,
  sendWithRetry,
  type OutboxRep,
} from "@/lib/rep-outbox";
import { ensureSession } from "@/lib/supabase-browser";
import type { AnalyzeResponse } from "@/app/api/analyze/route";

const METER_BARS = 36;
const FRAME_SECONDS = 30;

/**
 * The live ring's nudge colour (§2: "the ring goes amber on slouch,
 * hands leaving frame, eyes dropping").
 *
 * It was amber, flagged in place as the one screen where the colour
 * carried attention rather than achievement — the exact trade DECISIONS
 * #65 warned about. #127 takes the other side of it: the nudge gives up
 * the earned colour (sage since #165) and the hold counter takes it, so it means "you earned
 * this" everywhere without exception. Visibility didn't depend on the
 * hue anyway; it depends on the ring going 2px → 4px, the skeleton
 * dimming, and the note appearing under it.
 */
const RING_TONE = "ring-stone-400";

/**
 * Seconds of a clean ring before the hold counter appears. Below this
 * it would flicker on and off through normal movement, which reads as a
 * broken indicator rather than an achievement.
 */
const HOLD_REVEAL_S = 4;

/** Demos' one interruption. Short, specific, never insulting. */
const INTERRUPTIONS = [
  "So what?",
  "Says who?",
  "Give me an example.",
  "Why does that matter?",
  "Get to the point.",
];

/** A failure we already have words for. Anything else gets the generic. */
class ScoringFailure extends Error {}

type Phase =
  | "idle"
  | "frame"
  | "recording"
  | "analyzing"
  | "results"
  | "error";

export default function RepPage() {
  return (
    <Suspense fallback={<main className="px-5 pt-7" />}>
      <RepScreen />
    </Suspense>
  );
}

function RepScreen() {
  const searchParams = useSearchParams();
  const [premium, setPremium] = useState(false);

  useEffect(() => {
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => {});
  }, []);

  // The path can request a lesson, the boss screen a topic, and either
  // can stack stress mods. One resolver answers all of it.
  const config = useMemo(
    () =>
      resolveRepConfig({
        lesson: searchParams.get("lesson"),
        boss: searchParams.get("boss"),
        topic: searchParams.get("topic"),
        game: searchParams.get("game"),
        q: searchParams.get("q"),
        mods: searchParams.get("mods"),
        premium,
      }),
    [searchParams, premium]
  );

  const [phase, setPhase] = useState<Phase>("idle");
  /**
   * "Next lesson" links to /rep?lesson=… — the SAME route, so Next.js
   * keeps this component mounted and every piece of state with it. The
   * URL changed, `phase` stayed "results", and the screen sat there
   * showing the rep you just finished. Reported by Timothy as "the next
   * lesson button doesn't take you to the next lesson".
   *
   * Resetting on lessonId is what makes the navigation real.
   */
  const lessonKey = `${searchParams.get("lesson") ?? ""}|${searchParams.get("topic") ?? ""}|${searchParams.get("boss") ?? ""}|${searchParams.get("game") ?? ""}:${searchParams.get("q") ?? ""}`;
  const lessonKeyRef = useRef(lessonKey);
  const [seconds, setSeconds] = useState(0);
  const [frameLeft, setFrameLeft] = useState(FRAME_SECONDS);
  const [levels, setLevels] = useState<number[]>(Array(METER_BARS).fill(0.05));
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The mic (or camera) was refused or absent; owns the error phase. */
  const [micBlock, setMicBlock] = useState<null | {
    video: boolean;
    missing: boolean;
  }>(null);
  /**
   * The recording that failed to score, held so "Score it again" can
   * mean it. Cleared the moment a result lands.
   */
  const pendingRef = useRef<{ form: FormData; outboxId: string | null } | null>(
    null
  );
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [interruption, setInterruption] = useState<string | null>(null);
  const [gains, setGains] = useState<RepGain[]>([]);
  const [anticipate, setAnticipate] = useState<RewardMoment | null>(null);
  const [closing, setClosing] = useState<RewardMoment | null>(null);
  const [bests, setBests] = useState<RewardMoment[]>([]);
  const [notes, setNotes] = useState("");
  const [tomorrow, setTomorrow] = useState<NextFocus | null>(null);
  const [coined, setCoined] = useState(false);

  // --- delivery feedback (§1) ---------------------------------------
  const [captureMode, setCaptureMode] = useState<CaptureMode>("voice");
  const [poseReady, setPoseReady] = useState<boolean | null>(null);
  const [ring, setRing] = useState<RingState>("ok");
  /**
   * The sampler's live frame array, handed over once when sampling
   * starts. Held rather than copied: it's mutated in place at 30fps and
   * the overlay reads the last entry inside its own draw loop, so
   * pushing frames through React state would be 30 renders a second to
   * paint one canvas.
   */
  const [poseFrames, setPoseFrames] = useState<PoseFrame[] | null>(null);
  /** Seconds the ring has been clean. The live "you're doing it" signal. */
  const [heldS, setHeldS] = useState(0);
  const [presence, setPresence] = useState<PresenceResult | null>(null);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  /** The recording itself, held locally so the debrief can replay it. */
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<PaywallAsk | null>(null);
  const [repCount, setRepCount] = useState<number | null>(null);
  /** The stored list AFTER this recording landed, for the debrief's
   *  day-3 progress moment (the comparison card needs both ends). */
  const [repsNow, setRepsNow] = useState<RepRow[]>([]);
  /**
   * For the save-progress wall (DECISIONS #134). Anonymity is read
   * AFTER the analysis, not on mount — rep 1 has no session until the
   * upload mints one, so a mount-time check would say "not anonymous"
   * on exactly the rep the wall exists for.
   */
  const [anon, setAnon] = useState(false);
  const [streakNow, setStreakNow] = useState(0);

  /**
   * Sticky per drill type, with one override: rep 1 is audio, always.
   * Camera permission before someone has felt the product work is the
   * most expensive ask in the funnel, so Voice + Video is offered on
   * rep 2 as the thing no other daily app gives you.
   */
  useEffect(() => {
    if (repCount === null) return;
    setCaptureMode(captureModeFor(config.kind, repCount));
  }, [config.kind, repCount]);

  /**
   * Snapshot of where the user stood BEFORE this rep, captured on
   * mount. Without it the results screen can't say what changed, and
   * "what changed" is the only reward worth showing (DECISIONS #46).
   */
  const baselineRef = useRef<{
    stars: number;
    unitsOpen: string[];
    reps: RepRow[];
  } | null>(null);

  /**
   * Is on-device pose actually available here? Asked once, before the
   * toggle is drawn, so Voice + Video is never offered by a browser
   * that can't measure anything.
   */
  useEffect(() => {
    let live = true;
    loadPose()
      .then((p) => live && setPoseReady(p !== null))
      .catch(() => live && setPoseReady(false));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    fetchReps()
      .then(async (rows) => {
        setRepCount(rows.length);
        const map = starsByLesson(rows);
        baselineRef.current = {
          stars: totalStars(map),
          unitsOpen: unitStates(map)
            .filter((u) => !u.locked)
            .map((u) => u.name),
          reps: rows,
        };
        const streak = computeStreak(rows.map((r) => new Date(r.created_at)));
        const xp = await fetchXp().catch(() => ({ total: 0, week: 0 }));
        setAnticipate(
          anticipation(
            nextMilestones({
              reps: rows,
              starMap: map,
              streak,
              xp: xp.total,
              freezesEquipped: 0,
              achievements: achievements(rows),
            }),
            streak
          )
        );
      })
      .catch(() => {});
  }, []);

  const recRef = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    ctx: AudioContext;
    raf: number;
    chunks: Blob[];
    crowd: CrowdNoise | null;
    interruptTimer: ReturnType<typeof setTimeout> | null;
    /** Local-only video recorder. Its blob never touches the network. */
    videoRecorder: MediaRecorder | null;
    videoChunks: Blob[];
    sampler: PoseSampler | null;
    /**
     * Loudness envelope. The meter already computes RMS every frame;
     * this keeps it at a fixed rate so the engine can ask whether a gap
     * between two words was actually silent (lib/envelope.ts).
     */
    envelope: number[];
    envelopeAt: number;
  } | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const configRef = useRef<RepConfig>(config);
  configRef.current = config;
  const captureModeRef = useRef<CaptureMode>(captureMode);
  captureModeRef.current = captureMode;

  const teardown = useCallback(() => {
    const r = recRef.current;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    if (r.interruptTimer) clearTimeout(r.interruptTimer);
    r.sampler?.stop();
    r.crowd?.stop();
    r.stream.getTracks().forEach((t) => t.stop());
    // The context outlives the fade-out of the crowd bed by design.
    setTimeout(() => void r.ctx.close().catch(() => {}), 400);
    recRef.current = null;
  }, []);

  /**
   * Send a recording to be scored.
   *
   * Split out of `stopRep` and handed a built form on purpose: a failure
   * can then offer the only thing worth offering, which is the same audio
   * sent again. Losing ninety seconds of speaking to one bad minute of
   * wifi is the worst failure in the product, and until now the error
   * card named the breakage and left you to record it from scratch.
   */
  const score = useCallback(async (form: FormData, outboxId: string | null) => {
    setPhase("analyzing");
    setError(null);
    if (outboxId) markInFlight(outboxId);
    try {
      // Anonymous-first (DECISIONS #15): attribute the rep if a session
      // exists or can be minted; never block the rep on auth.
      const token = await ensureSession();
      // Three retries with backoff for the failures waiting can fix
      // (network drops, gateway 5xx). The blob is already in the outbox,
      // so even a closed tab loses nothing (lib/rep-outbox.ts).
      // A gateway's 502 is HTML, and parsing it used to throw, so the
      // JSON parser's complaint ("Unexpected token <") became the
      // sentence the user read. Ours are the only words that reach them.
      const outcome = await sendWithRetry(form, token);
      if (!outcome.ok || !outcome.data) {
        throw new ScoringFailure(
          outcome.status === 503
            ? "Scoring is offline right now."
            : outcome.status === 429
              ? ((outcome.data as { error?: string } | null)?.error ??
                "That's the practice limit for now.")
              : "The scoring server didn't answer."
        );
      }
      const data = outcome.data;
      // The outbox copy leaves only once the server confirmed the rep
      // is stored (or nothing was ever going to store it: local mode).
      if (outboxId && outcome.settled) void outboxDelete(outboxId);
      setResult(data as AnalyzeResponse);
      setPhase("results");
      pendingRef.current = null;
      // Streak is derived from stored reps, so read it back rather than
      // guessing — a rep that failed to persist shouldn't celebrate.
      const analyzed = data as AnalyzeResponse;
      fetchReps()
        .then(async (reps) => {
          setRepsNow(reps);
          const dates = reps.map((x) => new Date(x.created_at));
          const { streak } = await syncFreezes(dates);
          if (streak.current > 0) setCelebrate(streak.current);
          setStreakNow(streak.current);
          // Re-arm the reminder now that today's practice is DONE. A
          // reminder armed this morning is still scheduled for this
          // evening; arming again cancels it and books tomorrow's
          // instead (lib/reminders.ts) — a nudge to do a thing you
          // already did teaches people to kill the channel.
          void armReminder({
            streak: streak.current,
            didToday: streak.didToday,
          });
          // The upload minted the session if there wasn't one, so this
          // is the earliest moment the answer is real.
          sessionState()
            .then((s) => setAnon(s.signedIn && s.anonymous))
            .catch(() => {});

          // One coin per day you spoke (§4). Granted from the stored
          // reps, so it heals rather than double-paying.
          syncCoins(dates)
            .then((c) => setCoined(c.granted.length > 0))
            .catch(() => {});

          const before = baselineRef.current;
          if (before) {
            const map = starsByLesson(reps);
            const openNow = unitStates(map)
              .filter((u) => !u.locked)
              .map((u) => u.name);
            const nextGains = repGains({
              starsBefore: before.stars,
              starsAfter: totalStars(map),
              indexBefore: analyzed.previousIndex,
              indexAfter: analyzed.ethosIndex,
              streakAfter: streak.current,
              unlockedUnit:
                openNow.find((n) => !before.unitsOpen.includes(n)) ?? null,
            });
            setGains(nextGains);
            // before.reps is the history captured on mount — the true
            // "before", independent of whether this rep persisted.
            setBests(
              personalBests(before.reps, analyzed.metrics, analyzed.ethosIndex)
            );
            // Streak-end rule: the last thing on screen decides whether
            // they come back, so it is always something true and good.
            setTomorrow(nextFocus(reps));
            setClosing(
              endNote({
                gains: nextGains,
                metrics: analyzed.metrics,
                streak,
                repCount: reps.length,
              })
            );
          }
        })
        .catch(() => {});
    } catch (e) {
      // The audio stays in hand AND in IndexedDB, which is what makes
      // the retry real even across a closed tab.
      pendingRef.current = { form, outboxId };
      const offline =
        typeof navigator !== "undefined" && navigator.onLine === false;
      const lead = offline
        ? "You're offline."
        : e instanceof ScoringFailure
          ? e.message
          : "The scoring server didn't answer.";
      setError(
        offline
          ? `${lead} The recording is saved on this device and sends itself when you're back.`
          : `${lead} The recording is saved on this device.`
      );
      setPhase("error");
    } finally {
      if (outboxId) clearInFlight(outboxId);
    }
  }, []);

  /*
   * Back online with a failed recording on screen: send it without
   * being asked. The button stays for the impatient.
   */
  useEffect(() => {
    if (phase !== "error") return;
    const retry = () => {
      const p = pendingRef.current;
      if (p) void score(p.form, p.outboxId);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [phase, score]);

  const stopRep = useCallback(async () => {
    const r = recRef.current;
    if (!r || phaseRef.current !== "recording") return;
    buzz([20, 40, 20]);
    setPhase("analyzing");
    setInterruption(null);

    const blob = await new Promise<Blob>((resolve) => {
      r.recorder.onstop = () =>
        resolve(new Blob(r.chunks, { type: r.recorder.mimeType }));
      r.recorder.stop();
    });
    setAudioUrl(URL.createObjectURL(blob));

    // The loudness envelope, captured alongside the meter. This is what
    // lets the engine tell a silent gap from one the mic heard a sound
    // in — i.e. an "um" the transcript dropped.
    const envelope: Envelope = { levels: [...r.envelope], rate: ENVELOPE_RATE };

    // Score the body before tearing the camera down. Everything below
    // this line is five numbers and a list of timestamps — the frames
    // themselves are dropped with the sampler.
    const frames = r.sampler?.stop() ?? [];
    const scored = frames.length > 0 ? scorePresence(frames) : null;
    setPresence(scored?.scorable ? scored : null);

    // The local clip, for Pro playback with markers. Held as an object
    // URL in this tab and nowhere else — never uploaded, never stored.
    if (r.videoRecorder && r.videoRecorder.state !== "inactive") {
      const clip = await new Promise<Blob>((resolve) => {
        r.videoRecorder!.onstop = () =>
          resolve(new Blob(r.videoChunks, { type: r.videoRecorder!.mimeType }));
        r.videoRecorder!.stop();
      });
      if (clip.size > 0) setClipUrl(URL.createObjectURL(clip));
    }

    const cfg = configRef.current;
    const mode = captureModeRef.current;
    teardown();

    {
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const fields: Record<string, string> = {
        lessonId: cfg.lessonId,
        mode: cfg.kind,
        mods: cfg.mods.map((m) => m.id).join(","),
        xpMultiplier: String(cfg.xpMultiplier),
        captureMode: mode,
        // The judged-tier allowance resets on the user's own calendar
        // day, not on UTC's (§3) — captured now, so a resumed upload
        // still lands on the day it was spoken.
        tzOffset: String(new Date().getTimezoneOffset()),
      };
      if (envelope.levels.length > 0) {
        fields.envelope = serializeEnvelope(envelope);
      }
      if (scored?.scorable) {
        fields.delivery = JSON.stringify({
          metrics: scored.metrics,
          moments: scored.moments,
        });
      }
      if (cfg.topic) fields.bossTopicId = cfg.topic.id;

      // Into the outbox BEFORE the first upload attempt: from here the
      // recording survives a dead network, a killed tab, everything
      // short of clearing site data.
      const rep: OutboxRep = {
        id: newOutboxId(cfg.lessonId),
        createdAt: Date.now(),
        audio: blob,
        filename: `rep.${ext}`,
        fields,
      };
      const held = await outboxPut(rep);
      await score(replayForm(rep), held ? rep.id : null);
    }
  }, [teardown, score]);

  const startRep = useCallback(async () => {
    setError(null);
    setMicBlock(null);
    setSeconds(0);
    // The Rec tap is the gesture that licenses audio for the whole
    // session — the celebration chime minutes from now rides on it.
    // The chime itself never plays while the mic is hot (lib/sfx.ts).
    unlockSfx();
    const cfg = configRef.current;
    const wantsVideo = captureModeRef.current === "voice_video";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wantsVideo
          ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
          : false,
      });

      /*
       * The uploaded blob is built from the AUDIO TRACKS ONLY, never
       * from `stream`. This is the line that makes "video never leaves
       * your device" true rather than aspirational: recording the whole
       * stream would quietly ship a video file to Supabase storage the
       * moment someone flipped the toggle.
       */
      const audioOnly = new MediaStream(stream.getAudioTracks());
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : undefined;
      const recorder = new MediaRecorder(
        audioOnly,
        mime ? { mimeType: mime } : undefined
      );
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.start(1000);

      // A second, local-only recorder for playback with markers. Its
      // blob is held as an object URL and dropped when you leave.
      let videoRecorder: MediaRecorder | null = null;
      const videoChunks: Blob[] = [];
      if (wantsVideo && stream.getVideoTracks().length > 0) {
        try {
          videoRecorder = new MediaRecorder(stream);
          videoRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) videoChunks.push(e.data);
          };
          videoRecorder.start(1000);
        } catch {
          videoRecorder = null; // playback is a bonus, never the rep
        }
      }

      // Level meter. iOS Safari creates AudioContexts suspended even
      // inside a user gesture — resume explicitly.
      const ctx = new AudioContext();
      void ctx.resume().catch(() => {});
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let rms = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          rms += v * v;
        }
        rms = Math.sqrt(rms / data.length);
        setLevels((prev) => [...prev.slice(1), Math.min(1, rms * 4)]);
        const r = recRef.current;
        if (r) {
          // Fixed-rate sample for the envelope. rAF is 60Hz and varies
          // with load; the engine needs an even timebase to line samples
          // up against word timestamps.
          const now = performance.now();
          if (now - r.envelopeAt >= 1000 / ENVELOPE_RATE) {
            r.envelopeAt = now;
            r.envelope.push(Math.min(1, rms * 4));
          }
          r.raf = requestAnimationFrame(tick);
        }
      };

      const crowd = cfg.crowdNoise ? startCrowdNoise(ctx) : null;

      recRef.current = {
        recorder,
        stream,
        ctx,
        raf: 0,
        chunks,
        crowd,
        interruptTimer: null,
        videoRecorder,
        videoChunks,
        sampler: null,
        envelope: [],
        envelopeAt: 0,
      };
      recRef.current.raf = requestAnimationFrame(tick);

      // Pose sampling + the live ring. Free for everyone (§2): it's
      // local compute at zero marginal cost, and it's the part that
      // feels like magic in the first thirty seconds.
      if (wantsVideo && stream.getVideoTracks().length > 0) {
        const video = videoElRef.current;
        const landmarker = await loadPose();
        if (video && landmarker) {
          video.srcObject = stream;
          await video.play().catch(() => {});
          const sampler = samplePose(video, landmarker, (frames) =>
            setRing(ringState(frames))
          );
          recRef.current.sampler = sampler;
          setPoseFrames(sampler.frames);
        }
      }

      if (cfg.interrupt) {
        // Somewhere in the middle third — early enough to recover from,
        // late enough that you're committed to a thread.
        const at = Math.round(cfg.maxSeconds * (0.4 + Math.random() * 0.2));
        recRef.current.interruptTimer = setTimeout(() => {
          if (phaseRef.current !== "recording") return;
          setInterruption(
            INTERRUPTIONS[Math.floor(Math.random() * INTERRUPTIONS.length)]
          );
          buzz([40, 60, 40]);
          setTimeout(() => setInterruption(null), 2600);
        }, at * 1000);
      }

      buzz(30);
      setPhase("recording");
    } catch (e) {
      // A refusal and a missing device get the dedicated explainer
      // (browser-specific steps, a re-check button) rather than a
      // sentence and a shrug.
      const name = e instanceof DOMException ? e.name : "";
      const missing =
        name === "NotFoundError" ||
        name === "DevicesNotFoundError" ||
        name === "OverconstrainedError";
      setMicBlock({
        video: captureModeRef.current === "voice_video",
        missing,
      });
      setError(null);
      setPhase("error");
    }
  }, []);

  /**
   * Retake — same prompt, clean slate. The rep that just happened is
   * already stored and still counts; this is another attempt at the
   * same thing, not an undo.
   */
  const retake = useCallback(() => {
    setResult(null);
    setGains([]);
    setBests([]);
    setClosing(null);
    setCelebrate(null);
    setSeconds(0);
    setLevels(Array(METER_BARS).fill(0.05));
    setPresence(null);
    setRing("ok");
    setPoseFrames(null);
    setHeldS(0);
    setClipUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setPhase("idle");
  }, []);

  /** Frame step (DECISIONS #35): opt-in think time before the clock. */
  const begin = useCallback(() => {
    if (readPrefs().frameStep) {
      setFrameLeft(FRAME_SECONDS);
      setPhase("frame");
    } else {
      void startRep();
    }
  }, [startRep]);

  useEffect(() => {
    if (lessonKeyRef.current === lessonKey) return;
    lessonKeyRef.current = lessonKey;
    setResult(null);
    setPresence(null);
    setGains([]);
    setBests([]);
    setClosing(null);
    setCelebrate(null);
    setCoined(false);
    setSeconds(0);
    setRing("ok");
    setPoseFrames(null);
    setHeldS(0);
    setNotes("");
    setLevels(Array(METER_BARS).fill(0.05));
    setClipUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setPhase("idle");
    window.scrollTo({ top: 0 });
  }, [lessonKey]);

  // Frame countdown
  useEffect(() => {
    if (phase !== "frame") return;
    const t = setInterval(() => {
      setFrameLeft((s) => {
        if (s <= 1) {
          setPhase("idle");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  /**
   * How long the ring has been clean, in seconds.
   *
   * This is the screen's active indicator of *success*, and it exists
   * because the rep screen only ever spoke up to complain: the ring went
   * amber on a slouch and said nothing at all when you were holding it
   * together, which teaches you what failure looks like and nothing
   * about what to keep doing.
   *
   * Resetting to zero on any nudge is the point — losing a run you were
   * accumulating is a stronger, quieter signal than a warning colour,
   * and it's the same mechanic as the streak one screen up.
   */
  useEffect(() => {
    if (phase !== "recording" || captureMode !== "voice_video" || ring !== "ok") {
      setHeldS(0);
      return;
    }
    const from = Date.now();
    const t = setInterval(
      () => setHeldS(Math.floor((Date.now() - from) / 1000)),
      250
    );
    return () => clearInterval(t);
  }, [phase, captureMode, ring]);

  // Timer + hard cap (90s, or 45s with the tight-timer mod)
  useEffect(() => {
    if (phase !== "recording") return;
    const cap = config.maxSeconds;
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= cap) void stopRep();
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, stopRep, config.maxSeconds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const r = recRef.current;
      if (r) {
        try {
          r.recorder.stop();
          r.videoRecorder?.stop();
        } catch {}
        cancelAnimationFrame(r.raf);
        if (r.interruptTimer) clearTimeout(r.interruptTimer);
        r.sampler?.stop();
        r.crowd?.stop();
        r.stream.getTracks().forEach((t) => t.stop());
        void r.ctx.close().catch(() => {});
      }
    };
  }, []);

  // The local clip is the one artefact that could outlive the screen.
  // Revoking it on unmount is what makes "leave and it's gone" true.
  useEffect(() => {
    return () => {
      if (clipUrl) URL.revokeObjectURL(clipUrl);
    };
  }, [clipUrl]);
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  if (phase === "results" && result) {
    return (
      <>
        <Results
          result={result}
          config={config}
          gains={gains}
          bests={bests}
          closing={closing}
          tomorrow={tomorrow}
          presence={presence}
          clipUrl={clipUrl}
          audioUrl={audioUrl}
          premium={premium}
          coined={coined}
          anonymous={anon}
          repCountBefore={repCount}
          streakNow={streakNow}
          repsNow={repsNow}
          onUpgrade={setPaywall}
          onRetake={retake}
        />
        {celebrate !== null && (
          <StreakCelebration
            streak={celebrate}
            onDone={() => setCelebrate(null)}
          />
        )}
        {paywall && (
          <Paywall
            reason={paywall.reason}
            headline={paywall.headline}
            onClose={() => setPaywall(null)}
          />
        )}
      </>
    );
  }

  const capLabel = fmt(config.maxSeconds);
  const promptHidden = config.hidePrompt && phase !== "idle";
  /*
   * A tip yields to a live nudge: the nudge is about this second of this
   * rep, the tip is general advice, and stacking them means neither gets
   * read. `seconds` already ticks once a second, so this recomputes at
   * exactly the rate it needs to and no faster.
   */
  const liveTip =
    ring === "ok"
      ? liveTipAt(seconds, config.maxSeconds, captureMode === "voice_video")
      : null;

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-8 pt-7">
      <Link href={config.kind === "boss" ? "/boss" : "/"} className="self-start text-sm text-stone-500">
        ← back
      </Link>
      <div className="label-data mt-6">{config.unit}</div>
      <h1 className="font-display mt-1.5 text-2xl font-bold">{config.title}</h1>

      {promptHidden ? (
        <p className="mt-2.5 text-[15px] italic leading-relaxed text-stone-400">
          Prompt hidden. That&apos;s the mod.
        </p>
      ) : (
        <p className="mt-2.5 text-[15px] leading-relaxed text-stone-500">
          {config.prompt}
        </p>
      )}

      {config.mods.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {config.mods.map((m) => (
            <span
              key={m.id}
              className="rounded-full bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-ground"
            >
              {m.name}
            </span>
          ))}
          <span className="label-data">×{config.xpMultiplier} XP</span>
        </div>
      )}

      {phase === "idle" && repCount !== null && repCount >= 1 && (
        <ModeToggle
          mode={captureMode}
          available={poseReady === true}
          reason={
            poseReady === null
              ? "Checking whether this browser can do on-device pose detection…"
              : undefined
          }
          onChange={(m) => {
            setCaptureMode(m);
            writeCaptureMode(config.kind, m);
          }}
        />
      )}

      {/*
       * Rep 1's two honest disclosures, one line each: why there's no
       * video toggle yet (#68), and what tapping the button will ask
       * for. Permission asks primed at the moment of use run 2–3× the
       * grant rate of cold ones (DECISIONS #135) — and "only while you
       * record" is a promise the teardown() code actually keeps.
       */}
      {phase === "idle" && repCount === 0 && (
        <p className="mt-4 text-[12.5px] leading-relaxed text-stone-500">
          Audio for your first recording, video from the next. The mic is live only while
          you record.
        </p>
      )}

      {config.crowdNoise && phase === "idle" && (
        <p className="mt-2 text-[12.5px] text-stone-500">
          Headphones on, or the café bleeds into your mic.
        </p>
      )}

      {/*
       * How to do the drill, before the drill. This was only ever
       * visible inside the opt-in Frame step, which is off by default —
       * so in practice a lesson named a target and never said how to
       * hit it. Each tip maps to something the engine measures, so the
       * feedback afterwards is about the same thing the tip was about.
       */}
      {phase === "idle" && config.tips.length > 0 && (
        <div className="mt-4 rounded-[24px] border border-hairline bg-surface p-4">
          <div className="label-data">How to do this one</div>
          <ul className="mt-2 space-y-1.5">
            {config.tips.map((tip, i) => (
              <li
                key={i}
                className="flex gap-2 text-[13px] leading-relaxed text-stone-600"
              >
                <span className="label-data mt-0.5 shrink-0 !text-sage-700">
                  {i + 1}
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        {phase === "frame" && (
          <div className="w-full">
            <div className="flex items-baseline justify-between">
              <div className="font-display text-[40px] font-bold leading-none">
                {frameLeft}
              </div>
              <div className="label-data">seconds to think</div>
            </div>

            {/* Structure tips, by the SHAPE of answer the prompt asks
                for. We know that much honestly; we don't know what
                you're going to say, so we don't pretend to. */}
            <div className="mt-4 rounded-[24px] border border-hairline bg-surface p-4">
              <div className="label-data">Shape it like this</div>
              <ul className="mt-2 space-y-1.5">
                {config.tips.map((tip, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-[13.5px] leading-relaxed text-stone-600"
                  >
                    <span className="label-data mt-0.5 shrink-0 !text-sage-700">
                      {i + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notes: first line, last line, one example…"
              className="mt-3 w-full rounded-[24px] border border-stone-200 bg-surface p-4 text-[14px] leading-relaxed placeholder:text-stone-300 focus:border-stone-300"
            />
            <p className="mt-1.5 text-[11.5px] text-stone-400">
              They disappear when you record. You can&apos;t read and speak at
              once.
            </p>
          </div>
        )}

        {phase === "recording" && (
          <>
            <div
              className={`font-display text-[54px] font-bold leading-none ${
                config.maxSeconds - seconds <= 10 ? "text-terracotta-600" : ""
              }`}
            >
              {fmt(seconds)}
              <span className="font-body text-[15px] font-medium text-stone-500">
                {" "}
                / {capLabel}
              </span>
            </div>
            <div className="flex h-12 items-end gap-[3px]" aria-hidden>
              {levels.map((v, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-stone-400"
                  style={{ height: `${Math.max(8, v * 100)}%` }}
                />
              ))}
            </div>
            {/*
             * One tip, at the moment it applies (lib/live-tips.ts). It
             * yields to a live nudge — two messages at once is one
             * message nobody reads — and the row keeps its height
             * either way so the meter never jumps.
             */}
            <div className="flex h-[18px] items-center">
              <span
                className={`text-[12.5px] leading-none text-stone-400 transition-opacity duration-500 ${
                  liveTip ? "opacity-100" : "opacity-0"
                }`}
              >
                {liveTip ?? ""}
              </span>
            </div>
          </>
        )}

        {phase === "analyzing" && (
          <div className="text-center">
            <div className="font-display text-xl font-bold">
              Scoring…
            </div>
            <p className="mt-2 text-sm text-stone-500">
              {config.kind === "boss"
                ? "Transcribing, measuring, checking your claims."
                : "Transcribing, counting, measuring silence."}
            </p>
            <p className="mt-1 text-[12.5px] text-stone-400">
              Ten seconds or so. The numbers are computed, not guessed.
            </p>
          </div>
        )}

        {/*
         * Self-view with the live ring and the tracked limbs drawn over
         * it. Free for everyone (§2) — local compute, zero marginal
         * cost, and the part that feels like magic before anyone has
         * paid anything.
         *
         * The amber is REVERSED from §2's first pass (DECISIONS #127).
         * It used to mark the nudge, which was flagged in code as the
         * one place amber meant "look at this" rather than "you earned
         * this" — a colour that means two things means neither. Now the
         * nudge is stone and the hold counter wears the earned colour
         * (sage since #165), earned-only everywhere, including here.
         *
         * A nudge stays unmissable on three channels at once: the ring
         * thickens, the skeleton dims to stone, the note appears — and
         * the hold counter you were building resets to nothing, which is
         * the loudest of the four.
         */}
        <div
          className={`${
            captureMode === "voice_video" && phase === "recording"
              ? "block"
              : "hidden"
          }`}
        >
          <div
            className={`relative overflow-hidden rounded-[22px] transition-shadow ${
              ring === "ok"
                ? "ring-2 ring-hairline"
                : `ring-4 ${RING_TONE}`
            }`}
          >
            <video
              ref={videoElRef}
              muted
              playsInline
              className="block w-[220px] -scale-x-100 bg-stage"
            />
            {poseFrames && <PoseSkeleton frames={poseFrames} ring={ring} />}
            {/* The held run, in the video's own corner — close enough
                that the eye doesn't leave your face to find it, off to
                the side so it isn't sitting on your hands. `nowrap`
                because the pill is narrower than the label wants to be
                and wrapping put "12s" across the skeleton's chest. */}
            {ring === "ok" && heldS >= HOLD_REVEAL_S && (
              <div className="absolute bottom-2 right-2 rounded-full bg-stage/80 px-2.5 py-1">
                <span className="label-data whitespace-nowrap !text-sage-mist">
                  holding {heldS}s
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 h-[18px] text-center text-[13px] font-semibold text-stone-600">
            {ring !== "ok" ? ringNote(ring) : ""}
          </div>
        </div>

        {phase === "recording" && captureMode !== "voice_video" && (
          <Image
            src="/demos-listening.webp"
            alt=""
            width={84}
            height={84}
            className="demos w-[84px] opacity-90"
          />
        )}

        {phase === "idle" && (
          <>
            {/* Anticipation cue — what this rep is about to earn. The
                reward-prediction literature treats this as its own
                driver, not a preview of the reward. */}
            {anticipate && (
              <div className="w-full">
                <Moment moment={anticipate} emphasis />
              </div>
            )}
            <p className="max-w-[260px] text-center text-[13.5px] text-stone-500">
              {config.maxSeconds < 60
                ? `${config.maxSeconds} seconds. Spend your pauses deliberately.`
                : "60 to 90 seconds. Pauses score in your favor."}
            </p>
            {/* The consent line: what recording does with the audio,
                said where it's about to happen (COPY-RULES placement). */}
            <p className="mt-1.5 text-center text-[11.5px] text-stone-400">
              Audio uploads for scoring; your camera never does ·{" "}
              <Link href="/privacy" className="font-semibold text-stone-500">
                privacy
              </Link>
            </p>
          </>
        )}

        {phase === "error" &&
          (micBlock ? (
            <PermissionHelp
              video={micBlock.video}
              missing={micBlock.missing}
              onRecheck={() => void startRep()}
            />
          ) : (
            <ErrorState
              className="w-full"
              title="That recording didn't score."
              body={error ?? "The scoring server didn't answer."}
              onRetry={
                pendingRef.current
                  ? () => {
                      const p = pendingRef.current!;
                      void score(p.form, p.outboxId);
                    }
                  : undefined
              }
              retryLabel="Score it again"
            />
          ))}

        {phase !== "analyzing" && phase !== "frame" && !micBlock && (
          <button
            onClick={
              phase === "recording" ? () => void stopRep() : () => begin()
            }
            aria-label={
              phase === "recording"
                ? "Stop and score this recording"
                : "Start recording"
            }
            className={`h-24 w-24 rounded-full text-[15px] font-bold transition-colors ${
              phase === "recording"
                ? "bg-ink text-ground ring-[10px] ring-terracotta-100"
                : "bg-terracotta-500 text-stage hover:bg-terracotta-600"
            }`}
          >
            {phase === "recording" ? "Stop" : "Rec"}
          </button>
        )}

        {phase === "frame" && (
          <button
            onClick={() => void startRep()}
            className="rounded-full border border-stone-200 bg-surface px-6 py-3.5 text-[15px] font-semibold"
          >
            I&apos;m ready
          </button>
        )}
      </div>

      {interruption && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-5">
          <div className="flex max-w-[340px] items-center gap-3 rounded-[24px] bg-stage px-4 py-3 text-cream">
            <Image
              src="/demos-speaking.webp"
              alt=""
              width={36}
              height={36}
              className="demos w-9 shrink-0"
            />
            <span className="font-display text-[17px] font-bold">
              {interruption}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/*
 * Results, walked one screen at a time.
 *
 * The old version put the score, eight dimensions, every filler
 * timestamp, the transcript, records, tomorrow's focus and two buttons
 * in a single scroll — so the top was read and the rest was scrolled
 * past on the way to "Done". Three steps, one job each, and no way out
 * until the last one: you finish the debrief, then you leave.
 *
 * Nothing is hidden by this; the log renders the same component with
 * section="all", because a stored rep is reference rather than a
 * debrief.
 */
const STEPS = [
  { key: "score", label: "The score" },
  { key: "numbers", label: "The numbers" },
  { key: "words", label: "Your words" },
] as const;

function Results({
  result,
  config,
  gains,
  bests,
  closing,
  tomorrow,
  presence,
  clipUrl,
  audioUrl,
  premium,
  coined,
  anonymous,
  repCountBefore,
  streakNow,
  repsNow,
  onUpgrade,
  onRetake,
}: {
  result: AnalyzeResponse;
  config: RepConfig;
  gains: RepGain[];
  bests: RewardMoment[];
  closing: RewardMoment | null;
  tomorrow: NextFocus | null;
  presence: PresenceResult | null;
  clipUrl: string | null;
  audioUrl: string | null;
  premium: boolean;
  coined: boolean;
  anonymous: boolean;
  repCountBefore: number | null;
  streakNow: number;
  repsNow: RepRow[];
  onUpgrade: (ask: PaywallAsk) => void;
  onRetake: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const section = STEPS[step].key;
  const last = step === STEPS.length - 1;
  const next = nextDrill(config.lessonId);
  // `game:<gameId>:<questionId>` — a game rep keeps its game identity
  // through the debrief (#194).
  const game = config.lessonId.startsWith("game:")
    ? gameById(config.lessonId.split(":")[1])
    : null;

  /*
   * The save-progress wall (DECISIONS #134). The exits route through
   * it rather than it replacing the last screen: the debrief stays a
   * debrief, #105's ending stays "Next lesson", and the decline
   * continues to exactly the destination that was tapped — a wall that
   * eats the tap it intercepted reads as a bait-and-switch.
   */
  const [gateTo, setGateTo] = useState<string | null>(null);
  const gate = gateMoment({
    anonymous,
    repCountBefore,
    streakNow,
    shown: gatesShown(),
  });

  /*
   * The day-3 progress moment (DECISIONS #11's placement, lib/pro-moment).
   * The save wall outranks it: the account ask comes before the money
   * ask, and a deferred moment stays due for a later exit.
   */
  const [proTo, setProTo] = useState<string | null>(null);
  const daysSpoken = trainedDays(repsNow).length;
  const proDue = proMomentDue({
    premium,
    daysSpoken,
    repCount: repsNow.length,
    shown: proMomentShown(),
  });
  const exit = (href: string) => {
    if (gate) setGateTo(href);
    else if (proDue) setProTo(href);
    else router.push(href);
  };

  // Each step starts at the top. Landing halfway down the next screen
  // because the last one was long is how a step gets skipped.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  if (gateTo !== null && gate !== null) {
    return (
      <SaveGate
        moment={gate}
        index={result.ethosIndex}
        streak={streakNow}
        onSkip={() => router.push(gateTo)}
      />
    );
  }

  if (proTo !== null) {
    return (
      <ProgressMoment
        reps={repsNow}
        days={daysSpoken}
        onSkip={() => router.push(proTo)}
      />
    );
  }

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-8 pt-7">
      <div className="flex items-center justify-between">
        <div className="label-data">
          {config.kind === "boss" ? "Boss complete" : "Lesson complete"}
        </div>
        {coined && step === 0 && (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-sage-700">
            <Coin size={18} /> +1
          </span>
        )}
      </div>

      {/* Where you are and how much is left. Three dots is a promise
          you can see the end of; a scrollbar is not. */}
      <div className="mt-3 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-terracotta-500" : "bg-sand"
            }`}
          />
        ))}
        <span className="label-data ml-1 shrink-0">{STEPS[step].label}</span>
      </div>

      <div className="flex-1">
        {step === 0 && <GainsRow gains={gains} />}
        <RepResult
          result={result}
          topic={config.topic}
          section={section}
          baseline={repCountBefore === 0}
        />

        {/*
         * Presence — a SECOND score, beside the Index at the same size.
         * The Index is audio-only and stays that way, so the trendline
         * and the leagues remain comparable whichever mode was picked.
         */}
        {section === "score" && presence && (
          <div className="mt-6 border-t border-sand pt-5">
            <PresenceScore
              score={presence.metrics.presenceScore}
              previous={result.previousPresence}
              premium={premium}
              onUpgrade={() =>
                onUpgrade({
                  reason: "Presence · premium",
                  headline: "See what the camera measured.",
                })
              }
            />
          </div>
        )}
        {section === "numbers" && presence && (
          <PresenceDetail
            metrics={presence.metrics}
            moments={presence.moments}
            premium={premium}
            videoUrl={clipUrl}
            onUpgrade={() =>
              onUpgrade({
                reason: "Delivery readout · premium",
                headline: "See what the camera measured.",
              })
            }
          />
        )}

        {/*
         * The judged tier ran out (§3). Said plainly, never framed as a
         * failed rep — the rep counted, the streak stands, and every
         * measured number is real.
         */}
        {section === "score" && result.judged.capped && (
          <div className="mt-5 rounded-[24px] border border-hairline bg-surface p-5">
            <div className="font-display text-[19px] font-bold leading-tight">
              Measured, not judged.
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-stone-500">
              These are counted from the recording. The cited moments, the word
              upgrade and Demos&apos;s take are back tomorrow.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-stone-400">
              It still counted toward your streak.
            </p>
            {/* The map's #1 surface (docs/growth/04 §1.1): came back for
                a second read the same day, right after finished work.
                One quiet line, day 3 on; before that, meter state only. */}
            {daysSpoken >= PRO_MOMENT_DAYS && (
              <button
                onClick={() =>
                  onUpgrade({
                    reason: "The judged read · 1 a day free",
                    headline: "Keep the coaching coming.",
                  })
                }
                className="press mt-3 min-h-11 text-left text-[13px] font-semibold text-stone-600"
              >
                Premium gets the full read, every time →
              </button>
            )}
          </div>
        )}

        {/* Hear it back, right under the words it produced. The most
            honest feedback in the product: the evidence, replayable,
            with every filler tappable (vision.md: claims trace to
            timestamps). Local object URL, dropped when you leave. */}
        {section === "words" && audioUrl && (
          <div className="mt-4">
            <AudioScrubber
              src={audioUrl}
              durationS={result.metrics.durationS}
              fillers={result.metrics.fillers}
              pauses={result.metrics.pauses}
            />
          </div>
        )}

        {section === "words" && bests.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="label-data">Records broken</div>
            {bests.map((b, i) => (
              <Moment key={i} moment={b} />
            ))}
          </div>
        )}

        {/* The ending carries disproportionate weight when someone
            decides whether to come back (streak-end rule), so it lands
            on the last screen rather than halfway down the first. */}
        {last && closing && (
          <div className="mt-5">
            <Moment moment={closing} emphasis />
          </div>
        )}

        {/*
         * The hook for tomorrow. Half-life regression (Settles &
         * Meeder, ACL 2016) is Duolingo's real answer to "why come
         * back" — the app holds a model of what you're about to lose
         * and schedules against it. Same idea over the four measured
         * skills, and it always shows the number that made the call.
         */}
        {last && tomorrow && tomorrow.strength !== null && (
          <div className="mt-5 rounded-[24px] border border-hairline bg-surface p-5">
            <div className="label-data">Tomorrow</div>
            <div className="font-display mt-1 text-[22px] font-bold leading-tight">
              {tomorrow.label}
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">
              {tomorrow.reason}
            </p>
          </div>
        )}

        {last && <PlanChips streak={streakNow} />}
      </div>

      {/*
       * One way forward per screen. There is deliberately no exit until
       * the debrief is finished — the numbers are the product, and a
       * "Done" button beside the first screen means most of them are
       * never seen.
       */}
      {last ? (
        <div className="mt-6">
          {/* Buttons, not Links: the exits go through exit(), which
              may route via the save-progress wall first (#134). A game
              ends as a game (#194): another round or back to Tools,
              never a push onto the path's next lesson. */}
          {game ? (
            <button
              onClick={() =>
                exit(
                  repHref({
                    game: game.id,
                    q: draw(game, config.lessonId.split(":")[2] ?? null).id,
                  })
                )
              }
              className="press block w-full rounded-full bg-terracotta-500 px-6 py-4 text-center text-[17px] font-semibold text-stage transition-colors hover:bg-terracotta-600"
            >
              Another round · {game.name}
            </button>
          ) : (
            <button
              onClick={() => exit(repHref({ lesson: next.id }))}
              className="press block w-full rounded-full bg-terracotta-500 px-6 py-4 text-center text-[17px] font-semibold text-stage transition-colors hover:bg-terracotta-600"
            >
              Next lesson · {next.title}
            </button>
          )}
          <button
            onClick={onRetake}
            className="press mt-3 w-full rounded-full border border-stone-200 bg-surface px-6 py-4 text-[15px] font-semibold"
          >
            Retake this one
          </button>
          <button
            onClick={() => exit(game ? "/games" : "/")}
            className="mt-3 block w-full py-2 text-center text-[13.5px] font-semibold text-stone-500"
          >
            {game ? "Back to Tools" : "Done for today"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setStep((n) => n + 1)}
          className="press mt-6 w-full rounded-full bg-terracotta-500 px-6 py-4 text-[17px] font-semibold text-stage transition-colors hover:bg-terracotta-600"
        >
          {STEPS[step + 1].label} →
        </button>
      )}
    </main>
  );
}

/**
 * The save-progress wall (DECISIONS #134) — the gate #15 always
 * specified, at the moment the product has visibly worked. It stakes
 * the thing just made, asks to save it, and declines quietly: Duolingo
 * measured both halves — "save your progress" walls built their +20%
 * DAU result, and a loud "Discard my progress" decline drove people
 * away. There is no Demos here: the number is the argument, the button
 * is a door (#131's logic).
 */
function SaveGate({
  moment,
  index,
  streak,
  onSkip,
}: {
  moment: GateMoment;
  index: number | null;
  streak: number;
  onSkip: () => void;
}) {
  // Shown is shown, whatever gets tapped — the flag is what makes
  // "exactly twice per browser" true across remounts.
  useEffect(() => {
    markGateShown(moment);
  }, [moment]);

  const days = Math.max(streak, 1);

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-8 pt-7">
      <div className="label-data">Before you go</div>

      <div className="flex flex-1 flex-col justify-center">
        {index !== null && (
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[56px] font-bold leading-none">
              {index}
            </span>
            <span className="text-[13px] text-stone-500">
              /1000{moment === "rep1" && " · your baseline"}
            </span>
          </div>
        )}
        <h1 className="font-display mt-4 text-[30px] font-bold leading-tight">
          {moment === "rep1"
            ? "Day 1 is on the board."
            : `${days} days on the board.`}
        </h1>
        <p className="mt-3 max-w-[92%] text-[15px] leading-relaxed text-stone-500">
          {moment === "rep1"
            ? "This recording, its score and the streak it starts live in this browser and nowhere else. "
            : `A ${days}-day streak and every number behind it live in this browser and nowhere else. `}
          An account attaches them to you, so a cleared cache or a new phone
          can&apos;t take them. Nothing moves, so nothing can go missing.
        </p>
      </div>

      <Link
        href="/signup"
        className="press block w-full rounded-full bg-terracotta-500 px-6 py-4 text-center text-[17px] font-semibold text-stage transition-colors hover:bg-terracotta-600"
      >
        Save my progress
      </Link>
      <button
        onClick={onSkip}
        className="mt-3 block w-full py-2 text-center text-[13.5px] font-semibold text-stone-500"
      >
        Not now
      </button>
    </main>
  );
}

/**
 * The day-3 progress moment — the paywall's one proactive placement
 * (DECISIONS #11: "after the day-3 progress card"), finally built where
 * it was specced. The card is seen in full first, always; the sheet is
 * one deliberate tap behind it; declining is quiet and final, and the
 * decline continues to exactly the destination that was tapped, the
 * save wall's own no-bait rule. The streak is never mentioned here:
 * this sells the archive and the coaching, never the loss of a habit.
 */
function ProgressMoment({
  reps,
  days,
  onSkip,
}: {
  reps: RepRow[];
  days: number;
  onSkip: () => void;
}) {
  const [sheet, setSheet] = useState(false);

  // Shown is shown, whatever gets tapped — once per browser, like the
  // save wall. Declining is final; the sheet never proactively returns.
  useEffect(() => {
    markProMomentShown();
  }, []);

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-8 pt-7">
      <div className="label-data">Since day one</div>

      <div className="flex flex-1 flex-col justify-center">
        <ComparisonCard reps={reps} />
        <p className="mt-3 text-[13px] leading-relaxed text-stone-500">
          Free shows the last 7 days and reads one recording a day. Premium
          opens all of it.
        </p>
      </div>

      <button
        onClick={() => setSheet(true)}
        className="press block w-full rounded-full bg-terracotta-500 px-6 py-4 text-center text-[17px] font-semibold text-stage transition-colors hover:bg-terracotta-600"
      >
        Keep every number
      </button>
      <button
        onClick={onSkip}
        className="mt-3 block w-full py-2 text-center text-[13.5px] font-semibold text-stone-500"
      >
        Not now
      </button>

      {sheet && (
        <Paywall
          reason={`Day ${days} of speaking`}
          headline={`${days} days of numbers. Keep all of them.`}
          onClose={() => setSheet(false)}
        />
      )}
    </main>
  );
}

/**
 * The when-plan (DECISIONS #136). Implementation intentions — a
 * concrete when, not a pledge — are the largest effect in the
 * onboarding research pass (d = 0.65, Gollwitzer & Sheeran), and the
 * tap doubles as the notification-permission primer: the OS dialog
 * only ever appears after the user picks a time, so the reminder is
 * theirs, not ours. Renders only while no reminder hour is set, and
 * disappears for good once one is.
 */
const PLAN_HOURS = [
  { h: 8, label: "Morning · 8:00" },
  { h: 12, label: "Lunch · 12:00" },
  { h: 18, label: "Evening · 18:00" },
];

function PlanChips({ streak }: { streak: number }) {
  const [hour, setHour] = useState<number | null>(
    () => readPrefs().reminderHour
  );
  const [granted, setGranted] = useState<boolean | null>(null);
  const [picked, setPicked] = useState(false);

  async function pick(h: number) {
    writePrefs({ reminderHour: h });
    setHour(h);
    setPicked(true);
    if (typeof Notification === "undefined") {
      setGranted(false);
      return;
    }
    const p =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    setGranted(p === "granted");
    if (p === "granted") {
      await armReminder({ streak, didToday: true });
    }
  }

  // Already planned on an earlier day — the settings card owns it now.
  if (hour !== null && !picked) return null;

  return (
    <div className="mt-5 rounded-[24px] border border-hairline bg-surface p-5">
      <div className="label-data">Tomorrow · when?</div>
      {picked ? (
        <p className="mt-2 text-[13px] leading-relaxed text-stone-600">
          {String(hour).padStart(2, "0")}:00.{" "}
          {granted
            ? "Demos will nudge you once, never more."
            : "Noted. Notifications are off in this browser; Settings names the fix."}
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">
            Practice with a time happens. Demos reminds you once a day, never in
            quiet hours.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLAN_HOURS.map((p) => (
              <button
                key={p.h}
                onClick={() => void pick(p.h)}
                className="press rounded-full bg-sand px-3.5 py-2 text-[13px] font-semibold text-stone-600"
              >
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
