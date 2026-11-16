/**
 * The room (#475, docs/plan-next.md section 12): the first minute of
 * Ethos is a scene, not a pitch. An interviewer across a desk on a high
 * floor, "Sell me this pen.", you speak, he pushes back, you answer
 * again, he turns you down, and Demos steps in.
 *
 * Timothy's calls, 12 and 16 Nov: no AI here (no Whisper, no Claude, no
 * server call), no numbers, his lines scripted and the same for
 * everyone, text only (no voice), and the rejection whatever was said.
 * That last one breaks CLAUDE.md's "we never manufacture insecurity" on
 * purpose, and the log says so.
 *
 * A script is data, so a second scene (the pitch, small talk) is a
 * second object of this shape and nothing else: the flow
 * (components/room/Room.tsx) plays whatever it is handed, the art
 * (components/room/RoomArt.tsx) draws the room, and neither holds a
 * word of what is said. Every line here is Timothy's, word for word.
 */

/** Who says a line. You never have a line: you have a turn. */
export type RoomSpeaker = "interviewer" | "demos";

/** The interviewer's pose (RoomArtProps["mood"]). */
export type RoomMood = "idle" | "listening" | "unimpressed" | "verdict";

/** What the mic level decides, and nothing more (lib/room-verdict.ts). */
export type RoomVerdict = "alright" | "horrible";

/**
 * How a turn ends, in milliseconds (lib/room-verdict.ts, `createVoiceGate`):
 * `silenceMs` of quiet once speech has started, `capMs` in all, or
 * `waitMs` with no voice at all (#475: twenty-five seconds of a silent
 * room is a wait, not a scene), or a tap on Done.
 */
export type TurnRule = { silenceMs: number; capMs: number; waitMs: number };

export const TURN: TurnRule = { silenceMs: 2500, capMs: 25_000, waitMs: 10_000 };

export type RoomBeat =
  | {
      kind: "line";
      /** Stable, so a gate and a log can name the line. */
      id: string;
      who: "interviewer";
      text: string;
      /** His pose while he says it and until the next beat. */
      mood: RoomMood;
    }
  | {
      kind: "turn";
      id: string;
      /** His pose while you speak. */
      mood: RoomMood;
      rule?: Partial<TurnRule>;
    };

export type RoomScript = {
  id: string;
  /** What the room is, for a screen reader (the scene has no visible title). */
  name: string;
  /** The interviewer's lines and your turns, in order. */
  beats: readonly RoomBeat[];
  /** Demos, once the scene is over: one of these, from the mic level only. */
  verdict: Record<RoomVerdict, string>;
  /** Demos again, after the verdict: the turn into the introduction. */
  after: readonly string[];
  /** Demos, when there was no mic to hear you: said plainly, then the questions. */
  noMic: string;
};

/**
 * The interview. "Sell me this pen" on a sales floor forty storeys up
 * (Timothy, 16 Nov: "The scene is like high rise. It's like an
 * interview. Like, sell me this pen.").
 */
export const INTERVIEW: RoomScript = {
  id: "interview",
  name: "An interview",
  beats: [
    { kind: "line", id: "open", who: "interviewer", text: "Sell me this pen.", mood: "idle" },
    { kind: "turn", id: "pitch", mood: "listening" },
    { kind: "line", id: "push", who: "interviewer", text: "What are you even saying?", mood: "unimpressed" },
    { kind: "line", id: "why", who: "interviewer", text: "Why would I need this pen?", mood: "unimpressed" },
    { kind: "turn", id: "answer", mood: "listening" },
    {
      kind: "line",
      id: "verdict",
      who: "interviewer",
      text: "I'm sorry, but you're not who we're looking for.",
      mood: "verdict",
    },
  ],
  verdict: { alright: "That was alright.", horrible: "That was horrible." },
  after: ["What if that was real?"],
  /* Claude's line, not Timothy's: said plainly, one sentence, no
     fragment (COPY-RULES), true whether the phone said no or has no mic. */
  noMic: "I couldn't hear you, so let's get you set up.",
};

/** Every scene there is. Only the interview ships (#475). */
export const ROOM_SCRIPTS = { interview: INTERVIEW } as const;

/** The flow's own words, around the script. */
export const ROOM_COPY = {
  /** The one tap on the door: holding it is the gesture the asks ride on. */
  hold: "Hold to step in",
  /** The quiet way past the scene, on a train or in a library. */
  notNow: "Not now",
  /** The way out of a scene already running. */
  skip: "Skip",
  /** A new phone that belongs to an account. */
  signIn: "Sign in",
  /** The listening cue while the mic is open. */
  yourTurn: "Your turn",
  /** Ends your turn early. */
  done: "Done",
  /** From Demos's last line into the questions. */
  next: "Next",
} as const;

/** The scene's turns, in order, for a reader that needs to count them. */
export function turnsOf(script: RoomScript): Extract<RoomBeat, { kind: "turn" }>[] {
  return script.beats.filter((b): b is Extract<RoomBeat, { kind: "turn" }> => b.kind === "turn");
}

/** A turn's rule, the script's own values over the defaults. */
export function ruleOf(beat: Extract<RoomBeat, { kind: "turn" }>): TurnRule {
  return { ...TURN, ...beat.rule };
}
