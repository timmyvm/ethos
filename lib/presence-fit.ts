/**
 * Presence calibration fitter (DECISIONS #187).
 *
 * Every constant in lib/presence.ts is a v1 guess that has never met a
 * real body (BUILT.md). The fix is four labeled takes on a real camera:
 *
 *   composed      speak naturally, gesture normally, eyes at the lens
 *   slouch        deliberately slumped, leaning, restless
 *   look-away     eyes on notes or a second screen, off the lens
 *   hands-hidden  hands in pockets or under the desk, still
 *
 * This module turns those takes' MEASURED aggregates into a proposed
 * constant set, humbly: the composed take defines "good" with a margin,
 * the adversarial takes bound "bad", and where a take doesn't inform a
 * constant the current GOOD:BAD ratio is preserved rather than invented.
 * Pure, so the proposal is testable and re-runnable.
 */

import type { DeliveryMetrics } from "./presence";
import { PRESENCE_CONSTANTS } from "./presence";

export type TakeLabel = "composed" | "slouch" | "look-away" | "hands-hidden";

export interface LabeledTake {
  label: TakeLabel;
  metrics: DeliveryMetrics;
}

export interface ProposedConstants {
  gestureZone: [number, number];
  postureGood: number;
  postureBad: number;
  headGood: number;
  headBad: number;
  eyeGood: number;
  eyeBad: number;
  slumpGood: number;
  slumpBad: number;
  /** Honest caveats: which parts the takes couldn't separate. */
  warnings: string[];
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round1 = (n: number) => Math.round(n * 10) / 10;

function byLabel(
  takes: LabeledTake[]
): Partial<Record<TakeLabel, DeliveryMetrics>> {
  const out: Partial<Record<TakeLabel, DeliveryMetrics>> = {};
  for (const t of takes) out[t.label] = t.metrics;
  return out;
}

/**
 * Null until the composed take exists — everything anchors to it.
 * The other three sharpen what they can and warn where they can't.
 */
export function proposeConstants(
  takes: LabeledTake[]
): ProposedConstants | null {
  const m = byLabel(takes);
  const composed = m.composed;
  if (!composed) return null;

  const cur = PRESENCE_CONSTANTS;
  const warnings: string[] = [];

  /*
   * The whole model assumes a STATIC camera. A composed take whose
   * torso "wandered" past the entire scoring band is almost always the
   * phone moving in a hand, and every number downstream of that is
   * polluted — so this warning leads, and the proposal below it should
   * not be adopted until the takes are redone propped.
   */
  if (composed.postureDrift > cur.postureBad) {
    warnings.push(
      "The composed take's torso wander is beyond the entire scoring band. That much motion is usually the CAMERA moving. Prop the phone, re-record all four takes, and don't adopt these numbers."
    );
  }

  // Posture: your natural sway must score cleanly, with headroom.
  const postureGood = Math.max(0.01, round3(composed.postureDrift * 1.25));
  // The slouch take bounds "bad" when it actually drifted more; a held
  // motionless slouch says nothing about drift, so keep the ratio.
  const slouchDrift = m.slouch?.postureDrift;
  let postureBad: number;
  if (slouchDrift !== undefined && slouchDrift > postureGood * 2) {
    postureBad = round3(slouchDrift * 0.9);
  } else {
    postureBad = round3(postureGood * (cur.postureBad / cur.postureGood));
    if (slouchDrift !== undefined) {
      warnings.push(
        "The slouch take barely drifted, so it couldn't bound postureBad; the current good:bad ratio was kept."
      );
    }
  }

  // Head: same shape as posture.
  const headGood = Math.max(0.005, round3(composed.headStability * 1.3));
  const headBad = round3(headGood * (cur.headBad / cur.headGood));

  // Slump (#188): composed says where YOUR head sits when you're
  // upright, the slouch take says where it sinks to. This is the pair
  // these two takes exist to separate.
  let slumpGood: number = cur.slumpGood;
  let slumpBad: number = cur.slumpBad;
  const cLift = composed.headLift;
  const sLift = m.slouch?.headLift;
  if (cLift === null || cLift === undefined) {
    warnings.push(
      "The composed take never tracked a nose, so the slump band was left as-is."
    );
  } else {
    slumpGood = round3(cLift * 0.92);
    if (sLift !== null && sLift !== undefined && sLift < slumpGood - 0.05) {
      slumpBad = round3(Math.min(sLift * 1.05, slumpGood - 0.05));
    } else {
      slumpBad = round3(slumpGood * (cur.slumpBad / cur.slumpGood));
      if (sLift !== null && sLift !== undefined) {
        warnings.push(
          "The slouch take's head sat about as high as the composed one's; the slump band kept the current ratio. Slouch harder on the redo, or the dimension can't bite."
        );
      }
    }
  }

  // Eye line: composed sets the bar, look-away sets the floor.
  const eyeGood = Math.min(90, Math.round(composed.eyeLinePct - 5));
  const lookAway = m["look-away"]?.eyeLinePct;
  const eyeBad =
    lookAway !== undefined
      ? Math.min(eyeGood - 10, Math.round(lookAway + 10))
      : cur.eyeBad;
  if (composed.eyeLinePct < 60) {
    warnings.push(
      "The composed take's eye line read under 60%. Either the camera sat well below the face or PITCH_FLOOR needs a look before trusting eyeGood."
    );
  }
  if (lookAway !== undefined && lookAway >= composed.eyeLinePct) {
    warnings.push(
      "The look-away take scored MORE eye contact than the composed one; the yaw/pitch geometry isn't separating them. Re-record before adopting the eye constants."
    );
  }

  // Gestures: composed brackets the zone; hands-hidden must fall under it.
  const g = composed.gestureRate;
  let gestureZone: [number, number];
  if (g < 2) {
    gestureZone = cur.gestureZone;
    warnings.push(
      "The composed take had almost no gestures, so the gesture zone was left as-is. Speak with your hands on the calibration take."
    );
  } else {
    gestureZone = [
      Math.max(2, round1(g * 0.45)),
      round1(Math.max(g * 1.7, g + 8)),
    ];
  }
  const hidden = m["hands-hidden"]?.gestureRate;
  if (hidden !== undefined && hidden >= gestureZone[0]) {
    warnings.push(
      "The hands-hidden take still measured gestures inside the zone; GESTURE_SPEED is likely reading noise as movement."
    );
  }

  return {
    gestureZone,
    postureGood,
    postureBad,
    headGood,
    headBad,
    eyeGood,
    eyeBad,
    slumpGood,
    slumpBad,
    warnings,
  };
}
