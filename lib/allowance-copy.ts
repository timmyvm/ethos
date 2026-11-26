import { DAILY_GRANT } from "./metering";

/*
 * The free plan's allowance in words (#514, Timothy 19 Nov: "a free
 * account gets a score 3 times a day max", then "Nah give them a few
 * recordings yo"). A free account gets DAILY_GRANT scored recordings a
 * day, fresh each day (lib/metering.ts); every line that states the
 * allowance is built from that number here, so the copy can never say a
 * rate the meter does not keep. "Scored" is the Ethos score: a fourth
 * take still has every measured number, and no Ethos score.
 */

/** The allowance, as the paywall's first benefit carries it: "(free: 3 a day)". */
export const FREE_ALLOWANCE = `(free: ${DAILY_GRANT} a day)`;

/** What Premium gives over it, the benefit itself. */
export const SCORED_BENEFIT = "Every recording scored";

/** What a capped take's door names as the sheet's opener: "3 scored recordings a day free". */
export const CAPPED_REASON = `${DAILY_GRANT} scored recordings a day free`;

/**
 * Under a capped take's filler hero, before the Premium door has earned
 * its place (PRO_MOMENT_DAYS): when the score comes back, grey.
 */
export const CAPPED_LINE = "Ethos score back tomorrow";

/**
 * Under Record, grey, once this phone knows today's scored recordings are
 * used (lib/scored-left.ts, the reel's honest wins, build 5): the limit
 * and when it resets, before the take rather than after it. No door.
 */
export const SCORED_USED = `You've used today's ${DAILY_GRANT} scored recordings. ${CAPPED_LINE}.`;

/** The same, as the plum door from day 3 on: when, and the way to have it now. */
export const CAPPED_DOOR = "Ethos score back tomorrow, or go Premium";

/**
 * The capped take's own section in Every number: what is back tomorrow,
 * and that the take still counted.
 */
export const CAPPED_SHEET = "Your Ethos score and Demos's read are back tomorrow. This one still counted toward your streak.";

/**
 * Since day one's line over Keep every number. "a day" is held together
 * (a no-break space), so a 390 phone never ends a line on "a".
 */
export const PRO_MOMENT_LINE = `Free shows the last 7 days and scores ${DAILY_GRANT} recordings a\u00a0day. Premium opens all of it.`;
