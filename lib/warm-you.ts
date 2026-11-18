/**
 * You's reads, made while Today is open (#508, the speed audit's fix 12).
 *
 * You's first open of a visit used to wait on reads Today never made:
 * every XP event (its Level), the lexicon and the auth server's word on
 * whether the session is a guest's, each behind its own preflight (649 ms
 * from Today on mobile data, the slowest tap on the bar). Once Today's
 * own numbers are drawn and the phone is idle, Today asks for them into
 * what the visit holds (lib/held.ts), so the tap to You draws its first
 * frame from them and reads again behind it, as every other tab does.
 *
 * Only what is not already held is asked for, and `once` shares a read
 * already out, so this costs nothing on a return to Today; a recording
 * stored drops them (forgetRecordings), and the next Today asks again.
 *
 * Say it better's card (#507) is You's first card, so its read is one of
 * them (the final pass of 18 Nov: You's first open from Today drew its
 * skeleton, check-held's "You, visit 1"). Its store is fetched only here,
 * at idle, so none of it joins Today's own first load; You itself still
 * reads it on mount, so a direct open, or You opened before Today drew,
 * never waits for this.
 */
import { localSessionState } from "./auth";
import { fetchLexicon, fetchXp, heldLexicon, heldXp } from "./client-data";
import { GUEST_KEY, held, heldMark, hold } from "./held";

export function warmYou(): void {
  if (heldXp() === null) void fetchXp().catch(() => {});
  if (heldLexicon() === null) void fetchLexicon().catch(() => {});
  void import("./say-store")
    .then((say) => (say.heldSay() === null ? say.fetchSay() : undefined))
    .catch(() => {});
  if (held<boolean>(GUEST_KEY) === undefined) {
    const mark = heldMark();
    void localSessionState()
      .then((s) => {
        if (s.signedIn) hold(GUEST_KEY, s.anonymous, mark);
      })
      .catch(() => {});
  }
}
