"use client";

import { ACTION_CLASS as PRIMARY } from "@/lib/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AudioScrubber } from "@/components/AudioScrubber";
import { BestPlaque } from "@/components/rep/BestPlaque";
import { PremiumDoor } from "@/components/PremiumMark";
import { Coin } from "@/components/Coin";
import { LevelMeter } from "@/components/LevelMeter";
import { ModeToggle } from "@/components/ModeToggle";
import { Moment } from "@/components/Moment";
import { ComparisonCard } from "@/components/ComparisonCard";
import { Paywall, type PaywallAsk } from "@/components/Paywall";
import { PermissionHelp } from "@/components/PermissionHelp";
import { PoseSkeleton } from "@/components/PoseSkeleton";
import { PresenceDetail, PresenceScore } from "@/components/PresenceCard";
import { RepResult } from "@/components/RepResult";
import { CutInPill } from "@/components/rep/CutInPill";
import { DemosHears } from "@/components/rep/DemosHears";
import { LevelControl } from "@/components/rep/LevelControl";
import { ScoringStage } from "@/components/rep/ScoringStage";
import { TipLine, TipStrip } from "@/components/rep/TipStrip";
import { splitPrompt } from "@/lib/tip-labels";
import { TopicCard } from "@/components/rep/TopicCard";
import { StreakCelebration } from "@/components/StreakCelebration";
import { weekView } from "@/lib/home";
import { TraitChip } from "@/components/TraitChip";
import { FeltCheck, FeltStage } from "@/components/tester/FeltCheck";
import { MatchCheck } from "@/components/tester/MatchCheck";
import { TesterPaused } from "@/components/tester/TesterPaused";
import { DOOR_COPY, FELT_COPY } from "@/content/tester";
import { feltRow, pausedTester, scoreSnapshot, showsMatchCheck, type Felt, type TesterRow } from "@/lib/tester";
import { saveMatch, useTester } from "@/lib/tester-client";
import { testerRecord } from "@/lib/tester-signal";
import { dayTurned } from "@/lib/home";
import { liteGraphics } from "@/lib/graphics";
import { inAppBrowser, inAppLine } from "@/lib/in-app";
import { readOnboarding } from "@/lib/answers";
import { buildPortfolio } from "@/lib/portfolio";
import { ErrorState } from "@/components/ui/ErrorState";
import { FooterShelf } from "@/components/ui/FooterShelf";
import { BackLink } from "@/components/ui/ScreenHeader";
import { recordingTrait } from "@/lib/log";
import { practiceFamily, recordingObject } from "@/lib/practice-family";
import { animateSpring, SPRING, springEasing, springMs } from "@/lib/spring";
import { useHourLabel } from "@/lib/time-label";
import {
  fetchGameRounds,
  fetchProfile,
  fetchRepSpine,
  fetchReps,
  fetchXp,
  type GameRoundRow,
  type RepRow,
  type RepSpine,
} from "@/lib/client-data";
import { syncCoins } from "@/lib/coin-sync";
import {
  ENVELOPE_RATE,
  serializeEnvelope,
  VOICED_THRESHOLD,
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
import { nextLesson, starsByLesson, totalStars, unitStates } from "@/lib/path";
import { liveTipAt, liveTipsFor, yieldsToCutIn } from "@/lib/live-tips";
import {
  loadPose,
  onAppleMobile,
  poseCapable,
  samplePose,
  type PoseSampler,
} from "@/lib/pose-client";
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
  prefersReducedMotion,
  readPrefs,
  writeCaptureMode,
  writePrefs,
  type CaptureMode,
} from "@/lib/prefs";
import { armReminder } from "@/lib/reminders";
import { repGains } from "@/lib/progress";
import { celebrates, type RewardMoment } from "@/lib/rewards";
import {
  backLabel,
  celebratesStreak,
  defaultBack,
  recordCue,
  roundChimes,
  takeRewards,
  thinksFirst,
} from "@/lib/rep-screen";
import { playCelebration, unlockSfx } from "@/lib/sfx";
import { computeStreak } from "@/lib/streak";
import { nextDrill } from "@/lib/drills";
import {
  askedIdsFrom,
  clampLevel,
  drawFresh,
  gameById,
  gameModIds,
  gameOfLessonId,
  gameOfTheDay,
  gameOpen,
  gameXpMultiplier,
  levelCapS,
  needsPremium,
  type LevelN,
} from "@/lib/games";
import { dayKey } from "@/lib/challenge";
import { usePaywallReturn } from "@/lib/use-paywall-return";
import { bestFor, ladderState, roundsToday, type LadderRow } from "@/lib/ladder";
import { INTERVIEW_WINDOW, type GameRound, type StoppedBy } from "@/lib/round";
import {
  bestLine,
  bestParts,
  CUT_IN_HOLD_S,
  firedCutIns,
  gameBestSnapshot,
  nextCutIn,
  pickLine,
  planCutIns,
  type CutInPlan,
  type GameBestSnapshot,
} from "@/lib/round-live";
import { lessonById } from "@/content/lessons";
import { parsePracticeId } from "@/lib/lesson-progress";
import {
  recordingText,
  repHref,
  repKey,
  resolveRepConfig,
  sameRepScreen,
  type RepConfig,
} from "@/lib/rep-config";
import {
  clearInFlight,
  isFinalReject,
  markInFlight,
  newOutboxId,
  outboxDelete,
  outboxPut,
  replayForm,
  sendWithRetry,
  type OutboxRep,
} from "@/lib/rep-outbox";
import {
  currentSession,
  ensureSession,
  sessionToken,
} from "@/lib/supabase-browser";
import type { AnalyzeResponse } from "@/app/api/analyze/route";
import type { TraitId } from "@/content/traits";
import { MIN_TAKE_MS, TOO_SHORT_COPY, UNHEARD_COPY } from "@/lib/unheard";
import { IconBack } from "@/components/Icon";
import { RoundCard, ROUND_REVEAL_MS } from "@/components/rep/RoundCard";
import {
  heldInARow,
  ladderView,
  roundHeader,
  roundReveal,
  TASTE_LINE,
  tasteHeadline,
  tasteKey,
  waitFact,
  xpLine,
  type LadderView,
} from "@/lib/round-copy";

/* D51: the live waveform's bars across the column, the left half the
   take so far, rolling left from the centre. */
const WAVE_BARS = 56;
/* 120 tall at 390x844, less on a shorter phone so Stop stays on it. */
const WAVE_H = "clamp(56px, calc(100dvh - 724px), 120px)";
/* The progress ring around Stop: its radius on a 120 box, 8px outside
   the 96px button with a 4px stroke, and its length. */
const RING_R = 58;
const RING_C = 2 * Math.PI * RING_R;
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

/**
 * What Demos cuts in with on a take that is not a game's (the
 * interruption from Today's picker): Q&A's lines, the one set of them
 * (lib/games.ts). A game says its own (Interview's follow-ups).
 */
const CUT_IN_LINES = gameById("qa")?.cutInLines ?? [];

/**
 * getUserMedia failures that are about the camera itself, not a refused
 * permission: no camera, or another app (Teams, Zoom) holds it. With
 * Voice + Video on, these fall back to Voice rather than to the mic help.
 */
const CAMERA_DEVICE_FAILURES = new Set([
  "NotFoundError",
  "DevicesNotFoundError",
  "OverconstrainedError",
  "NotReadableError",
  "TrackStartError",
  "AbortError",
]);

/** A failure we already have words for. Anything else gets the generic. */
class ScoringFailure extends Error {}

/** The taste's ask was shown for this game on this device (once per game, ever). */
function tasteShown(gameId: string): boolean {
  try {
    return localStorage.getItem(tasteKey(gameId)) !== null;
  } catch {
    return false;
  }
}

function markTasteShown(gameId: string): void {
  try {
    localStorage.setItem(tasteKey(gameId), new Date().toISOString());
  } catch {}
}

/** A just-scored round's row: the stored recording's id, else its outbox key. */
function roundRowId(r: AnalyzeResponse, key: string | null): string {
  return r.repId ?? `local:${key ?? "take"}`;
}

/**
 * The game's rows with this round in. The read after a take may not hold
 * it yet (a save that failed, a read that beat the write), so it is added
 * from the answer itself, newest, once.
 */
function withRound(
  rows: GameRoundRow[],
  r: AnalyzeResponse,
  lessonId: string,
  key: string | null
): GameRoundRow[] {
  const id = roundRowId(r, key);
  if (rows.some((x) => x.id === id)) {
    return rows.map((x) => (x.id === id && !x.round ? { ...x, round: r.round ?? null } : x));
  }
  return [
    ...rows,
    {
      id,
      lesson_id: lessonId,
      created_at: new Date().toISOString(),
      stars: r.metrics.stars,
      ethos_index: r.ethosIndex,
      round: r.round ?? null,
    },
  ];
}

/** How long a take ran, to a tenth of a second: a tester's record_stop. */
function ranFor(startedAt: number, now = Date.now()): number {
  return Math.round((now - startedAt) / 100) / 10;
}

type Phase =
  | "idle"
  | "frame"
  | "recording"
  | "analyzing"
  | "results"
  | "error";

/**
 * A `back` that is a path on this app and nothing else. Anything with a
 * scheme, a host, or a second slash at the front is dropped: a redirect
 * target taken from a query string is the oldest hole there is.
 */
