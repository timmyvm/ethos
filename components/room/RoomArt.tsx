"use client";

import { memo, type CSSProperties, type ReactNode } from "react";
import { FarCity, MidCity, NearCity } from "./art/City";
import { DEPTH, PEN_ROLL } from "./art/geometry";
import { BUBBLE_AT, Front, Interviewer, type Mood } from "./art/Interviewer";
import { Desk, Office, Pen, Sky } from "./art/Scene";
import s from "./art/room.module.css";

/**
 * The room (#475): a high-rise office at dusk, first person, an
 * interviewer across the desk. The flow owns everything that happens in
 * it; this draws it, and nothing else: no text, no controls.
 *
 * It fills its parent (absolute, inset 0) and crops rather than squashes.
 * It is a window into a real room: each layer moves against the tilt by
 * its own depth, the far city least and the pen most, so the phone seems
 * to look past the glass. Transform only, so it runs on the compositor.
 */
export type RoomArtProps = {
  /** Each -1 to 1, already smoothed by the flow every frame. */
  tilt: { x: number; y: number };
  /** Who is speaking; his mouth moves while it is "interviewer". */
  who: "interviewer" | "you" | null;
  /** His pose. */
  mood: "idle" | "listening" | "unimpressed" | "verdict";
  /** Holds every layer still and stops every loop. */
  reduceMotion: boolean;
  /**
   * What he says, drawn by the flow. RoomArt only places it: inside his
   * own layer, so it moves with him, its bottom-left corner just over his
   * head (draw its tail there, pointing down at him). The wrapper is
   * `[data-room-bubble]`, and it gives the flow two lengths:
   * `--room-bubble-max`, the widest a bubble should be, and
   * `--room-bubble-room`, how far it is from the anchor to the screen's
   * right gutter, so a wider bubble can slide back left over his head
   * with its tail still on the anchor. Both are at rest (no tilt), and
   * both follow the anchor as it glides between poses.
   */
  bubble?: ReactNode;
};

/* The still layers are drawn once per page, never per frame. */
const SkyLayer = memo(Sky);
const FarLayer = memo(FarCity);
const MidLayer = memo(MidCity);
const NearLayer = memo(NearCity);
const OfficeLayer = memo(Office);
const DeskLayer = memo(Desk);
const PenLayer = memo(Pen);
const InterviewerLayer = memo(Interviewer);
const FrontLayer = memo(Front);

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < -1 ? -1 : n > 1 ? 1 : n;
}

export default function RoomArt({ tilt, who, mood, reduceMotion, bubble }: RoomArtProps) {
  const x = reduceMotion ? 0 : clamp(tilt.x);
  const y = reduceMotion ? 0 : clamp(tilt.y);

  /* Against the tilt, by depth: looking past the glass. */
  const shift = (depth: number) => ({
    transform: `translate3d(${(-x * depth).toFixed(2)}px, ${(-y * depth).toFixed(2)}px, 0)`,
  });
  const roll = {
    transform: `translate3d(${(-x * DEPTH.pen).toFixed(2)}px, ${(-y * DEPTH.pen).toFixed(2)}px, 0) rotate(${(-x * PEN_ROLL).toFixed(3)}deg)`,
  };

  const m: Mood = mood;

  return (
    <div className={reduceMotion ? `${s.root} ${s.still}` : s.root} aria-hidden={bubble ? undefined : true} data-room-art="">
      <div className={s.stage}>
        <div className={s.layer} style={shift(DEPTH.sky)}>
          <SkyLayer />
        </div>
        <div className={s.layer} style={shift(DEPTH.far)}>
          <FarLayer />
        </div>
        <div className={s.layer} style={shift(DEPTH.mid)}>
          <MidLayer />
        </div>
        <div className={s.layer} style={shift(DEPTH.near)}>
          <NearLayer />
        </div>
        <div className={s.layer} style={shift(DEPTH.office)}>
          <OfficeLayer />
        </div>
        <div className={s.layer} style={shift(DEPTH.interviewer)}>
          <InterviewerLayer mood={m} talking={who === "interviewer" && !reduceMotion} />
          {bubble ? (
            <div
              className={s.bubble}
              data-room-bubble=""
              data-tail="bottom-left"
              style={{ "--room-ax": BUBBLE_AT[m].x, "--room-ay": BUBBLE_AT[m].y } as CSSProperties}
            >
              {bubble}
            </div>
          ) : null}
        </div>
        <div className={s.layer} style={shift(DEPTH.desk)}>
          <DeskLayer />
        </div>
        <div className={s.layer} style={shift(DEPTH.front)}>
          <FrontLayer mood={m} />
        </div>
        <div className={`${s.layer} ${s.roll}`} style={roll}>
          <PenLayer />
        </div>
      </div>
      <div className={s.vignette} />
    </div>
  );
}
