"use client";

import { useRef } from "react";
import { DemosArt } from "@/components/DemosArt";
import { ownedFrom, POSE_STAGE, YOU_POSE, youPose } from "@/lib/shop";

/**
 * The Demos on You's identity stage: the pose the Shop sold, or his hello.
 *
 * Since #393 Today shows the lesson's glass object, so You's stage is the
 * one place Demos stands every day, and the one place a pose bought with
 * coins can show. A pose that showed nowhere was a purchase that did
 * nothing (money buys cosmetics only, and a cosmetic you never see is a
 * broken one).
 *
 * What it draws, in order of what is known:
 *  - `worn` undefined: nothing has been read yet, so the stage keeps its
 *    light and nobody stands on it (the server's paint);
 *  - `ledger` null: the device's copy is trusted for the first paint, as
 *    Today trusted it (#175), so a bought pose never flashes hello first;
 *  - `ledger` read: the ledger is the proof (`ownedFrom`, a spend at the
 *    catalog price), and anything it does not prove is hello.
 *
 * `away` is a moment with its own Demos (the checkout return, the price
 * drop): he steps off and the stage keeps its light, one Demos per
 * screen. `back` springs him in when the moment goes. A pose that changes
 * once he is drawn (the account wore another on a second phone) arrives
 * the same way rather than swapping under the eye.
 *
 * At 132 the idle clip plays for any pose that has one; DemosArt decides
 * that from `lib/idle-clips.ts`, so a pose without one stays a still.
 */
export function YouDemos({
  worn,
  ledger,
  away = false,
  back = false,
}: {
  /** The worn pose's shop id, null for none; undefined until read. */
  worn: string | null | undefined;
  /** The whole coin ledger, or null while it is unread or failed. */
  ledger: { kind: string; reason: string; amount: number }[] | null;
  away?: boolean;
  back?: boolean;
}) {
  const pose =
    worn === undefined
      ? null
      : ledger
        ? youPose(worn, ownedFrom(ledger))
        : (POSE_STAGE[worn ?? ""] ?? YOU_POSE);
  const first = useRef<string | null>(null);
  if (pose !== null && first.current === null) first.current = pose;
  const changed = pose !== null && first.current !== pose;

  if (away || pose === null) {
    return (
      <div className="tone-sky relative h-full w-full">
        <div className="demos-halo" />
      </div>
    );
  }
  return (
    <DemosArt
      key={pose}
      pose={pose}
      size={132}
      pop={back || changed}
      grounded
      halo={{ tone: "sky", kind: "stage" }}
    />
  );
}