function safeBack(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/** One take while the mic is hot: its devices, recorders and readings. */
interface Take {
  recorder: MediaRecorder;
  stream: MediaStream;
  ctx: AudioContext;
  raf: number;
  chunks: Blob[];
  crowd: CrowdNoise | null;
  /** Clears Demos's line 3.5s after he cut in. */
  interruptTimer: ReturnType<typeof setTimeout> | null;
  /**
   * The take's own clock: `performance.now()` at the recorder's `start`
   * event, so a cut-in's second is on the audio's clock, the one
   * Whisper's word times are read on (F2).
   */
  clock: { startedAt: number };
  /** When Demos cuts in on this take, and what he said (lib/round-live.ts). */
  cutPlan: CutInPlan[];
  /** What he cuts in with: the game's lines, or Q&A's. */
  cutLines: readonly string[];
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
  /** Takes off the listeners that end a take the phone stopped hearing (#412). */
  offWatch: (() => void) | null;
}

export default function RepPage() {
  return (
    <Suspense fallback={<main className="px-5 pt-7" />}>
      <RepScreen />
    </Suspense>
  );
}

function RepScreen() {
  const searchParams = useSearchParams();
  const router = useRouter();
  /* Held in a ref so `score` (stable, [] deps) reads the current one. */
  const routerRef = useRef(router);
  routerRef.current = router;
  const [premium, setPremium] = useState(false);
  /**
   * The plan as read, for the game of the day's gate: null until the
   * read lands, and for good when it fails, because unknown is never
   * free (#353). `premium` above stays the resolver's answer.
   */
  const [plan, setPlan] = useState<boolean | null>(null);

  useEffect(() => {
    fetchProfile()
      .then((p) => {
        setPremium(p?.premium ?? false);
        setPlan(p?.premium ?? false);
      })
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
        item: searchParams.get("item"),
        game: searchParams.get("game"),
        q: searchParams.get("q"),
        level: searchParams.get("level"),
        mods: searchParams.get("mods"),
        premium,
      }),
    [searchParams, premium]
  );
  /**
   * The game this take is a round of, and its level (the games plan,
   * item 2), or null for anything else. The level is the link's
   * (repHref), clamped; a level the ladder has not opened goes back to
   * the open one once the ladder is read (below).
   */
  const game = config.level !== null ? gameOfLessonId(config.lessonId) : null;
  const level: LevelN | null = game ? config.level : null;
  /**
   * This account's game rounds (lib/client-data.ts `fetchGameRounds`):
   * the ladder, the bests and today's free round are read from them.
   * Null while the read is out, and when it failed: then the screen
   * draws the level on the link and says no best, never a guess.
   */
  const [gameRows, setGameRows] = useState<GameRoundRow[] | null>(null);
  /* The rows as they stand, for the result handler: before a take is
     scored they are the round's "before" (#53). */
  const gameRowsRef = useRef<GameRoundRow[] | null>(null);
  gameRowsRef.current = gameRows;
  const loadGameRounds = useCallback(
    () =>
      fetchGameRounds()
        .then(setGameRows)
        .catch(() => {}),
    []
  );
  const gameId = game?.id ?? null;
  useEffect(() => {
    if (gameId) void loadGameRounds();
  }, [gameId, loadGameRounds]);
  const ladder = useMemo(
    () => (game && gameRows ? ladderState(gameRows, game.id) : null),
    [game, gameRows]
  );
  /** This screen's address at another level, everything else kept. */
  const levelHref = useCallback(
    (n: LevelN) =>
      repHref({
        game: game?.id,
        q: searchParams.get("q") ?? undefined,
        level: n,
        mods: searchParams.get("mods")?.split(",").filter(Boolean),
        back: searchParams.get("back") ?? undefined,
        trait: searchParams.get("trait") ?? undefined,
      }),
    [game, searchParams]
  );
  /**
   * The game of the day (the games plan, item 12): a Premium game is a
   * full round for a free account when it is today's free game and no
   * round of it was played today (lib/games.ts `gameOpen`). Any other
   * Premium game keeps today's door: Record opens the paywall. Read
   * only once the plan is known to be free.
   */
  const locked =
    game !== null &&
    needsPremium(game) &&
    plan === false &&
    !gameOpen(game, {
      premium: false,
      dayKey: dayKey(new Date()),
      roundsTodayOfGame: gameRows ? roundsToday(gameRows, game.id) : 0,
    });
  /**
   * The best before this take (M4, #53): the snapshot the idle line
   * reads, and what the results compare the round against. Taken while
   * the take is not yet stored (idle, think time, recording), never
   * after, so a round never breaks its own best.
   */
  const [gameBestBefore, setGameBestBefore] = useState<GameBestSnapshot | null>(null);
  const gameBestBeforeRef = useRef<GameBestSnapshot | null>(null);
  /** The dev camera's `?cutinAt=3`: the first cut-in at that second (never in production). */
  const cutinAt =
    process.env.NODE_ENV !== "production" ? Number(searchParams.get("cutinAt")) || null : null;
  const cutinAtRef = useRef<number | null>(cutinAt);
  cutinAtRef.current = cutinAt;
  /* The colour the screen wears (D50): the practice's trait family, as
     on the Today card that opened it, or the sky stage. */
  const family = practiceFamily(config, searchParams.get("trait"));
  /* The glass object the recording card stands (E51): Today's, carried
     through Start, or the lesson's own; none on the sky. */
  const art = recordingObject(config);

  const [phase, setPhase] = useState<Phase>("idle");

  /* The snapshot of the best (M4): retaken whenever the rows or the
     level change before the take is stored, held from Stop until the
     next take is set up. */
  useEffect(() => {
    if (phase !== "idle" && phase !== "frame" && phase !== "recording") return;
    const snap =
      game && gameRows && level !== null ? gameBestSnapshot(gameRows, game.id, level) : null;
    gameBestBeforeRef.current = snap;
    setGameBestBefore(snap);
  }, [phase, game, gameRows, level]);

  /* A level the ladder has not opened (an old link, a hand-edited one)
     plays the open one: the rung is climbed, never typed (M3). */
  useEffect(() => {
    if (phase !== "idle" || !ladder || level === null || level <= ladder.open) return;
    router.replace(levelHref(ladder.open));
  }, [phase, ladder, level, levelHref, router]);

  /** Which upload attempt is in flight, so the wait can say so. */
  const [attempt, setAttempt] = useState(0);
  /**
   * "Next lesson" links to /rep?lesson=… — the SAME route, so Next.js
   * keeps this component mounted and every piece of state with it. The
   * URL changed, `phase` stayed "results", and the screen sat there
   * showing the rep you just finished. Reported by Timothy as "the next
   * lesson button doesn't take you to the next lesson".
   *
   * Resetting on lessonId is what makes the navigation real. The key
   * carries the mods too, so a push that drops or changes them resets.
   */
  const lessonKey = repKey(searchParams);
  const lessonKeyRef = useRef(lessonKey);
  const [seconds, setSeconds] = useState(0);
  const [frameLeft, setFrameLeft] = useState(FRAME_SECONDS);
  /*
   * The meter's one number per frame (#219). A ref, not state: the
   * LevelMeter reads it on its own animation frame and moves the bars
   * through transforms, so the rep screen never re-renders for audio.
   * `peak` and `floor` track this rep's own loud and quiet so ordinary
   * speech fills the meter on any mic, in any room.
   */
  const meterLevel = useRef(0);
  const meterPeak = useRef(0);
  const meterFloor = useRef(1);
  /** The envelope of the recording being scored, drawn during the wait. */
  const [scoringWave, setScoringWave] = useState<number[]>([]);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  /**
   * The outbox key the result on screen travelled under (0016): what a
   * tester's match answer is filed by (migration 0020), since the stored
   * recording's id may never come back.
   */
  const [resultKey, setResultKey] = useState<string | null>(null);
  /* Tester mode (docs/testers.md): only a tester's results ask the
     match question. Read on open, and again when a result lands if that
     read failed, so a phone that opened this offline still asks. */
  const tester = useTester(resultKey);
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
  /** Demos's line while he cuts in (F1); null while he listens. */
  const [cutIn, setCutIn] = useState<string | null>(null);
  const [anticipate, setAnticipate] = useState<RewardMoment | null>(null);
  const [closing, setClosing] = useState<RewardMoment | null>(null);
  const [bests, setBests] = useState<RewardMoment[]>([]);
  const [notes, setNotes] = useState("");
  const [coined, setCoined] = useState(false);
  /**
   * A new best Index or three stars on this recording (D52, lib/rewards
   * `celebrates`): Demos swaps to his celebrate pose on the score step.
   */
  const [earnedNow, setEarnedNow] = useState(false);
  /**
   * A game round's history (the games plan, items 5 and 6): the game's
   * rows as they stood BEFORE this take (`gameRows`, read when the game
   * opens and again after each round) and with this round in, for the
   * ladder on Tomorrow, the round count in the header and "Best round
   * yet". Null when the read failed: then nothing about the ladder is
   * said.
   */
  const [walkRows, setWalkRows] = useState<{ before: GameRoundRow[]; now: GameRoundRow[] } | null>(null);
  /** The streak celebration's call is made for this result: the round's reveal waits for it (F3, F5). */
  const [rewardsReady, setRewardsReady] = useState(false);
  /**
   * What the phone knows at Stop (F7): the seconds Demos cut in at, from
   * the take's fired cut-ins, and who stopped it (`stopRep`'s `by`). Null
   * for a take this screen did not stop (a replay from the outbox): then
   * the wait says nothing it cannot trace.
   */
  const waitRef = useRef<{ cutIns: number[]; stoppedBy: StoppedBy | null } | null>(null);
  /**
   * recording-16: the topic card's top just before Record's tap, so the
   * layout effect can FLIP it from there to its recording place on a
   * spring instead of letting it cut 100px up the screen.
   */
  const topicRef = useRef<HTMLDivElement | null>(null);
  const flipFrom = useRef<{ top: number; height: number } | null>(null);

  // --- delivery feedback (§1) ---------------------------------------
  const [captureMode, setCaptureMode] = useState<CaptureMode>("voice");
  const [poseReady, setPoseReady] = useState<boolean | null>(null);
  /** The browser can do pose but the runtime would not load: a
   *  different cause, and the toggle says the true one (review, 25 Sep). */
  const [poseLoadFailed, setPoseLoadFailed] = useState(false);
  /** Why Video is off on this device, when it is (#412). */
  const [videoOff, setVideoOff] = useState<"lite" | "apple" | null>(null);
  /** The app whose browser this is (Instagram's, from the GC link), or null (#412). */
  const [inApp, setInApp] = useState<string | null>(null);
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
  /* Back from the paywall's account doors or Checkout's back arrow on a
     Premium game's idle screen (paywall=1): the sheet opens again. The
     debrief's sheet sends its way back to the stored recording instead. */
  usePaywallReturn(() => setPaywall({ reason: game?.name ?? "Premium games" }));
  const [repCount, setRepCount] = useState<number | null>(null);
  /* The tips disclosure is gone (#209): the tactics are the screen's
     content now, not a fold, because the four blocks of prose they were
     competing with are what left. */
  /** The stored list AFTER this recording landed, for the debrief's
   *  day-3 progress moment (the comparison card needs both ends). */
  const [repsNow, setRepsNow] = useState<RepRow[]>([]);
  /** Every recording after this one landed, a few columns each: the
   *  stars, the days spoken and the count, which the newest 90 rows
   *  stopped holding past 90 recordings. */
  const [spineNow, setSpineNow] = useState<RepSpine[]>([]);
  /**
   * For the save-progress wall (DECISIONS #134). Anonymity is read
   * AFTER the analysis, not on mount — rep 1 has no session until the
   * upload mints one, so a mount-time check would say "not anonymous"
   * on exactly the rep the wall exists for.
   */
  const [anon, setAnon] = useState(false);
  const [streakNow, setStreakNow] = useState(0);

  /**
   * Sticky per lesson type, and that is the whole rule now (#211): the
   * recording-one audio override is gone, so this no longer waits on
   * the history read to know what mode the screen is in.
   */
  useEffect(() => {
    setCaptureMode(captureModeFor(config.kind));
  }, [config.kind]);

  /**
   * Snapshot of where the user stood BEFORE this rep, captured on
   * mount. Without it the results screen can't say what changed, and
   * "what changed" is the only reward worth showing (DECISIONS #46).
   */
  const baselineRef = useRef<{
    stars: number;
    unitsOpen: string[];
    reps: RepRow[];
    /** Today already had a recording before this one. */
    didToday: boolean;
    /** How many recordings came before this one. */
    count: number;
    /** When it was read: a screen left open past midnight reads a new day (#416 review). */
    at: Date;
  } | null>(null);
  /** The baseline's "done today", only while it is still that day. */
  const doneToday = (b: { didToday: boolean; at: Date } | null) =>
    !!b && b.didToday && !dayTurned(b.at, new Date());

  /**
   * Can this browser do on-device pose? Feature detection, answered the
   * moment the toggle is drawn (#216). This used to await the whole
   * runtime, so the toggle sat greyed behind "Checking…" for as long as
   * ~15MB took to arrive, on every cold open, for people who were about
   * to record audio.
   */
  useEffect(() => {
    // Lite graphics (#412): a phone that crashed or lost its graphics
    // records Voice; the camera and the pose model are the heaviest
    // thing this screen can ask of it.
    const lite = liteGraphics();
    /* And on an iPhone or iPad for now (#412): every Voice + Video start
       testers made there under collection took the page down, the pose
       model alone adds about 110MB the page never gives back, and 80 of
       80 takes in the test were Voice. Back once a Video take is
       confirmed on an iPhone. */
    const apple = onAppleMobile();
    setVideoOff(lite ? "lite" : apple ? "apple" : null);
    setInApp(inAppBrowser(navigator.userAgent));
    setPoseReady(poseCapable() && !lite && !apple);
  }, []);

  /* Video not offered here: the take is Voice on this screen, and the
     saved preference stays as it was for a phone that can. */
  useEffect(() => {
    if (poseReady === false && captureMode === "voice_video") setCaptureMode("voice");
  }, [poseReady, captureMode]);

  /**
   * The runtime itself loads only once Voice + Video is the mode, and
   * it loads HERE, while the screen is being read, rather than after
   * the Rec tap. Same shared promise the recorder awaits, so a load
   * still in flight at Rec is joined, never repeated. If the load fails
   * (assets not staged, WASM blocked), the toggle reports it and the
   * mode drops back to Voice for this screen without touching the
   * saved preference, since the same person on a capable browser has
   * not changed their mind.
   */
  useEffect(() => {
    if (poseReady !== true || captureMode !== "voice_video") return;
    // Not on an iPhone (#412): the model loads at the Rec tap there, so
    // a screen that is only being read never holds it.
    if (onAppleMobile()) return;
    let live = true;
    loadPose()
      .then((p) => {
        if (!live || p) return;
        setPoseLoadFailed(true);
        setPoseReady(false);
        setCaptureMode("voice");
      })
      .catch(() => {
        if (!live) return;
        setPoseLoadFailed(true);
        setPoseReady(false);
        setCaptureMode("voice");
      });
    return () => {
      live = false;
    };
  }, [poseReady, captureMode]);

  useEffect(() => {
    Promise.all([fetchReps(), fetchRepSpine()])
      .then(async ([rows, all]) => {
        // Counted over every recording; the newest 90 rows are for the
        // records, which compare readings.
        setRepCount(all.length);
        const map = starsByLesson(all);
        const streak = computeStreak(all.map((r) => new Date(r.created_at)));
        baselineRef.current = {
          stars: totalStars(map),
          unitsOpen: unitStates(map)
            .filter((u) => !u.locked)
            .map((u) => u.name),
          reps: rows,
          didToday: streak.didToday,
          count: all.length,
          at: new Date(),
        };
        const xp = await fetchXp().catch(() => ({ total: 0, week: 0 }));
        setAnticipate(
          recordCue({ reps: rows, starMap: map, streak, xp: xp.total })
        );
      })
      .catch(() => {});
  }, []);

  const recRef = useRef<Take | null>(null);
  /** When the take on now started: a tester's record_stop says how long it ran. */
  const takeStartedAt = useRef(0);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  /** A start is opening the device: further taps wait for it. */
  const startingRef = useRef(false);
  /** This take's think time already ran out, so Record starts it. */
  const thoughtRef = useRef(false);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const configRef = useRef<RepConfig>(config);
  configRef.current = config;
  const captureModeRef = useRef<CaptureMode>(captureMode);
  captureModeRef.current = captureMode;

  const teardown = useCallback(() => {
    const r = recRef.current;
    if (!r) return;
    r.offWatch?.();
    cancelAnimationFrame(r.raf);
    if (r.interruptTimer) clearTimeout(r.interruptTimer);
    // The camera's frames, let go with the camera (#412).
    if (videoElRef.current) videoElRef.current.srcObject = null;
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
  const score = useCallback(async (
    form: FormData,
    outboxId: string | null,
    /** The recording this take was spoken for; defaults to the one on screen. */
    key: string = lessonKeyRef.current
  ) => {
    // A take keeps uploading after the screen moves to another
    // recording (a browser back mid-scoring), so it is still stored,
    // but its answer never takes over the other recording's screen.
    const live = () => lessonKeyRef.current === key;
    if (live()) {
      setPhase("analyzing");
      setError(null);
      setAttempt(0);
    }
    if (outboxId) markInFlight(outboxId);
    try {
      // Anonymous-first (DECISIONS #15): attribute the rep if a session
      // exists or can be minted; never block the rep on auth. Asked for
      // on every try, and refreshed once if the server says it lapsed, so
      // a ladder of four never sends a token that ran out on the way.
      const token = (force?: boolean) =>
        force ? sessionToken(true) : ensureSession();
      // Three retries with backoff for the failures waiting can fix
      // (network drops, gateway 5xx). The blob is already in the outbox,
      // so even a closed tab loses nothing (lib/rep-outbox.ts).
      // A gateway's 502 is HTML, and parsing it used to throw, so the
      // JSON parser's complaint ("Unexpected token <") became the
      // sentence the user read. Ours are the only words that reach them.
      const outcome = await sendWithRetry(form, token, (n) => {
        if (live()) setAttempt(n);
      });
      if (!outcome.ok && isFinalReject(outcome.status)) {
        // The server will never take this file (empty, unreadable, too
        // large, or a take the mic barely heard, #406). Keeping it would
        // resend it on every visit for good, so it goes, and the screen
        // says to record it again.
        if (outboxId) void outboxDelete(outboxId);
        if (!live()) return;
        pendingRef.current = null;
        const unheardTake = (outcome.data as { unheard?: boolean } | null)?.unheard === true;
        setError(unheardTake ? UNHEARD_COPY : "The audio couldn't be read. Record it again.");
        setPhase("error");
        return;
      }
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
      if (!live()) return;
      // A resend of a recording already stored (its first answer was
      // lost on the way back): the server hands back that recording, so
      // open it, judged read and all, rather than a debrief of nothing.
      const stored = data as { duplicate?: boolean; repId?: string | null };
      if (stored.duplicate && stored.repId) {
        pendingRef.current = null;
        routerRef.current.replace(`/rep/${stored.repId}`);
        return;
      }
      setResult(data as AnalyzeResponse);
      const key = form.get("clientId");
      setResultKey(typeof key === "string" ? key : null);
      setRewardsReady(false);
      setWalkRows(null);
      setPhase("results");
      pendingRef.current = null;
      // Streak is derived from stored reps, so read it back rather than
      // guessing — a rep that failed to persist shouldn't celebrate.
      const analyzed = data as AnalyzeResponse;
      /* A game round's rows: as they stood before the take, and read
         again with this round in (added here when the read does not hold
         it yet: a save that failed, a slow replica). The read is also the
         screen's rows from now on, so the next round here (Retake,
         Another round) draws the level, the best and today's free round
         from rows that hold this one. */
      const lessonId = String(form.get("lessonId") ?? "");
      const roundsBefore = gameRowsRef.current;
      const gameRead = lessonId.startsWith("game:")
        ? fetchGameRounds()
            .then((rows) => {
              const now = withRound(rows, analyzed, lessonId, typeof key === "string" ? key : null);
              if (live()) setGameRows(now);
              return now;
            })
            .catch(() => null)
        : Promise.resolve(null);
      Promise.all([fetchReps(), fetchRepSpine(), gameRead])
        .then(async ([reps, all, gameNow]) => {
          if (!live()) return;
          setRepsNow(reps);
          setSpineNow(all);
          // The streak and the freezes it earns count from day one.
          const dates = all.map((x) => new Date(x.created_at));
          // A failed freeze read rejects now; the debrief's celebration,
          // coins and closing note still land on the plain streak.
          const { streak } = await syncFreezes(dates).catch(() => ({
            streak: computeStreak(dates),
          }));
          if (!live()) return;
          // Only the take that made today count rolls the streak up; a
          // second take of the day used to replay the roll and its chime.
          // Read before the baseline below takes this take in.
          if (celebratesStreak(streak, { didToday: doneToday(baselineRef.current) })) setCelebrate(streak.current);
          setRewardsReady(true);
          setStreakNow(streak.current);
          /* Before the take: the snapshot, or, when it never landed, the
             rows read now without this round. */
          const gameBefore = gameNow
            ? (roundsBefore ??
              gameNow.filter((r) => r.id !== roundRowId(analyzed, typeof key === "string" ? key : null)))
            : null;
          if (gameNow && gameBefore) setWalkRows({ before: gameBefore, now: gameNow });
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

          // One coin per day you spoke (§4), and one for a week with
          // five closed challenge days in it (#281). Both granted from
          // the stored reps, so they heal rather than double-paying.
          syncCoins(
            reps.map((x) => new Date(x.created_at)),
            reps
          )
            .then((c) => setCoined(c.granted.length > 0))
            .catch(() => {});

          const before = baselineRef.current;
          if (before) {
            const map = starsByLesson(all);
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
            /* D52: the celebrate pose is for a new best Index or three
               stars. A star or a held streak is said elsewhere (the
               bests, the streak's own moment), not by spending it. */
            setEarnedNow(
              analyzed.scorable &&
                celebrates(before.reps, analyzed.metrics.stars, analyzed.ethosIndex)
            );
            // before.reps is the history captured on mount — the true
            // "before", independent of whether this rep persisted.
            // Streak-end rule: the last thing on screen decides whether
            // they come back, so it is always something true and good.
            // A take too short to score breaks no record and ends on the
            // streak or the count, never a number read off one word.
            const roundNow = analyzed.round ?? null;
            /* The best the idle screen showed before Record (M4), held
               from Stop; the rows' own when it was taken at another
               level or never taken. */
            const bestSnap = gameBestBeforeRef.current;
            const rewards = takeRewards({
              scorable: analyzed.scorable,
              prior: before.reps,
              metrics: analyzed.metrics,
              ethosIndex: analyzed.ethosIndex,
              gains: nextGains,
              streak,
              repCount: all.length,
              // M4: the level's best before this take against with it.
              gameBest:
                roundNow && gameNow && gameBefore
                  ? {
                      game: roundNow.game,
                      level: roundNow.level,
                      before:
                        bestSnap && bestSnap.game === roundNow.game && bestSnap.level === roundNow.level
                          ? bestSnap.best
                          : bestFor(gameBefore, roundNow.game, roundNow.level),
                      now: bestFor(gameNow, roundNow.game, roundNow.level),
                    }
                  : null,
            });
            setBests(rewards.bests);
            setClosing(rewards.closing);
          }
          // The next take on this screen (Retake, Go again, Practice N
          // of 3, Next lesson, Another round all keep it mounted) is
          // measured against the history that now holds this one, not
          // the one from when the screen opened: records, the streak
          // celebration and the stars are claimed once.
          const mapNow = starsByLesson(all);
          baselineRef.current = {
            stars: totalStars(mapNow),
            unitsOpen: unitStates(mapNow)
              .filter((u) => !u.locked)
              .map((u) => u.name),
            reps,
            // Spoken today, whether or not the row was stored.
            didToday: true,
            count: all.length,
            at: new Date(),
          };
          // And the line under the next Record reads from it too: the
          // one from the screen's open said "keeps a 6-day streak alive"
          // after the debrief had just said 7.
          const xp = await fetchXp().catch(() => ({ total: 0, week: 0 }));
          if (!live()) return;
          setAnticipate(recordCue({ reps, starMap: mapNow, streak, xp: xp.total }));
        })
        .catch(() => {
          // Unread, the reveal still plays: no streak celebration is coming.
          if (live()) setRewardsReady(true);
        });
    } catch (e) {
      // Another recording is on screen now; the outbox copy (if held)
      // is what sends this take later.
      if (!live()) return;
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
      // Not over a take that is starting or live (#412).
      if (startingRef.current || recRef.current) return;
      const p = pendingRef.current;
      if (p) void score(p.form, p.outboxId);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [phase, score]);

  /**
   * Stop the take and send it. `by` is who stopped it (F4): "you" for
   * the tap, "clock" for the cap's auto-stop, null when neither did (the
   * phone stopped hearing it), which the server reads off the length.
   */
  const stopRep = useCallback(async (by: StoppedBy | null = null) => {
    const r = recRef.current;
    if (!r || phaseRef.current !== "recording") return;
    // Claim the stop now. phaseRef only syncs on render, and the
    // recorder's own stop event (startRep) must not start a second one.
    phaseRef.current = "analyzing";
    // The recording this take was spoken for, read before any await, so
    // a browser back while it stops files it under its own lesson.
    const key = lessonKeyRef.current;
    const cfg = configRef.current;
    const mode = captureModeRef.current;
    const live = () => lessonKeyRef.current === key;
    // When it was spoken: the outbox sends this with the take
    // (`recordedAt`), so a late upload still lands on this day.
    const spokenAt = Date.now();
    testerRecord("record_stop", { seconds: ranFor(takeStartedAt.current, spokenAt) });
    buzz([20, 40, 20]);
    waitRef.current = { cutIns: firedCutIns(r.cutPlan).map((c) => c.at), stoppedBy: by };
    setPhase("analyzing");
    setCutIn(null);

    const blob = await new Promise<Blob>((resolve) => {
      const take = () =>
        resolve(new Blob(r.chunks, { type: r.recorder.mimeType }));
      // The mic went away mid-take (unplugged, permission revoked, the
      // OS took it): the recorder already stopped itself and holds the
      // take. Waiting for a second stop event would wait forever.
      if (r.recorder.state === "inactive") return take();
      r.recorder.onstop = take;
      // A recorder that never reports back still hands over what it caught.
      setTimeout(take, 3000);
      try {
        r.recorder.stop();
      } catch {
        take();
      }
    });
    if (live()) setAudioUrl(URL.createObjectURL(blob));

    // The loudness envelope, captured alongside the meter. This is what
    // lets the engine tell a silent gap from one the mic heard a sound
    // in — i.e. an "um" the transcript dropped.
    const envelope: Envelope = { levels: [...r.envelope], rate: ENVELOPE_RATE };
    if (live()) setScoringWave(envelope.levels);

    // Score the body before tearing the camera down. Everything below
    // this line is five numbers and a list of timestamps — the frames
    // themselves are dropped with the sampler.
    const frames = r.sampler?.stop() ?? [];
    const scored = frames.length > 0 ? scorePresence(frames) : null;
    if (live()) setPresence(scored?.scorable ? scored : null);

    // The local clip, for Premium playback with markers. Held as an object
    // URL in this tab and nowhere else — never uploaded, never stored.
    if (r.videoRecorder && r.videoRecorder.state !== "inactive") {
      const clip = await new Promise<Blob>((resolve) => {
        const take = () => resolve(new Blob(r.videoChunks, { type: r.videoRecorder!.mimeType }));
        r.videoRecorder!.onstop = take;
        // A recorder that never reports back must not hold the take (#412).
        setTimeout(take, 3000);
        try {
          r.videoRecorder!.stop();
        } catch {
          take();
        }
      });
      if (clip.size > 0 && live()) setClipUrl(URL.createObjectURL(clip));
    }

    // Only this take's devices: if the screen moved on, they were let go
    // already and recRef may hold a newer take.
    if (recRef.current === r) teardown();

    // Stopped before there was anything to hear (#406): a tap on Record
    // by mistake, or a mic that never started. Nothing is sent, so no
    // hourly slot is spent on it.
    if (spokenAt - takeStartedAt.current < MIN_TAKE_MS) {
      if (!live()) return;
      pendingRef.current = null;
      setError(TOO_SHORT_COPY);
      setPhase("error");
      return;
    }

    {
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const fields: Record<string, string> = {
        lessonId: cfg.lessonId,
        mode: cfg.kind,
        mods: cfg.mods.map((m) => m.id).join(","),
        xpMultiplier: String(cfg.xpMultiplier),
        captureMode: mode,
        // The judged-tier allowance resets on the user's own calendar
        // day, not on UTC's (§3). The offset names the calendar; the
        // outbox's `recordedAt` (replayForm) names the moment, which is
        // what lands a resumed upload on the day it was spoken.
        tzOffset: String(new Date(spokenAt).getTimezoneOffset()),
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
      /*
       * A game round says what it ran (the games plan, items 3 and 10):
       * its level, when Demos cut in and with what line, on the take's
       * own clock, and who stopped it. The server measures the round
       * from that and pays what ran: Interruption only when he cut in.
       */
      const roundGame = cfg.level !== null ? gameOfLessonId(cfg.lessonId) : null;
      if (roundGame && cfg.level !== null) {
        const cutIns = firedCutIns(r.cutPlan);
        fields.round = JSON.stringify({
          game: roundGame.id,
          level: cfg.level,
          cutIns,
          stoppedBy: by,
        });
        fields.xpMultiplier = String(
          gameXpMultiplier(roundGame, cfg.level, cutIns.length > 0, cfg.mods)
        );
      }

      // Into the outbox BEFORE the first upload attempt: from here the
      // recording survives a dead network, a killed tab, everything
      // short of clearing site data. It carries its owner, so a later
      // flush never sends it as whoever is signed in by then. The read
      // is local, so holding the take never waits on the network.
      const owner = (await currentSession())?.userId ?? null;
      const rep: OutboxRep = {
        id: newOutboxId(cfg.lessonId),
        createdAt: spokenAt,
        audio: blob,
        filename: `rep.${ext}`,
        fields,
        owner,
      };
      const held = await outboxPut(rep);
      if (held && owner === null) {
        // The first recording on this device: the upload mints its
        // session, and the held copy belongs to that session.
        await ensureSession().catch(() => null);
        const minted = await currentSession();
        if (minted) await outboxPut({ ...rep, owner: minted.userId });
      }
      await score(replayForm(rep), held ? rep.id : null, key);
    }
  }, [teardown, score]);

  const startRep = useCallback(async () => {
    // One take at a time. A second tap while the device opens (a double
    // tap, a slow permission bubble), or a tap with a take already live,
    // would start a second recorder that nothing ever stops.
    if (startingRef.current || recRef.current) return;
    startingRef.current = true;
    const key = lessonKeyRef.current;
    setError(null);
    setMicBlock(null);
    setSeconds(0);
    // The Rec tap is the gesture that licenses audio for the whole
    // session — the celebration chime minutes from now rides on it.
    // The chime itself never plays while the mic is hot (lib/sfx.ts).
    unlockSfx();
    const cfg = configRef.current;
    let wantsVideo = captureModeRef.current === "voice_video";
    /* What this start has opened so far (#412): a throw after the device
       is open must not leave the mic live, a recorder running and a
       context open behind the permission card. */
    const opened: { stream?: MediaStream; recorder?: MediaRecorder; videoRecorder?: MediaRecorder | null; ctx?: AudioContext } = {};
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: wantsVideo
            ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
            : false,
        });
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        if (!wantsVideo || !CAMERA_DEVICE_FAILURES.has(name)) throw e;
        // The camera is missing or another app holds it; the mic may be
        // fine. Record with voice on this screen, and leave the saved
        // preference as it is (#216's rule for a pose load that fails).
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        wantsVideo = false;
        captureModeRef.current = "voice";
        setCaptureMode("voice");
      }
      opened.stream = stream;
      // The screen moved to another recording while the device opened.
      if (lessonKeyRef.current !== key) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

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
      opened.recorder = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      /* The take's clock starts when the recorder says it has (F2): a
         cut-in's second is then on the same clock as the audio, which is
         the clock Whisper's word times are on. Until the event, the
         moment start was asked for. */
      const clock = { startedAt: performance.now() };
      recorder.addEventListener("start", () => {
        clock.startedAt = performance.now();
      });
      recorder.start(1000);
      // If the recorder stops on its own (the mic was unplugged or taken
      // mid-take), score what it caught now instead of leaving the take
      // to a Stop tap or the cap, which would wait on a stop that never
      // comes.
      recorder.addEventListener("stop", () => {
        if (
          phaseRef.current === "recording" &&
          recRef.current?.recorder === recorder
        ) {
          void stopRep();
        }
      });

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
          opened.videoRecorder = videoRecorder;
        } catch {
          videoRecorder = null; // playback is a bonus, never the rep
        }
      }

      // Level meter. iOS Safari creates AudioContexts suspended even
      // inside a user gesture — resume explicitly.
      const ctx = new AudioContext();
      opened.ctx = ctx;
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
        // Adaptive gain for the DISPLAY only: the loudest moment so far
        // (decaying, so a shout does not flatten the next minute) sets
        // full scale and the quietest sets the floor. The envelope
        // below keeps the engine's fixed gain, which lib/envelope.ts
        // calibrates against itself.
        meterPeak.current = Math.max(meterPeak.current * 0.985, rms);
        meterFloor.current = Math.min(meterFloor.current * 1.01 + 0.0005, rms);
        const span = Math.max(meterPeak.current - meterFloor.current, 0.03);
        const above = Math.min(1, Math.max(0, (rms - meterFloor.current) / span));
        meterLevel.current = Math.sqrt(above);
        const r = recRef.current;
        if (r) {
          /* Demos cuts in mid-word (F1): on the first frame at or after
             his aim where this take's level clears the envelope's voiced
             line (the same fraction of its floor-to-speech range the
             engine hears a sound by), or at the window's end into a
             silence. Never after Stop: Stop claims the phase first. */
          if (phaseRef.current === "recording" && r.cutPlan.length > 0) {
            const elapsed = (performance.now() - r.clock.startedAt) / 1000;
            const due = nextCutIn(r.cutPlan, elapsed, above >= VOICED_THRESHOLD);
            if (due) {
              due.at = Math.round(elapsed * 100) / 100;
              due.line = pickLine(r.cutLines, r.cutPlan.map((p) => p.line));
              setCutIn(due.line);
              buzz([40, 60, 40]);
              if (r.interruptTimer) clearTimeout(r.interruptTimer);
              r.interruptTimer = setTimeout(() => setCutIn(null), CUT_IN_HOLD_S * 1000);
            }
          }
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

      /* When Demos cuts in on this take (F1, M2): the level's windows, an
         aim drawn in the first half of each. The dev camera's
         `?cutinAt=3` sets the first one to that second. */
      const windows = cfg.cutIns.map(([lo, hi]) => [lo, hi] as [number, number]);
      const devAt = cutinAtRef.current;
      if (devAt !== null && devAt > 0 && windows.length > 0) windows[0] = [devAt, devAt];
      const cutGame = gameOfLessonId(cfg.lessonId);

      const rec: Take = {
        recorder,
        stream,
        ctx,
        raf: 0,
        chunks,
        crowd,
        interruptTimer: null,
        clock,
        cutPlan: planCutIns(windows),
        cutLines: cutGame?.cutInLines.length ? cutGame.cutInLines : CUT_IN_LINES,
        videoRecorder,
        videoChunks,
        sampler: null,
        envelope: [],
        envelopeAt: 0,
        offWatch: null,
      };
      recRef.current = rec;
      waitRef.current = null;
      rec.raf = requestAnimationFrame(tick);

      /*
       * A take the phone stopped hearing ends there (#412). iOS takes the
       * mic from a page that goes to the background (a notification
       * opened, another app), and the clock used to run on over silence
       * until Stop, so the take uploaded with its end missing (Alan,
       * 4 Nov; Mathias, 2 Nov). Now what was heard is scored, and #406's
       * guards turn away a take too short to score. Hidden counts only on
       * an iPhone or iPad, where hidden means the mic is gone; anywhere,
       * a track the system muted or ended does.
       */
      const track = stream.getAudioTracks()[0];
      const onLost = () => {
        if (recRef.current !== rec || phaseRef.current !== "recording") return;
        const gone =
          track?.readyState === "ended" ||
          track?.muted === true ||
          (document.visibilityState === "hidden" && onAppleMobile());
        if (gone) void stopRep();
      };
      document.addEventListener("visibilitychange", onLost);
      track?.addEventListener("mute", onLost);
      track?.addEventListener("ended", onLost);
      rec.offWatch = () => {
        document.removeEventListener("visibilitychange", onLost);
        track?.removeEventListener("mute", onLost);
        track?.removeEventListener("ended", onLost);
      };

      // Pose sampling + the live ring. Free for everyone (§2): it's
      // local compute at zero marginal cost, and it's the part that
      // feels like magic in the first thirty seconds.
      if (wantsVideo && stream.getVideoTracks().length > 0) {
        const video = videoElRef.current;
        const landmarker = await loadPose();
        // The take was let go while the runtime loaded (the screen moved).
        if (recRef.current !== rec) return;
        if (video && landmarker) {
          video.srcObject = stream;
          await video.play().catch(() => {});
          if (recRef.current !== rec) return;
          const sampler = samplePose(video, landmarker, (frames) =>
            setRing(ringState(frames))
          );
          rec.sampler = sampler;
          setPoseFrames(sampler.frames);
        }
      }

      buzz(30);
      // recording-16: where the card stands now, read before the layout
      // changes, so the layout effect below can glide it to its new place.
      const was = topicRef.current?.getBoundingClientRect();
      flipFrom.current = was ? { top: was.top, height: was.height } : null;
      setPhase("recording");
      // The next take gets its own think time.
      thoughtRef.current = false;
      // A tester on consent version 3 (a no-op for everyone else).
      takeStartedAt.current = Date.now();
      testerRecord("record_start", { video: captureModeRef.current === "voice_video" });
    } catch (e) {
      // Let go of whatever this start opened before it threw (#412).
      if (opened.stream && recRef.current?.stream === opened.stream) {
        try {
          recRef.current.recorder.onstop = null;
          if (recRef.current.recorder.state !== "inactive") recRef.current.recorder.stop();
          if (recRef.current.videoRecorder && recRef.current.videoRecorder.state !== "inactive") recRef.current.videoRecorder.stop();
        } catch {}
        teardown();
      } else {
        try {
          if (opened.recorder && opened.recorder.state !== "inactive") opened.recorder.stop();
          if (opened.videoRecorder && opened.videoRecorder.state !== "inactive") opened.videoRecorder.stop();
        } catch {}
        opened.stream?.getTracks().forEach((t) => t.stop());
        void opened.ctx?.close().catch(() => {});
      }
      // Refused for a recording the screen has already left.
      if (lessonKeyRef.current !== key) return;
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
      // A start the mic refused, for tester collection (#412): iOS 26 can
      // refuse with Allow set until Safari is quit (webkit 319706).
      testerRecord("record_start", { video: captureModeRef.current === "voice_video", blocked: name || "unknown" });
      setError(null);
      setPhase("error");
    } finally {
      startingRef.current = false;
    }
  }, [stopRep, teardown]);

  /**
   * Start over (#407, Vincent: "I clicked record by accident"). The take
   * in progress is thrown away on the phone: nothing is sent or stored,
   * no hourly slot is spent, and Record is back for a fresh start.
   */
  const discardTake = useCallback(() => {
    const r = recRef.current;
    if (!r || phaseRef.current !== "recording") return;
    // Claimed first, so the recorder's own stop event finds nothing to score.
    phaseRef.current = "idle";
    try {
      r.recorder.onstop = null;
      if (r.recorder.state !== "inactive") r.recorder.stop();
    } catch {}
    try {
      if (r.videoRecorder && r.videoRecorder.state !== "inactive") r.videoRecorder.stop();
    } catch {}
    teardown();
    // A thrown-away take still ends for tester collection: without the
    // stop, every Start over read as a page that died mid-take (#412).
    testerRecord("record_stop", {
      discarded: true,
      seconds: ranFor(takeStartedAt.current),
    });
    setCutIn(null);
    setPoseFrames(null);
    setRing("ok");
    setSeconds(0);
    meterLevel.current = 0;
    meterPeak.current = 0;
    meterFloor.current = 1;
    setPhase("idle");
  }, [teardown]);

  /**
   * Retake — same prompt, clean slate. The rep that just happened is
   * already stored and still counts; this is another attempt at the
   * same thing, not an undo.
   */
  const retake = useCallback(() => {
    setRepCount((n) => baselineRef.current?.count ?? n);
    setResult(null);
    setBests([]);
    setClosing(null);
    setCelebrate(null);
    setEarnedNow(false);
    setWalkRows(null);
    setRewardsReady(false);
    // The coin belongs to the take that earned it: the retake's score
    // step showed "+1" until its own coin read came back, or for good
    // when that read failed.
    setCoined(false);
    setSeconds(0);
    meterLevel.current = 0;
    meterPeak.current = 0;
    meterFloor.current = 1;
    setPresence(null);
    setRing("ok");
    setPoseFrames(null);
    setHeldS(0);
    setClipUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setPhase("idle");
    window.scrollTo({ top: 0 });
  }, []);

  /*
   * The celebration's end. Stable, because StreakCelebration keys its
   * hold timers on this callback: an inline arrow was a new function on
   * every render of this screen, and each late result (the coin, the
   * session, the bests) restarted the 1.8s hold, so the overlay stayed
   * up for as long as answers kept landing.
   */
  const celebrated = useCallback(() => {
    setCelebrate(null);
    // The overlay hands focus back to its opener, and the opener (Stop)
    // is gone: land on the step button so a keyboard does not restart
    // from the top of the page.
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("main [data-step-action]")?.focus()
    );
  }, []);

  /** Frame step (DECISIONS #35): opt-in think time before the clock. */
  const begin = useCallback(() => {
    // A question held back until Record (Interview, levels 2 and 3) is
    // the level's whole condition: no think time in front of it.
    if (
      !configRef.current.revealOnRecord &&
      thinksFirst(readPrefs().frameStep, thoughtRef.current)
    ) {
      setFrameLeft(FRAME_SECONDS);
      setPhase("frame");
    } else {
      void startRep();
    }
  }, [startRep]);

  useEffect(() => {
    if (lessonKeyRef.current === lessonKey) return;
    lessonKeyRef.current = lessonKey;
    // A take still in progress belongs to the recording the person left
    // (a browser back mid-take): discard it, the way leaving the screen
    // does, so the mic is never on behind a Record button.
    const r = recRef.current;
    if (r) {
      // A take already stopping sent its own stop; a live one is thrown away.
      const live = phaseRef.current === "recording";
      try {
        r.recorder.stop();
        r.videoRecorder?.stop();
      } catch {}
      teardown();
      if (live) {
        testerRecord("record_stop", {
          discarded: true,
          seconds: ranFor(takeStartedAt.current),
        });
      }
    }
    // The last recording's refused mic, failed upload and spent think
    // time are not this one's: a refusal left the next recording an idle
    // screen with no Record button and no help.
    setMicBlock(null);
    setError(null);
    pendingRef.current = null;
    thoughtRef.current = false;
    setCutIn(null);
    setRepCount((n) => baselineRef.current?.count ?? n);
    setResult(null);
    setPresence(null);
    setBests([]);
    setClosing(null);
    setCelebrate(null);
    setEarnedNow(false);
    setWalkRows(null);
    setRewardsReady(false);
    setCoined(false);
    setSeconds(0);
    setRing("ok");
    setPoseFrames(null);
    setHeldS(0);
    setNotes("");
    meterLevel.current = 0;
    meterPeak.current = 0;
    meterFloor.current = 1;
    setClipUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setPhase("idle");
    window.scrollTo({ top: 0 });
  }, [lessonKey, teardown]);

  /*
   * recording-16 (DESIGN.md: nothing teleports). On Record the topic
   * card loses the idle screen's headroom and centring and steps its
   * type down, so it used to cut about 100px up the screen in one
   * frame. FLIP: the top was read just before the phase changed; read
   * it again now, after layout and before paint, put the card back where
   * it was with a transform, and let the base spring bring it home.
   * Reduced motion lands it at once.
   */
  useLayoutEffect(() => {
    const from = flipFrom.current;
    flipFrom.current = null;
    const el = topicRef.current;
    if (phase !== "recording" || from === null || !el) return;
    const now = el.getBoundingClientRect();
    const offset = from.top - now.top;
    /* D50: the idle card is tall, like Today's, and the live one is
       shrunk at the top, so the card's own height travels with it on
       the same spring, from what it was to what it is. */
    const card = el.firstElementChild as HTMLElement | null;
    if (card && Math.abs(from.height - now.height) >= 1 && !prefersReducedMotion()) {
      card.animate([{ height: `${from.height}px` }, { height: `${now.height}px` }], {
        duration: springMs(SPRING.base),
        easing: springEasing(SPRING.base),
      });
    }
    if (Math.abs(offset) < 1) return;
    void animateSpring(el, {
      from: offset,
      to: 0,
      spring: SPRING.base,
      reduced: prefersReducedMotion(),
    }).then(() => {
      el.style.transform = "";
    });
  }, [phase]);

  // Frame countdown
  useEffect(() => {
    if (phase !== "frame") return;
    const t = setInterval(() => {
      setFrameLeft((s) => {
        if (s <= 1) {
          thoughtRef.current = true;
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
        if (s + 1 >= cap) void stopRep("clock");
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, stopRep, config.maxSeconds]);

  /*
   * The clock is the game (F4). Speed rush's digits pop once a second
   * through its last five, 1.06 back to 1 on the snappy spring, under
   * the terracotta its last ten already wear. Visual only: the mic is
   * hot, so nothing ticks. Reduced motion and lite keep them still.
   */
  const clockRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (phase !== "recording" || gameId !== "rush") return;
    const left = config.maxSeconds - seconds;
    const el = clockRef.current;
    if (left < 1 || left > 5 || !el || prefersReducedMotion()) return;
    el.animate([{ transform: "scale(1.06)" }, { transform: "scale(1)" }], {
      duration: springMs(SPRING.snappy),
      easing: springEasing(SPRING.snappy),
    });
  }, [phase, gameId, seconds, config.maxSeconds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const r = recRef.current;
      // Let go first, so the recorder's own stop event (startRep) reads
      // a discarded take, not one to score after the screen is gone.
      recRef.current = null;
      if (r) {
        // Not stopped by Stop yet: the take is thrown away, and tester
        // collection hears that rather than a take that died.
        if (phaseRef.current === "recording") {
          testerRecord("record_stop", {
            discarded: true,
            seconds: ranFor(takeStartedAt.current),
          });
        }
        try {
          r.recorder.stop();
          r.videoRecorder?.stop();
        } catch {}
        // The lost-mic listeners (#412) held this take's audio in memory
        // until a reload.
        r.offWatch?.();
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
          bests={bests}
          closing={closing}
          earned={earnedNow}
          presence={presence}
          tester={tester}
          resultKey={resultKey}
          wave={scoringWave}
          clipUrl={clipUrl}
          audioUrl={audioUrl}
          premium={premium}
          coined={coined}
          anonymous={anon}
          repCountBefore={repCount}
          streakNow={streakNow}
          repsNow={repsNow}
          spineNow={spineNow}
          walkRows={walkRows}
          streakUp={celebrate !== null}
          rewardsReady={rewardsReady}
          onUpgrade={setPaywall}
          onRetake={retake}
        />
        {celebrate !== null && (
          <StreakCelebration
            streak={celebrate}
            week={weekView(spineNow, new Date()).days}
            onDone={celebrated}
          />
        )}
        {paywall && (
          <Paywall
            reason={paywall.reason}
            headline={paywall.headline}
            taste={paywall.taste}
            // The debrief lives only in this page's memory, so the way
            // back from the account doors or Checkout is the stored
            // recording (which reopens the sheet), or You before it is
            // stored. Never this live /rep address: it lands on an
            // empty Record screen.
            returnTo={result.repId ? `/rep/${result.repId}` : "/you"}
            onClose={() => setPaywall(null)}
            onUnlocked={() => {
              setPremium(true);
              setPlan(true);
              setPaywall(null);
            }}
          />
        )}
      </>
    );
  }

  const capLabel = fmt(config.maxSeconds);
  const promptHidden = config.hidePrompt && phase !== "idle";
  /* Which string is the TOPIC and which the line over the tiles
     (lib/rep-config.ts `recordingText`, held by its tests). */
  const { topic: topicText, heading } = recordingText(config);
  /* The boss's prompt carries a scoring rule after its first sentence
     ("wrong claims cost more"). It is not cut: it shows as a tactic
     face under the line, sentence on tap, because the score may not
     mark down something the screen never said (review, 25 Sep). */
  const bossParts = config.kind === "boss" ? splitPrompt(config.prompt) : null;
  const doLine = bossParts?.line ?? heading;
  const doRule = bossParts?.rule ?? null;
  /*
   * A tip yields to a live nudge: the nudge is about this second of this
   * rep, the tip is general advice, and stacking them means neither gets
   * read. `seconds` already ticks once a second, so this recomputes at
   * exactly the rate it needs to and no faster.
   */
  /* And to Demos (F1): from a second before he may cut in to 3.5s after
     he did, so his line and a tip never share the screen. Speed rush
     keeps one tip, the closing line (F4). */
  const cutPlan = phase === "recording" ? (recRef.current?.cutPlan ?? []) : [];
  const liveTip =
    ring === "ok" && !yieldsToCutIn(seconds, cutPlan)
      ? liveTipAt(seconds, config.maxSeconds, captureMode === "voice_video", liveTipsFor(game?.id))
      : null;
  /* Interview at levels 2 and 3 (M2): the question stays on the card's
     back until Record, then arrives with the card's own glide. */
  const questionHidden = config.revealOnRecord && phase !== "recording";
  /* "Q&A, level 2": one idea, the game at its level; level 1 is the game. */
  const cardEyebrow =
    game && level !== null && level > 1 ? `${game.name}, level ${level}` : eyebrowOf(config.unit);
  const gameBestLine = bestLine(gameBestBefore);
  const gameBestParts = bestParts(gameBestBefore);
  /* Mods stacked on a game beyond the ones it stages: still named. */
  const gameExtras =
    game && level !== null
      ? config.mods.filter((m) => !gameModIds(game, level).includes(m.id))
      : [];
  /* Interview's window on the ring (F4): 1:00 to the clock's end, a
     picture tone the sweep runs into. */
  const ringWindow =
    game?.id === "interview" && config.maxSeconds > INTERVIEW_WINDOW[0]
      ? INTERVIEW_WINDOW[0] / config.maxSeconds
      : null;

  /*
   * Where this recording came FROM, if anywhere (#258). A lesson sends
   * somebody out here and needs them back on its own last screen,
   * because the change it is about to show them is the whole lesson.
   * Same-origin paths only: a `back` that could point off the app would
   * be an open redirect wearing a query string.
   */
  const backTo = safeBack(searchParams.get("back"));
  const backHref = backTo ?? defaultBack(config);
  /*
   * recording-3: while the mic is hot (and while its take is being
   * scored) Stop is the only control. Leaving would unmount the
   * recorder without scoring or saving the take. The row keeps its 44px
   * so the card does not jump twice, and `inert` takes it out of the
   * tab order and the accessibility tree along with the pointer.
   */
  const micHot = phase === "recording" || phase === "analyzing";
  /*
   * The scoring wait's one line (F7): when Demos cut in, or who stopped
   * the clock, as this screen saw it at Stop. A take it did not stop, or
   * one the phone stopped hearing before the cap, says nothing it cannot
   * trace.
   */
  const waitNow = phase === "analyzing" ? waitRef.current : null;
  const waitStopped: StoppedBy | null =
    waitNow?.stoppedBy ?? (seconds >= config.maxSeconds ? "clock" : null);
  const cutInStaged = config.cutIns.length > 0;
  const scoringFact =
    waitNow && (cutInStaged || waitStopped)
      ? waitFact({
          gameId,
          cutInStaged,
          cutIns: waitNow.cutIns,
          stoppedBy: waitStopped ?? "you",
          seconds,
        })
      : null;

  return (
    <main
      className={`relative isolate flex min-h-dvh flex-col px-5 pb-8 pt-[env(safe-area-inset-top)] ${
        /* A game's idle screen carries two more rows (the level, the
           best): on a phone under 700pt tall (375x667) the rhythm steps
           in so Record stays on the first screen. */
        game ? "[@media(max-height:700px)]:pb-5" : ""
      }`}
    >
      {/* D50: the ground is the plain ground. The amber glow under
          Record and the amber card over it broke the day's colour at
          the one moment it should carry: the card wears the practice's
          family now, and Record is the screen's one warm thing. */}
      {/* While the mic is hot the way back holds its row, so nothing
          moves; under 600pt tall (320x568) the row folds away instead,
          so Stop and Start over stand on the first screen (#412). */}
      <div
        className={`flex self-start ${
          micHot ? "invisible pointer-events-none [@media(max-height:600px)]:h-0 [@media(max-height:600px)]:overflow-hidden" : ""
        }`}
        aria-hidden={micHot || undefined}
        inert={micHot || undefined}
      >
        <BackLink href={backHref} label={backLabel(backHref)} className="" />
      </div>
      {/*
       * The topic is the hero (feedback round, 25 Sep). A first-time
       * user in the audience read the old screen, an eyebrow, a name, a
       * grey paragraph and three numbered sentences, as a document she
       * would not read. Now: what you will talk about, big, on a colour
       * ground with Demos on its corner; the one line of what to do; the
       * tactics as three tiles you take in by looking, each opening its
       * full sentence on a tap. The tactics still yield to the live tips
       * once the clock runs, because you cannot read and speak at once.
       * The card leaves for the scoring wait, which has its own stage.
       */}
      {/* On idle the topic block takes the free height and centres in
          it, so the screen is the card, the tiles and the tap, not the
          tiles and then a hole above the tap (review, 25 Sep). Demos no
          longer stands on the card (D50): he arrives as the listener. */}
      <div
        className={
          phase === "idle"
            ? `flex flex-1 flex-col justify-center pb-8 ${game ? "[@media(max-height:700px)]:pb-4" : ""}`
            : ""
        }
      >
      {phase !== "analyzing" && (
        /* Idle, the card takes the column's free height, 168 to 300, so a
           practice with more under it (the boss's tactic line) gets a
           shorter card rather than a screen that scrolls Record's caption
           off the bottom. Under 600pt tall (320x568) it is as tall as its
           words, so Record rises into view (F12). */
        <div
          ref={topicRef}
          /* A best's plaque below takes its room from this card's free
             height on a short phone (globals.css, .best-plaque). */
          data-best-room={phase === "idle" && gameBestParts ? "true" : undefined}
          className={
            phase === "idle"
              ? `mt-4 flex max-h-[300px] min-h-[168px] flex-1 flex-col [@media(max-height:600px)]:min-h-0 ${game ? "[@media(max-height:700px)]:mt-2" : ""}`
              : "mt-4"
          }
        >
          <TopicCard
            eyebrow={cardEyebrow}
            topic={
              promptHidden
                ? "Prompt hidden. That's the mod."
                : questionHidden
                  ? "Press Record to see the question."
                  : topicText
            }
            family={family}
            art={art}
            compact={phase !== "idle"}
          />
        </div>
      )}

      {phase === "idle" && (
        <div className={`mt-6 ${game ? "[@media(max-height:700px)]:mt-4" : ""}`}>
          {/* recording-15: the instruction over the three tactics, a clear
              step above their 14px labels rather than a fourth label. */}
          <h2 className="font-display text-lead font-bold">{doLine}</h2>
          {/* The best at this level, once there is one (M4), as a plaque
              (Timothy, 6 Nov: an important milestone). Its row opens on
              the base spring once the ladder is read, so the tips glide
              down rather than jump; no best, no row. */}
          {game && (
            <div className="best-slot" data-open={gameBestParts ? "true" : undefined}>
              <div>
                {gameBestParts && gameBestLine && (
                  <BestPlaque
                    parts={gameBestParts}
                    label={gameBestLine}
                    className="mt-4 [@media(max-height:700px)]:mt-2"
                  />
                )}
              </div>
            </div>
          )}
          {doRule && <TipLine tip={doRule} className="mt-2" />}
          <TipStrip
            tips={config.tips}
            label={null}
            className={`mt-3 ${game ? "[@media(max-height:700px)]:mt-2" : ""}`}
          />
        </div>
      )}

      {/* A game's chip row is its level (M2): the opened levels, the
          XP the level pays. While the clock runs the card's eyebrow
          carries the level, so the row steps out. */}
      {game && level !== null && phase === "idle" && (
        <LevelControl
          className="mt-3 [@media(max-height:700px)]:mt-2"
          level={level}
          open={ladder?.open ?? null}
          xp={config.xpMultiplier}
          onChange={(n) => {
            if (n !== level) router.replace(levelHref(n));
          }}
        />
      )}
      {game && gameExtras.length > 0 && phase === "idle" && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {gameExtras.map((m) => (
            <span
              key={m.id}
              className="rounded-full bg-surface px-2.5 py-1 text-caption font-bold text-ink"
            >
              {m.name}
            </span>
          ))}
        </div>
      )}
      {!game && config.mods.length > 0 && phase !== "analyzing" && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {config.mods.map((m) => (
            <span
              key={m.id}
              className="rounded-full bg-surface px-2.5 py-1 text-caption font-bold text-ink"
            >
              {m.name}
            </span>
          ))}
          <span className="text-caption font-semibold text-stone-500">×{config.xpMultiplier} XP</span>
        </div>
      )}

      {config.crowdNoise && phase === "idle" && (
        <p className="mt-2 text-caption text-stone-500">
          Headphones on, or the café bleeds into your mic.
        </p>
      )}
      </div>

      <div
        className={`flex flex-col items-center gap-6 [@media(max-height:700px)]:gap-3 ${
          phase === "idle" ? "" : "flex-1 justify-center"
        } ${
          /* Under 600pt the listener steps out (#412), and the room he
             leaves keeps Stop's ring clear of the wave. */
          phase === "recording" ? "[@media(max-height:600px)]:gap-4" : ""
        }`}
      >
        {phase === "frame" && (
          <div className="arrive w-full">
            <div className="flex items-baseline justify-between">
              <div className="font-display text-num-l tabular-nums">
                {frameLeft}
              </div>
              <div className="label-data">seconds to think</div>
            </div>

            {/* Structure tips, by the SHAPE of answer the prompt asks
                for. We know that much honestly; we don't know what
                you're going to say, so we don't pretend to. The same
                tiles as the idle screen (feedback round, 25 Sep): a
                numbered list here was the same wall one tap later. */}
            {/* PRINCIPLES 4: an eyebrow, not tracked capitals. */}
            <div className="eyebrow mt-5">Shape it like this</div>
            <TipStrip tips={config.tips} label={null} className="mt-3" />

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notes: first line, last line, one example…"
              className="mt-3 w-full rounded-control border border-edge bg-surface p-4 text-read transition-colors placeholder:text-stone-400 focus:border-terracotta-500"
            />
            <p className="mt-2 text-caption text-stone-400">
              Hidden once you record.
            </p>
          </div>
        )}

        {phase === "recording" && (
          <div className="arrive flex w-full flex-col items-center gap-6 [@media(max-height:700px)]:gap-3">
            <div
              className={`font-display text-num-hero tabular-nums transition-colors ${
                config.maxSeconds - seconds <= 10 ? "text-terracotta-700" : ""
              }`}
            >
              <span ref={clockRef} className="inline-block">
                {fmt(seconds)}
              </span>
              {/* recording-17: the cap in the clock's own face, a step
                  down, so the two numbers read as one reading. */}
              <span className="font-display text-body font-semibold tracking-normal text-stone-500">
                {" "}
                / {capLabel}
              </span>
            </div>
            {/*
             * One tip, at the moment it applies (lib/live-tips.ts), over
             * the waveform it is about (D51). It yields to a live nudge
             * — two messages at once is one message nobody reads — and
             * the row keeps its height either way so nothing jumps.
             */}
            <div className="relative flex h-6 items-center">
              <span
                className={`text-center text-body leading-tight text-stone-500 transition-opacity dur-max ${
                  liveTip ? "opacity-100" : "opacity-0"
                }`}
              >
                {liveTip ?? ""}
              </span>
              {/* Under 600pt tall the listener steps out (#412), so his
                  cut-in stands here, centred over the wave (F1). */}
              {cutIn && captureMode !== "voice_video" && (
                <div className="pointer-events-none absolute left-1/2 top-0 z-10 hidden w-max max-w-[calc(100vw-40px)] -translate-x-1/2 [@media(max-height:600px)]:block">
                  <CutInPill line={cutIn} />
                </div>
              )}
            </div>
            {/* D51: the take as a waveform the column's width, 120 tall,
                rolling left from the centre, in the practice's tone.
                While Demos has the floor it steps back, so his line
                stands over a quiet wave instead of cutting through its
                bars (the games look loop, 390x844 and 320x568). */}
            <div
              className={`rec-wave w-full transition-opacity duration-(--duration-base) ease-(--ease-out) ${
                cutIn ? "opacity-25" : ""
              }`}
              data-family={family}
              data-trait={family === "sky" ? undefined : family}
            >
              <LevelMeter level={meterLevel} bars={WAVE_BARS} height={WAVE_H} centre />
            </div>
          </div>
        )}

        {phase === "analyzing" && (
          <ScoringStage
            levels={scoringWave}
            seconds={seconds}
            boss={config.kind === "boss"}
            attempt={attempt}
            fact={scoringFact}
            cutIns={waitNow?.cutIns ?? []}
          />
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
            className={`relative overflow-hidden rounded-sheet transition-shadow ${
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
            {/* In Video the self-view stands where he would (F1): his
                cut-in sits inside its top edge, clear of Stop. */}
            {cutIn && (
              <div className="pointer-events-none absolute inset-x-2 top-2 flex justify-center">
                <CutInPill line={cutIn} />
              </div>
            )}
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
          <div className="mt-2.5 h-[18px] text-center text-link text-stone-600">
            {ring !== "ok" ? ringNote(ring) : ""}
          </div>
        </div>

        {/*
         * Demos hears you (DECISIONS #243). He used to be a still WebP
         * beside a live meter, which says the numbers are alive and the
         * character is a sticker — on a speaking app, of all things.
         * Now he runs off the same level the meter reads: ears up with
         * volume, eyes tracking the waveform, a lean in when speech
         * starts and a settle when it stops.
         */}
        {phase === "recording" && captureMode !== "voice_video" && (
          /* D51: he listens in the column, scaled to the room. Under
             600pt tall there is no room for him and Stop and Start over
             (#407) together, so he steps out there and the two taps
             stay on the first screen (#412). */
          <div className="w-[clamp(120px,18vh,160px)] [@media(max-height:600px)]:hidden">
            <DemosHears level={meterLevel} size={160} fluid speaking={cutIn} />
          </div>
        )}

        {/*
         * Voice or Voice + Video, from the first recording (DECISIONS
         * #211, amending #68), demoted to a small pair beside the tap it
         * configures (feedback round, 25 Sep). The camera is still OFF
         * by default on a daily lesson, so nothing is asked for that
         * nobody chose.
         */}
        {phase === "idle" && (
          <ModeToggle
            mode={captureMode}
            available={poseReady === true}
            reason={
              poseReady === false
                ? poseLoadFailed
                  ? "Video couldn't load. Voice works."
                  : videoOff === "lite"
                    ? "Video is off with Lite graphics. Voice works."
                    : videoOff === "apple"
                      ? "Video is off on iPhone for now. Voice works."
                      : "Video isn't available here."
                : undefined
            }
            onChange={(m) => {
              setCaptureMode(m);
              writeCaptureMode(config.kind, m);
            }}
          />
        )}
        {phase === "idle" && inApp && (
          <p className="mt-3 max-w-[320px] text-center text-caption text-stone-500">
            {inAppLine(inApp)}
          </p>
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
                      if (startingRef.current || recRef.current) return;
                      const p = pendingRef.current;
                      if (p) void score(p.form, p.outboxId);
                    }
                  : undefined
              }
              retryLabel="Score it again"
            />
          ))}

        {phase !== "analyzing" && phase !== "frame" && !micBlock && (
          <div className="relative">
            {/* The ring is its own element so it can grow out of the
                button by transform alone (#228): a Tailwind ring is a
                box-shadow, which neither animates nor belongs here. */}
            {/* D51: the take's progress, a 4px ring 8px outside Stop,
                ink sweeping clockwise to the target length. */}
            <svg
              aria-hidden
              className="rec-ring"
              data-on={phase === "recording" || undefined}
              viewBox="0 0 120 120"
            >
              <circle className="rec-ring-track" cx="60" cy="60" r={RING_R} fill="none" strokeWidth="4" />
              {/* Interview's 1:00 to 1:30 (F4), on the track, under the sweep. */}
              {ringWindow !== null && (
                <circle
                  className="rec-ring-window"
                  cx="60"
                  cy="60"
                  r={RING_R}
                  fill="none"
                  strokeWidth="4"
                  strokeDasharray={`${RING_C * (1 - ringWindow)} ${RING_C}`}
                  strokeDashoffset={-RING_C * ringWindow}
                  transform="rotate(-90 60 60)"
                />
              )}
              <circle
                className="rec-ring-fill"
                cx="60"
                cy="60"
                r={RING_R}
                fill="none"
                strokeWidth="4"
                strokeDasharray={RING_C}
                strokeDashoffset={
                  RING_C * (1 - (phase === "recording" ? Math.min(1, seconds / config.maxSeconds) : 0))
                }
                transform="rotate(-90 60 60)"
              />
            </svg>
            <button
              onClick={
                phase === "recording"
                  ? () => void stopRep("you")
                  : locked && game
                    ? () => setPaywall({ reason: game.name })
                    : () => begin()
              }
              aria-label={
                phase === "recording"
                  ? "Stop and score this recording"
                  : "Start recording"
              }
              className={`press font-display elev-3 relative h-24 w-24 rounded-full text-body font-bold transition-colors dur-base ${
                phase === "recording"
                  ? "bg-terracotta-600 text-cream"
                  : "rec-wait bg-terracotta-500 text-on-accent"
              }`}
            >
              {phase === "recording" ? "Stop" : "Record"}
            </button>
            {/* The way out of a take started by mistake (#407): quiet,
                beside Stop so the screen's one tap stays Stop. Not under
                it: Stop rises when the take starts, and that put Start
                over exactly where Record had been, so a second tap on
                Record threw the take away without a word. Beside the
                circle it is clear of Record's footprint at every width. */}
            {phase === "recording" && (
              <span className="arrive absolute inset-y-0 right-full mr-4 flex items-center">
                <button
                  onClick={discardTake}
                  className="press min-h-11 whitespace-nowrap px-3 text-link text-stone-500"
                >
                  Start over
                </button>
              </span>
            )}
          </div>
        )}

        {/*
         * The fine print, under the action, which is where the template
         * puts it (docs/voice.md Part 2). The duration line went with
         * the copy pass: the prompt already names the length and the
         * timer counts it down. What survives is the promise
         * `teardown()` actually keeps, said one line above the tap that
         * makes it matter, which is what primes a permission ask
         * (DECISIONS #135). The camera's own claim lives on the toggle,
         * at the moment somebody turns it on.
         *
         * Shown only while it is news, which is #204's rule for the
         * line it replaces: the first recording, or whenever the camera
         * is in play. A promise repeated daily stops being read.
         */}
        {/* Anticipation cue — what this recording is about to earn (#48),
            one line under the tap that earns it. */}
        {phase === "idle" && anticipate && (
          <p
            className={`-mt-2 max-w-[280px] text-center text-caption font-semibold ${
              anticipate.tone === "earned" ? "text-sage-700" : "text-stone-600"
            }`}
          >
            {anticipate.headline}
          </p>
        )}

        {phase === "idle" && (repCount === 0 || captureMode === "voice_video") && (
          <p className="max-w-[280px] text-center text-caption text-stone-400">
            Mic is only on while you&apos;re recording.{" "}
            <Link href="/privacy" className="font-semibold text-stone-500">
              privacy
            </Link>
          </p>
        )}

        {phase === "frame" && (
          <button
            onClick={() => void startRep()}
            /* The think time's one tap: Record is not on this screen, so
               the start is the terracotta (PRINCIPLES 2). */
            className={PRIMARY}
          >
            I&apos;m ready
          </button>
        )}
      </div>

      {/* His line, said once to a screen reader: every bubble that
          draws it is seen, not read. */}
      <p role="status" className="sr-only">
        {cutIn ?? ""}
      </p>
      {paywall && (
        <Paywall
          reason={paywall.reason}
          headline={paywall.headline}
          onClose={() => setPaywall(null)}
          onUnlocked={() => {
            setPremium(true);
            setPlan(true);
            setPaywall(null);
          }}
        />
      )}
    </main>
  );
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * One idea per eyebrow (PRINCIPLES 4): "Weekly boss · Cold Topic" and
 * "Games · Hot Take" keep the name they end on.
 */
function eyebrowOf(unit: string): string {
  const parts = unit.split(" · ");
  return parts[parts.length - 1];
}

/** "An 8-day streak", "An 11-day", "An 18-day", "An 80-day"; "A" otherwise. */
function article(n: number): string {
  return /^(8|11|18|8\d)$/.test(String(n)) ? "An" : "A";
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
  bests,
  closing,
  earned,
  presence,
  tester,
  resultKey,
  wave,
  clipUrl,
  audioUrl,
  premium,
  coined,
  anonymous,
  repCountBefore,
  streakNow,
  repsNow,
  spineNow,
  walkRows,
  streakUp,
  rewardsReady,
  onUpgrade,
  onRetake,
}: {
  result: AnalyzeResponse;
  config: RepConfig;
  bests: RewardMoment[];
  closing: RewardMoment | null;
  /** A new best Index or three stars: Demos celebrates (D52). */
  earned: boolean;
  presence: PresenceResult | null;
  /** The account's tester row: undefined while read, null for no. */
  tester: TesterRow | null | undefined;
  /** The outbox key this recording travelled under. */
  resultKey: string | null;
  /** The take's loudness envelope, as the scoring wait drew it (the felt step's stage). */
  wave: number[];
  clipUrl: string | null;
  audioUrl: string | null;
  premium: boolean;
  coined: boolean;
  anonymous: boolean;
  repCountBefore: number | null;
  streakNow: number;
  repsNow: RepRow[];
  /** Every recording after this one, for the stars, days and count. */
  spineNow: RepSpine[];
  /** A game's rows before this round and with it; null until read, or when the read failed. */
  walkRows: { before: GameRoundRow[]; now: GameRoundRow[] } | null;
  /** The streak celebration is up over the score step. */
  streakUp: boolean;
  /** Whether it will be is decided (the round's reveal waits on it). */
  rewardsReady: boolean;
  onUpgrade: (ask: PaywallAsk) => void;
  onRetake: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  /* Where this recording came from, if a lesson sent it (#258). Read
     here rather than threaded down through eighteen props. */
  const backTo = safeBack(searchParams.get("back"));
  const [step, setStep] = useState(0);
  const section = STEPS[step].key;
  /** The player's seek, for the transcript's word sheet (#411). */
  const seekRef = useRef<((t: number) => void) | null>(null);
  /*
   * The match check (migration 0020): a tester's one question about the
   * score, at the top of the last step, so it is asked after the score
   * and the numbers it is about have both been on screen, it opens above
   * the shelf on the shortest phone, and the step's own tap no longer
   * walks past it. The numbers are frozen as they land, so a later
   * change on this screen can never rewrite what was being answered.
   */
  const match = showsMatchCheck({
    tester,
    scorable: result.scorable !== false,
    clientId: resultKey,
  });
  const [snapshot] = useState(() =>
    scoreSnapshot(result, presence?.metrics.presenceScore ?? null)
  );
  /*
   * How it felt, asked before the score shows (0022): one tap, or Skip.
   * Only when the tester is already known as the results land, so it is
   * never asked once a number has been on screen. The answer is saved
   * at once and waits on the phone if it cannot land; the answer after
   * the score carries it then (lib/tester.ts withPending).
   */
  const [askingFelt, setAskingFelt] = useState(() => match);
  const last = step === STEPS.length - 1;
  // One answer to "what next": the path's (DECISIONS #220). Home's
  // floor and the road read nextLesson, so the debrief does too. Before
  // the history lands, or once every lesson holds three stars, the
  // rotation stands in.
  const pathNext =
    spineNow.length > 0
      ? nextLesson(starsByLesson(spineNow))?.lesson
      : undefined;
  const next = pathNext ?? nextDrill(config.lessonId);
  const again = next.id === config.lessonId;
  // `game:<gameId>:<questionId>` — a game rep keeps its game identity
  // through the debrief (#194).
  const game = config.lessonId.startsWith("game:")
    ? gameById(config.lessonId.split(":")[1])
    : null;
  /* The round, as the server measured it (lib/round.ts): its own reveal
     on the score step, the ladder on the last (the games plan, items 4
     to 6). Null for anything that is not a game, and for a game whose
     phone sent nothing to measure. */
  const gameRound: GameRound | null =
    game && result.round && result.round.game === game.id ? result.round : null;
  /* The level this round ran at, which Another round keeps: the link's,
     the config's, else the one it was filed at. */
  const level = clampLevel(searchParams.get("level") ?? config.level ?? gameRound?.level ?? 1);
  const roundRows: LadderRow[] | null = walkRows?.now ?? null;
  const roundsNow = game && roundRows ? roundsToday(roundRows, game.id) : 1;
  /*
   * `lesson:<id>:<n>` — and a lesson rep keeps ITS identity for the
   * same reason (#273). A lesson is three practices that build on each
   * other, so the way forward out of practice one is practice two, not
   * a different lesson off the road. `nextInLesson` is null on the last
   * one, and then the way forward is out.
   */
  const practiceOf = parsePracticeId(config.lessonId);
  const lesson = practiceOf ? lessonById(practiceOf.lessonId) : null;
  const nextInLesson =
    lesson && practiceOf && practiceOf.practice < lesson.practices.length
      ? practiceOf.practice + 1
      : null;
  /* Whatever sent this rep gets the loudest button back. Everything
     that sets `back` is a place worth returning to: a lesson that has
     more in it, or the trait walk's closing screen, which is the whole
     reason that walk exists. */
  const returnIsPrimary = !game && !nextInLesson && backTo !== null;

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
  const daysSpoken = trainedDays(spineNow).length;
  const proDue = proMomentDue({
    premium,
    daysSpoken,
    repCount: spineNow.length,
    shown: proMomentShown(),
  });
  /*
   * Every exit lands here. "Go again" from the address already on screen
   * would push the same URL, which Next treats as nothing (same route,
   * same key, no reset), so the tap and the walls' "Not now" were dead.
   * The recording on screen resets in place instead: Go again stands in
   * for the hidden Retake (#220).
   */
  const go = (href: string) => {
    if (sameRepScreen(href, searchParams)) onRetake();
    else router.push(href);
  };
  /*
   * The ask after the taste (the games plan, item 13; research 5): a free
   * account finishing today's free round of a Premium game meets the plum
   * sheet once per game, on its way out of the walk, leading with that
   * round's own number. Never mid-walk and never over the celebration;
   * the decline goes on to wherever was tapped. The plan is read here, so
   * an unread plan is never taken for free.
   */
  const [planFree, setPlanFree] = useState<boolean | null>(null);
  const premiumGame = !!game && needsPremium(game);
  useEffect(() => {
    if (!premiumGame) return;
    let live = true;
    fetchProfile()
      .then((p) => {
        if (live) setPlanFree(p ? !p.premium : null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [premiumGame]);
  const freeTaste =
    !!game && premiumGame && planFree === true && !premium && gameOfTheDay(dayKey(new Date())) === game.id;
  const [tasteSeen, setTasteSeen] = useState(() => (game ? tasteShown(game.id) : true));
  const tasteDue = freeTaste && !tasteSeen;
  const [tasteTo, setTasteTo] = useState<string | null>(null);
  /* Today's free round is spent: the game is not open to this account
     again until tomorrow's, so Another round is a door to the sheet. */
  const replayClosed =
    !!game &&
    freeTaste &&
    roundRows !== null &&
    !gameOpen(game, {
      premium: false,
      dayKey: dayKey(new Date()),
      roundsTodayOfGame: roundsToday(roundRows, game.id),
    });
  const openTaste = (to: string) => {
    if (!game) return;
    markTasteShown(game.id);
    setTasteSeen(true);
    setTasteTo(to);
  };
  const exit = (href: string) => {
    if (gate) setGateTo(href);
    else if (tasteDue && !streakUp) openTaste(href);
    else if (proDue) setProTo(href);
    else go(href);
  };
  /* Another round (F6a, M7): the same game at the same level, a question
     not answered lately (drawFresh over this game's own rows). */
  const anotherRound = () => {
    if (!game) return;
    if (replayClosed) {
      if (tasteDue) openTaste("/games");
      else onUpgrade({ reason: "Premium games", headline: tasteHeadline(game, gameRound), taste: TASTE_LINE });
      return;
    }
    const asked = askedIdsFrom(
      [config.lessonId, ...[...(roundRows ?? [])].reverse().map((r) => r.lesson_id)],
      game
    );
    exit(repHref({ game: game.id, q: drawFresh(game, asked).id, level }));
  };

  /*
   * M07: what was practised names the walk, read from the rep config:
   * the lesson's title, the boss's Cold Topic, the game's name, or
   * Today's practice. Never "Lesson complete" on a recording that was
   * not a lesson (most of them are the floor, a boss or a game).
   */
  const practised = lesson
    ? lesson.title
    : config.kind === "boss"
      ? "Cold Topic"
      : game
        ? roundHeader(game.name, roundsNow)
        : "Today's practice";
  /*
   * recording-7, recording-21: one "Tomorrow", from the same source as
   * the button, so the walk gives one answer to what next (#220). It
   * names the path's next only where the button IS the path's next; a
   * game, a lesson's next practice and a return to the lesson say their
   * own next on the button and nothing here contradicts it.
   */
  const pathPrimary = !game && !(lesson && nextInLesson) && !returnIsPrimary;
  const nextTrait = recordingTrait({ lesson_id: next.id });

  /*
   * Between steps the content fades out as one block (200ms ease-out),
   * then the next step arrives from the right (M07, #223). The button
   * never leaves the shelf. Reduced motion skips the fade out, and the
   * arrival is its one 200ms fade.
   */
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);
  const feltDone = (felt: Felt | null) => {
    if (leaving) return;
    if (felt && resultKey) {
      void saveMatch(feltRow({ clientId: resultKey, repId: result.repId, felt }));
    }
    if (prefersReducedMotion()) {
      setAskingFelt(false);
      return;
    }
    setLeaving(true);
    leaveTimer.current = setTimeout(() => {
      setLeaving(false);
      setAskingFelt(false);
    }, 200);
  };
  /* Which way the last step went, so the next one arrives from where
     the person is heading: the right going on, the left coming back. */
  const [wentBack, setWentBack] = useState(false);
  const move = (by: 1 | -1) => {
    setWentBack(by < 0);
    if (prefersReducedMotion()) {
      setStep((n) => n + by);
      return;
    }
    setLeaving(true);
    leaveTimer.current = setTimeout(() => {
      setLeaving(false);
      setStep((n) => n + by);
    }, 200);
  };
  const advance = () => {
    if (leaving || last) return;
    move(1);
  };
  /* Back a step (#407, Jonathan): to see again what was just passed. */
  const retreat = () => {
    if (leaving || step === 0) return;
    move(-1);
  };

  /*
   * Each step starts at the top: landing halfway down the next screen
   * because the last one was long is how a step gets skipped. And focus
   * moves to the step's own heading (recording-23), so a screen reader
   * hears the new step instead of the same button with a new label.
   */
  const stepHead = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (step > 0) stepHead.current?.focus({ preventScroll: true });
  }, [step]);

  /*
   * The round's own reveal (F3) and its one sound (F5). The card waits
   * while the streak celebration is up, or while it is still unknown
   * whether one is coming (never more than 2.5s), so the reveal is seen
   * and the round never has two sounds. A step back to the score shows
   * it as it ended.
   */
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaitedOut(true), 2500);
    return () => clearTimeout(t);
  }, []);
  const streakSeen = useRef(false);
  useEffect(() => {
    if (streakUp) streakSeen.current = true;
  }, [streakUp]);
  const chimed = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const roundHold = streakUp || (!rewardsReady && !waitedOut);
  const reveal =
    game && gameRound
      ? roundReveal(game, gameRound, gameRound.game === "qa" && roundRows ? heldInARow(roundRows) : 0)
      : null;
  const landed = () => {
    setRevealed(true);
    if (
      reveal &&
      roundChimes({ win: reveal.win, streakCelebrated: streakSeen.current, played: chimed.current })
    ) {
      chimed.current = true;
      playCelebration(false);
      buzz([12, 40, 18]);
    }
  };
  const roundCard =
    gameRound && reveal ? (
      <RoundCard
        round={gameRound}
        reveal={reveal}
        xp={xpLine({
          gameId: gameRound.game,
          xpMultiplier: result.xpMultiplier,
          mods: result.mods,
          level: gameRound.level,
        })}
        words={result.words}
        pauses={result.metrics.pauses}
        audioUrl={audioUrl}
        hold={roundHold}
        played={revealed}
        onLanded={landed}
      />
    ) : null;
  /* Demos's cut-ins, marked wherever the take is drawn (the games plan,
     item 4): the pause map and Hear it back. */
  const cutInMarks = (gameRound && gameRound.game !== "rush" ? gameRound.cutIns : [])
    .filter((f) => f.at !== null)
    .map((f) => ({ t: f.at as number, line: f.line }));
  /* The Length tile reads its own game (M5): Speed rush's clock. */
  const lengthNote =
    game?.id === "rush" ? `of ${gameRound?.cap ?? levelCapS(game, level)}s` : "target 60 to 90s";
  /* Tomorrow names the ladder (M5), and a level opened or a game
     mastered is the closing moment. */
  const ladder: LadderView | null =
    game && walkRows
      ? ladderView(
          game,
          ladderState(walkRows.before, game.id),
          ladderState(walkRows.now, game.id),
          gameRound ? gameRound.counted : null
        )
      : null;
  const closingNow = ladder?.moment ?? closing;

  if (gateTo !== null && gate !== null) {
    return (
      <SaveGate
        moment={gate}
        index={result.ethosIndex}
        streak={streakNow}
        onSkip={() => go(gateTo)}
      />
    );
  }

  if (proTo !== null) {
    return (
      <ProgressMoment
        reps={repsNow}
        days={daysSpoken}
        onSkip={() => go(proTo)}
      />
    );
  }

  return (
    <main className="flex min-h-dvh flex-col px-5 pt-7">
      {/* M07, recording-10: what was practised, as the page's h1 in the
          body size (the score is the hero, not the name), and the coin
          it earned on the right. */}
      {/* Past the score, the row's left is the way back a step, at
          BackLink's geometry (#407); the practice's name stays the h1. */}
      <div className="flex min-h-11 items-center justify-between gap-3">
        {step > 0 && !askingFelt && (
          <button
            onClick={retreat}
            className="screen-bar-back press -ml-3 inline-flex min-h-11 items-center"
          >
            <IconBack size={22} />
            <span>{STEPS[step - 1].label}</span>
          </button>
        )}
        <h1
          className={`font-display min-w-0 text-body font-bold text-ink ${
            step > 0 && !askingFelt ? "sr-only" : ""
          }`}
        >
          {practised}
        </h1>
        {coined && step === 0 && !askingFelt && (
          <span className="flex shrink-0 items-center gap-1.5 text-link text-sage-700">
            <Coin size={18} /> +1
          </span>
        )}
      </div>

      {/* Where you are and how much is left: one continuous ink bar on
          the sand trough, a third per step, sliding on the base spring
          (M07, Duolingo's walk). No segments and no label: the bar is
          the count, and terracotta stays the tap's. */}
      <div
        role="progressbar"
        aria-label="Debrief"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={step + 1}
        aria-valuetext={`${STEPS[step].label}, ${step + 1} of ${STEPS.length}`}
        aria-hidden={askingFelt || undefined}
        className="mt-4 h-1 bg-sand"
      >
        {/* Empty while a tester says how it felt: nothing is seen yet. */}
        <div
          className="h-full bg-ink transition-[width] duration-(--spring-base-duration) ease-(--spring-base) [:root[data-motion=reduce]_&]:transition-none"
          style={{ width: askingFelt ? "0%" : `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* The step, as one block: it fades out whole when the button is
          pressed, and the next one comes in from the right where the
          button pointed (DECISIONS #223). Keyed on the step, so React
          mounts it fresh and the arrival runs once per step; the first
          step runs it too, which is the results landing after the wait. */}
      {/*
       * The score step is short (a number, the stars and his line) and
       * the button is on the shelf, so it fills the space the walk gives
       * it (M07, #287, D52): the score and Demos with his line share the
       * free height out in three even bands (RepResult's `spread`). A
       * top-aligned column left a 340px hole over the shelf and read as
       * stopped rather than finished, and a centred one still left 98px
       * over and under it. The two longer steps flow from the top and
       * scroll under the shelf.
       */}
      <div
        className={`flex flex-1 flex-col ${
          leaving ? "animate-[fade-out_var(--duration-base)_var(--ease-out)_forwards]" : ""
        }`}
      >
        {askingFelt ? (
          /* The take on a stage that takes the free height, the question
             and its three answers resting under it in the thumb's reach
             (review D4: centred, it left 215px and 260px of ground). */
          <div key="felt" className="arrive flex flex-1 flex-col justify-center gap-8 pb-8 pt-5">
            {/* A short phone has no free height to give: the question
                alone, as before (the stage's floor would push the
                answers under the shelf at 320x568). */}
            <FeltStage
              levels={wave}
              seconds={result.metrics.durationS}
              className="max-h-[40dvh] flex-1 [@media(max-height:639px)]:hidden"
            />
            <FeltCheck onAnswer={feltDone} />
          </div>
        ) : (
        <div
          key={step}
          className={`${wentBack ? "arrive-x-back" : "arrive-x"} [:root[data-motion=reduce]_&]:[animation-duration:var(--duration-base)]! ${
            /* The score step fills the walk's free height for everyone
               (D52): a tester's match question is on the last step now,
               so nothing opens under the score to lift it. */
            step === 0 ? "flex flex-1 flex-col" : "pb-8"
          }`}
        >
          {step > 0 && (
            <h2 ref={stepHead} tabIndex={-1} className="sr-only">
              {STEPS[step].label}
            </h2>
          )}

          {/* E57: a tester's last step says what the question is for, so
              it never opens the step unannounced. The match question
              wears the Tester chip on its own row (#402), which says it;
              "Testing Ethos" over it said it twice (#412). A paused
              tester's line has no chip, so it keeps the quiet head
              Settings' door uses. Testers only; everyone else's step is
              unchanged. */}
          {last && !(match && resultKey) && pausedTester(tester) && (
            <p className="eyebrow mt-6">{DOOR_COPY.settingsTesting}</p>
          )}
          {last && match && resultKey && (
            <MatchCheck
              key={resultKey}
              clientId={resultKey}
              repId={result.repId}
              scores={snapshot}
              className="mt-6 mb-7 border-b border-hairline pb-4"
            />
          )}
          {/* A tester on an older consent: where the question would be,
              that testing is paused and the way back (review D1). */}
          {last && pausedTester(tester) && (
            <TesterPaused back="/" className="mt-2 mb-7 border-b border-hairline pb-4" />
          )}

          {/* The score step's column (E55): Demos takes its free height. */}
          <div className={step === 0 ? "flex flex-1 flex-col" : undefined}>
            <RepResult
              result={result}
              topic={config.topic}
              section={section}
              baseline={repCountBefore === 0}
              live
              celebrate={earned}
              spread={step === 0}
              round={roundCard}
              /* The card takes the height Demos stands in: the stars give
                 8px first, so he keeps 120 or more at 390x844 (F3). */
              starSize={roundCard ? 32 : 40}
              leadMs={roundCard ? ROUND_REVEAL_MS : 0}
              hold={roundCard ? roundHold : false}
              lengthNote={lengthNote}
              pauseMarks={cutInMarks.map((c) => ({
                t: c.t,
                label: c.line ? `“${c.line}” ${fmt(Math.floor(c.t))}` : `Demos cut in at ${fmt(Math.floor(c.t))}`,
              }))}
              /* recording-13, recording-18: the evidence you can play sits
                 above the words it produced, inside the words section. */
              player={
                audioUrl ? (
                  <AudioScrubber
                    src={audioUrl}
                    durationS={result.metrics.durationS}
                    fillers={result.metrics.fillers}
                    pauses={result.metrics.pauses}
                    marks={cutInMarks.map((c) => ({ t: c.t, label: c.line ?? "Demos" }))}
                    seekRef={seekRef}
                  />
                ) : undefined
              }
              hasPlayer={!!audioUrl}
              /* A word's "Said at" plays the take from there (#411). */
              onPlay={(t) => seekRef.current?.(t)}
            />
          </div>

          {/*
           * Presence — a SECOND score, beside the Index at the same size.
           * The Index is audio-only and stays that way, so the trendline
           * and the leagues remain comparable whichever mode was picked.
           */}
          {section === "score" && presence && (
            <div className="mt-7 border-t border-hairline pt-4">
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
            <section className="mt-7 border-t border-hairline pt-4">
              <h2 className="font-display text-lead font-bold leading-tight">
                Measured, not judged.
              </h2>
              <p className="mt-2 text-body text-stone-500">
                These are counted from the recording. The cited moments, the word
                upgrade and Demos&apos;s take are back tomorrow.
              </p>
              <p className="mt-2 text-caption text-stone-500">
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
                  className="press mt-2 min-h-11 text-left text-link text-plum-700"
                >
                  <PremiumDoor>Premium gets the full read, every time</PremiumDoor>
                </button>
              )}
            </section>
          )}

          {/* recording-10: a ground section, so a sentence-case head. */}
          {section === "words" && bests.length > 0 && (
            <section className="mt-7">
              <h2 className="section-head">Records broken</h2>
              <div className="mt-3 space-y-3">
                {bests.map((b, i) => (
                  <Moment key={i} moment={b} />
                ))}
              </div>
            </section>
          )}

          {/* The ending carries disproportionate weight when someone
              decides whether to come back (streak-end rule), so it lands
              on the last screen rather than halfway down the first. At a
              section's distance (principle 7): a level opened or a game
              mastered is the walk's peak, never a third card under
              "Records broken" or a card pressed onto the words. */}
          {last && closingNow && (
            <div className="mt-7">
              <Moment moment={closingNow} emphasis />
            </div>
          )}

          {last && (
            <Tomorrow
              next={pathPrimary ? { title: next.title, trait: nextTrait } : null}
              ladder={ladder}
              streak={streakNow}
            />
          )}
        </div>
        )}
      </div>

      {/*
       * One way forward per screen, on the shelf every step shares, so
       * the tap never moves while the steps turn (M07). There is
       * deliberately no exit until the debrief is finished — the numbers
       * are the product, and a "Done" button beside the first screen
       * means most of them are never seen.
       */}
      <FooterShelf>
        {askingFelt ? (
          /* Skippable: the score is one quiet tap away, never a terracotta
             one (the question is the step, and it is grey). */
          <div className="flex min-h-12 items-center justify-center">
            <button
              type="button"
              onClick={() => feltDone(null)}
              className="text-link press inline-flex min-h-11 items-center px-4"
            >
              {FELT_COPY.skip}
            </button>
          </div>
        ) : last ? (
          <>
            {/* Buttons, not Links: the exits go through exit(), which
                may route via the save-progress wall first (#134). A game
                ends as a game (#194): another round or back to Practice,
                never a push onto the path's next lesson. */}
            {game ? (
              <button data-step-action onClick={anotherRound} className={PRIMARY}>
                Another round: {game.name}
              </button>
            ) : lesson && nextInLesson ? (
              <button
                data-step-action
                onClick={() =>
                  exit(
                    repHref({
                      lesson: lesson.id,
                      q: String(nextInLesson),
                      back: backTo ?? `/lessons/${lesson.id}`,
                    })
                  )
                }
                className={PRIMARY}
              >
                Practice {nextInLesson} of {lesson.practices.length}
              </button>
            ) : returnIsPrimary ? (
              <button data-step-action onClick={() => exit(backTo)} className={PRIMARY}>
                Back to the lesson
              </button>
            ) : (
              <button
                data-step-action
                onClick={() => exit(repHref({ lesson: next.id }))}
                className={PRIMARY}
              >
                {again ? "Go again" : "Next lesson"}: {next.title}
              </button>
            )}
            {/* recording-22: the quiet pair under the one tap. Retake is
                a text button beside the exit, never a second primary,
                and the exit centres alone when Retake hides (#220). */}
            <div className="mt-1 flex items-center justify-center gap-6">
              {!again && (
                <button
                  onClick={onRetake}
                  className="press min-h-11 rounded-tap px-3 text-link text-stone-500"
                >
                  Retake this one
                </button>
              )}
              <button
                onClick={() =>
                  exit(returnIsPrimary ? "/" : (backTo ?? (game ? "/games" : "/")))
                }
                className="press min-h-11 rounded-tap px-3 text-link text-stone-500"
              >
                {returnIsPrimary
                  ? "Done for today"
                  : backTo
                    ? "Back to the lesson"
                    : game
                      ? "Back to Practice"
                      : "Done for today"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* M23: the verb alone, no arrow. Present from the first frame
                of the step, before anything on it has landed. */}
            <button data-step-action onClick={advance} className={PRIMARY}>
              {STEPS[step + 1].label}
            </button>
            {/* F6a: a game's round is on its first step, so the next one
                is a quiet tap under the numbers (recording-22's grammar),
                never a second primary. Games only: a daily recording still
                walks to its end. */}
            {game && step === 0 && (
              <div className="mt-1 flex justify-center">
                <button
                  onClick={anotherRound}
                  className="press min-h-11 rounded-tap px-3 text-link text-stone-500"
                >
                  Another round
                </button>
              </div>
            )}
          </>
        )}
      </FooterShelf>
      {tasteTo !== null && game && (
        <Paywall
          reason="Game of the day"
          headline={tasteHeadline(game, gameRound)}
          taste={TASTE_LINE}
          returnTo={result.repId ? `/rep/${result.repId}` : "/you"}
          onClose={() => {
            const to = tasteTo;
            setTasteTo(null);
            if (to) go(to);
          }}
          onUnlocked={() => {
            const to = tasteTo;
            setTasteTo(null);
            if (to) go(to);
          }}
        />
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
      <div className="eyebrow">Before you go</div>

      <div className="flex flex-1 flex-col justify-center">
        {index !== null && (
          <div className="flex items-baseline gap-2">
            <span className="font-display text-num-hero tabular-nums">
              {index}
            </span>
            <span className="text-link font-normal text-stone-500">
              /1000{moment === "rep1" && " · your baseline"}
            </span>
          </div>
        )}
        <h1 className="font-display mt-4 text-title">
          {moment === "rep1"
            ? "Day 1 is on the board."
            : `${days} days on the board.`}
        </h1>
        <p className="mt-3 max-w-[92%] text-body leading-relaxed text-stone-500">
          {moment === "rep1"
            ? "This recording, its score and the streak it starts live in this browser and nowhere else. "
            : `${article(days)} ${days}-day streak and every number behind it live in this browser and nowhere else. `}
          An account attaches them to you, so a cleared cache or a new phone
          can&apos;t take them. Nothing moves, so nothing can go missing.
        </p>
      </div>

      <Link href="/signup" className={PRIMARY}>
        Save my progress
      </Link>
      <button
        onClick={onSkip}
        className="press mt-3 block min-h-11 w-full py-2 text-center text-link text-stone-500"
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
      <div className="eyebrow">Since day one</div>

      <div className="flex flex-1 flex-col justify-center">
        {/* Leads with the number they said they'd watch (#232). */}
        <ComparisonCard
          reps={reps}
          lead={buildPortfolio(readOnboarding().answers).focus?.metric}
        />
        <p className="mt-4 text-body text-stone-500">
          Free shows the last 7 days and reads one recording a day. Premium
          opens all of it.
        </p>
      </div>

      <button onClick={() => setSheet(true)} className={PRIMARY}>
        Keep every number
      </button>
      <button
        onClick={onSkip}
        className="press mt-3 block min-h-11 w-full py-2 text-center text-link text-stone-500"
      >
        Not now
      </button>

      {sheet && (
        <Paywall
          reason={`Day ${days} of speaking`}
          headline={`${days} days of numbers. Keep all of them.`}
          // This moment is gone after a reload: come back to You, which
          // reopens the sheet.
          returnTo="/you"
          onClose={() => setSheet(false)}
          onUnlocked={onSkip}
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
  { h: 8, name: "Morning" },
  { h: 12, name: "Lunch" },
  { h: 18, name: "Evening" },
];

/**
 * recording-7, recording-21: the one "Tomorrow" on the last step. What
 * comes next, from the same source as the button (the path's next, its
 * title and its trait), and the when-plan under the same head, while
 * no reminder hour is set. One formatter for the chips and the line
 * after a pick (A2's useHourLabel: "6 pm" on the device, the padded
 * 24 hour form until mount, so both renders agree), so the two can
 * never say the hour two ways. Renders nothing when it has neither.
 */
function Tomorrow({
  next,
  ladder = null,
  streak,
}: {
  /** The path's next, when the button is the path's next; else null. */
  next: { title: string; trait: TraitId | null } | null;
  /** A game round: the ladder in the path's place (M5). */
  ladder?: LadderView | null;
  streak: number;
}) {
  const hourLabel = useHourLabel();
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

  // Already planned on an earlier day: the settings card owns it now.
  const asking = hour === null || picked;
  if (!next && !ladder && !asking) return null;

  return (
    <section className="mt-7">
      <h2 className="section-head">Tomorrow</h2>
      {ladder && (
        <div className="mt-3">
          <p className="font-display text-detail">{ladder.head}</p>
          <p className="mt-1 text-body text-stone-600 text-pretty">{ladder.line}</p>
          {ladder.rule && (
            <p className="mt-1 text-caption text-stone-500 text-pretty">{ladder.rule}</p>
          )}
        </div>
      )}
      {next && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="font-display text-detail">{next.title}</span>
          {next.trait && <TraitChip trait={next.trait} />}
        </div>
      )}
      {asking &&
        (picked && hour !== null ? (
          <p role="status" className="mt-3 text-body text-stone-600">
            {hourLabel(hour)}.{" "}
            {granted === null
              ? null
              : granted
                ? "Demos will nudge you once, never more."
                : "Noted. Notifications are off in this browser; Settings names the fix."}
          </p>
        ) : (
          <>
            {/* One line (feedback round, 25 Sep): the line asks, the
                chips answer. */}
            <p className={`${next || ladder ? "mt-4" : "mt-3"} text-body text-stone-500`}>
              Pick a time and Demos reminds you once a day.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {PLAN_HOURS.map((p) => (
                <button
                  key={p.h}
                  onClick={() => void pick(p.h)}
                  className="press flex min-h-14 flex-col items-center justify-center rounded-control border border-edge bg-surface px-2 py-2"
                >
                  <span className="font-display text-row">{p.name}</span>
                  <span className="text-caption text-stone-500">
                    {hourLabel(p.h)}
                  </span>
                </button>
              ))}
            </div>
          </>
        ))}
    </section>
  );
}
