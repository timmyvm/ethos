"use client";

import { useEffect, useRef } from "react";

/**
 * A request a person can walk away from. The paywall's Start and the
 * manage sheet's portal rows ask the server for a Stripe URL and then
 * send the browser there; "Not yet", Escape, the scrim or "I have a
 * code" while that request is out has to mean the browser stays put
 * when the answer lands. Each request takes an id when it starts, and
 * its answer is acted on only while that id is still the live one.
 */
export interface Attempts {
  /** A new request: the id its answer must still hold to be acted on. */
  start(): number;
  /** True while nothing newer started and nobody walked away. */
  live(id: number): boolean;
  /** The person left: whatever is out answers into nothing. */
  abandon(): void;
}

export function createAttempts(): Attempts {
  let current = 0;
  return {
    start: () => ++current,
    live: (id) => id === current,
    abandon: () => {
      current += 1;
    },
  };
}

/** A component's attempts, abandoned when it unmounts. */
export function useAttempts(): Attempts {
  const ref = useRef<Attempts | null>(null);
  if (ref.current === null) ref.current = createAttempts();
  const attempts = ref.current;
  useEffect(() => () => attempts.abandon(), [attempts]);
  return attempts;
}
