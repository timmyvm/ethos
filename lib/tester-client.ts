"use client";

/**
 * Tester mode, the browser half (migration 0020, docs/testers.md).
 *
 * Reads go straight to Supabase under row level security: the account
 * sees its own testers row and its own answers, nothing else. The one
 * write that makes a tester goes through the server (app/api/tester),
 * because only the server knows the code. Answers are written from
 * here, and the database refuses them from anyone who is not a tester.
 */

import { useEffect, useLayoutEffect, useState } from "react";
import { CODE_COPY, CONSENT_VERSION, TEST } from "@/content/tester";
import { currentSession, ensureSession, sessionToken, supabaseBrowser } from "./supabase-browser";
import {
  isCurrentTester,
  isMatchAnswer,
  testerNumber,
  withoutPending,
  withPending,
  type FeedbackRow,
  type Felt,
  type MatchAnswer,
  type ScoreSnapshot,
  type TesterRow,
} from "./tester";
import { remindersZone } from "./reminders-zone";
import { testDay, testPhase, testZone, zoneDayKey, type TestPhase } from "./tester-days";
import { TESTER_HINT_KEY } from "./tester-signal";

/**
 * This device last saw the account as a tester: Settings' row paints
 * right first, and the app's open reads the account's row only on a
 * device that holds it (components/tester/TesterLayer.tsx), so nobody
 * else's open asks anything.
 */
const HINT_KEY = TESTER_HINT_KEY;

/** Said on the window when this device's testing may have changed. */
export const TESTER_CHANGED = "ethos:tester";

function announce(): void {
  // Whatever may have changed, the next shared read is a fresh one.
  once = null;
  try {
    window.dispatchEvent(new Event(TESTER_CHANGED));
  } catch {}
}

function keepHint(on: boolean): void {
  let was = false;
  try {
    was = localStorage.getItem(HINT_KEY) === "1";
    if (on) localStorage.setItem(HINT_KEY, "1");
    else localStorage.removeItem(HINT_KEY);
  } catch {}
  if (was !== on) announce();
}

/** Signing out: the next account on this device is someone else's. */
export function forgetTesterHint(): void {
  keepHint(false);
  writePending({});
  try {
    localStorage.removeItem(SENT_KEY);
    localStorage.removeItem(LIT_KEY);
    // A guest's testing kept for a link is never someone else's to carry.
    localStorage.removeItem(LINK_CARRY_KEY);
  } catch {}
}

export function readTesterHint(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The account's testers row, or null for an account that is not a
 * tester (or no session at all). Throws on a failed read, like every
 * fetcher in lib/client-data.ts: unknown is not "no".
 */
export async function fetchTester(): Promise<TesterRow | null> {
  const db = supabaseBrowser();
  if (!db) return null;
  const me = await currentSession();
  if (!me) return null;
  const { data, error } = await db
    .from("testers")
    .select("consent_version, consented_at, created_at, stopped_at")
    .eq("user_id", me.userId)
    .maybeSingle();
  if (error) throw error;
  const found = (data as TesterRow | null) ?? null;
  /* A tester who stopped (#416) is no tester on this phone: no tile, no
     questions, Settings' plain code row, and the code page to start
     again. The row stays on the server, with what they agreed to. */
  const row = found && !found.stopped_at ? found : null;
  keepHint(row !== null);
  return row;
}

let once: Promise<TesterRow | null> | null = null;

/**
 * The account's testers row, read once per page life and shared by the
 * open's layer (components/tester/TesterLayer.tsx) and Today's test tile,
 * so a tab switch never reads it again. Cleared whenever testing may
 * have changed (`announce`), and after a read with no answer: one that
 * failed, or a null that left the hint standing (no session could be
 * read, an open with no connection), so the next read asks again.
 */
export function testerOnce(): Promise<TesterRow | null> {
  if (!once) {
    const p = fetchTester();
    once = p;
    const forget = () => {
      if (once === p) once = null;
    };
    p.then((row) => {
      if (row === null && readTesterHint()) forget();
    }, forget);
  }
  return once;
}

/**
 * The tester number as this device last sent it (components/tester/SendNumber.tsx),
 * without its space: another account on the phone has another number, and
 * is asked to send it.
 */
const SENT_KEY = "ethos.tester.sent";
/** The test day whose slot last landed on Today's road on this device. */
const LIT_KEY = "ethos.tester.lit";

export function readSent(number: string): boolean {
  try {
    return localStorage.getItem(SENT_KEY) === number.replace(/\s/g, "");
  } catch {
    return false;
  }
}

export function markSent(number: string): void {
  try {
    localStorage.setItem(SENT_KEY, number.replace(/\s/g, ""));
  } catch {}
}

export function readLit(): string | null {
  try {
    return localStorage.getItem(LIT_KEY);
  } catch {
    return null;
  }
}

export function markLit(key: string): void {
  try {
    localStorage.setItem(LIT_KEY, key);
  } catch {}
}

/** The tester number of the session on this phone: undefined until known, null with none. No request. */
export function useTesterNumber(): string | null | undefined {
  const [n, setN] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    currentSession()
      .then((me) => {
        if (live) setN(me ? testerNumber(me.userId) : null);
      })
      .catch(() => {
        if (live) setN(null);
      });
    return () => {
      live = false;
    };
  }, []);
  return n;
}

/** The zone this phone counts the test's days in: the report's (lib/tester-days.ts `testZone`). */
export function testZoneHere(): string {
  return testZone(remindersZone());
}

/**
 * Where this device stands in the test (#402): today's day in the zone
 * the report counts the tester's days in, its phase, and whether Today
 * shows the test, which is a device holding the tester hint during the
 * test or the week after it. Read before the first paint, so the eyebrow
 * and the tile's frame are there from the first frame; nobody else's
 * Today reads anything, and the testers row is read (shared, once per
 * page life) only when shown.
 *
 * Read again whenever the app comes back (shown again, restored from the
 * back/forward cache, focused) and once a minute while it stays open, so
 * a home-screen app left on Today overnight says the new day's number
 * and asks for the new day's recording, never "Day 2 is done." on day 3.
 */
export interface TestPresence {
  shown: boolean;
  today: string;
  day: number;
  phase: TestPhase;
  /** The zone `today` is in, and the tile counts recordings' days in. */
  zone: string;
  tester: "loading" | "failed" | TesterRow;
}

export function useTestPresence(): TestPresence {
  const [at, setAt] = useState<Omit<TestPresence, "tester">>({
    shown: false,
    today: "",
    day: 0,
    phase: "before",
    zone: "",
  });
  const [generation, setGeneration] = useState(0);
  const [tester, setTester] = useState<"loading" | "failed" | TesterRow>("loading");
  useLayoutEffect(() => {
    const read = () => {
      const zone = testZoneHere();
      const today = zoneDayKey(Date.now(), zone);
      const day = testDay(today);
      const phase = testPhase(day);
      const shown =
        readTesterHint() && (phase === "on" || phase === "after" || (phase === "before" && today >= TEST.shownFrom));
      /* The head's boot script held the tile's place (lib/tester-boot.ts);
         from here this keeps that mark in step, so a place held at the
         window's edge, or for a hint just gone, closes before paint. */
      try {
        document.documentElement.toggleAttribute("data-test-tile", shown);
      } catch {}
      setAt((was) =>
        was.shown === shown && was.today === today && was.zone === zone ? was : { shown, today, day, phase, zone }
      );
    };
    read();
    const again = () => {
      read();
      setGeneration((g) => g + 1);
    };
    const resume = () => {
      if (document.visibilityState === "visible") read();
    };
    window.addEventListener(TESTER_CHANGED, again);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("focus", resume);
    const minute = window.setInterval(resume, 60_000);
    return () => {
      window.removeEventListener(TESTER_CHANGED, again);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("focus", resume);
      window.clearInterval(minute);
    };
  }, []);
  useEffect(() => {
    if (!at.shown) return;
    let live = true;
    // A re-read keeps the last row until the new one lands.
    testerOnce()
      .then((row) => {
        if (!live) return;
        if (row) setTester(row);
        // No row and the hint gone: the TESTER_CHANGED read hides the tile.
        // No session at all leaves the hint: the row is unknown.
        else if (readTesterHint()) setTester((t) => (t === "loading" ? "failed" : t));
      })
      .catch(() => {
        if (live) setTester((t) => (t === "loading" ? "failed" : t));
      });
    return () => {
      live = false;
    };
  }, [at.shown, generation]);
  return { ...at, tester };
}

/**
 * The tester state for a screen: undefined while it is read (or when
 * the read failed), null for no, the row for yes. A read that failed
 * (supabase-js has already retried it three times) is read again when
 * `again` changes: the recording screen passes the result's key, so a
 * phone that opened it offline still asks the question once the
 * recording has scored. A current tester's answers still waiting from
 * an earlier screen are sent once the row is known.
 */
export function useTester(again?: unknown): TesterRow | null | undefined {
  const [tester, setTester] = useState<TesterRow | null | undefined>(undefined);
  const known = tester !== undefined;
  useEffect(() => {
    if (known) return;
    let live = true;
    fetchTester()
      .then((t) => {
        if (live) setTester(t);
        if (isCurrentTester(t)) void flushPendingMatches();
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [again, known]);
  return tester;
}

export type CodeAnswer =
  | { ok: true; tester?: TesterRow }
  | { ok: false; error: string; status: number };

async function post(body: Record<string, unknown>, token: string | null): Promise<CodeAnswer> {
  try {
    const res = await fetch("/api/tester", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const out = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      tester?: TesterRow;
    } | null;
    if (res.ok && out?.ok) return { ok: true, tester: out.tester };
    return { ok: false, error: out?.error ?? CODE_COPY.offline, status: res.status };
  } catch {
    return { ok: false, error: CODE_COPY.offline, status: 0 };
  }
}

/**
 * Is this the code? Asked with the session there is, if any, and never
 * minting one: backing out after this leaves nothing behind.
 */
export function checkTesterCode(code: string): Promise<CodeAnswer> {
  return sessionToken().then((token) => post({ code }, token));
}

/**
 * The agree tap: the code again and the consent version on screen, as
 * one request that the server answers with one write. A first visit
 * has no session yet, so this is where the anonymous one is made, the
 * same one the first recording would have made. A tester agreeing to a
 * newer consent sends no code (null): the server finds their row.
 */
export async function joinTesting(code: string | null): Promise<CodeAnswer> {
  const token = await ensureSession();
  const answer = await post(code === null ? { agree: CONSENT_VERSION } : { code, agree: CONSENT_VERSION }, token);
  if (answer.ok) {
    keepHint(true);
    // The consent changed even when the hint did not: collection starts.
    announce();
  }
  return answer;
}

/**
 * Stop testing (#416): the server marks this account's row, and this
 * phone forgets it was a tester and tells collection, so nothing more
 * is sent from this open on.
 */
export async function stopTesting(): Promise<CodeAnswer> {
  const db = supabaseBrowser();
  const token = db ? ((await db.auth.getSession()).data.session?.access_token ?? null) : null;
  const answer = await post({ stop: true }, token);
  if (answer.ok) {
    keepHint(false);
    announce();
  }
  return answer;
}

/** sessionStorage: the anonymous session's token, across Google's round trip. */
const CARRY_KEY = "ethos.tester.carry";

/**
 * Before a sign-in swaps the session: the anonymous session's token,
 * when this phone joined testing on it, so the account signed in to can
 * take that consent with it (app/api/tester `carry`). Null for a phone
 * that never joined, or a session that is already an account.
 */
export async function testerCarryToken(): Promise<string | null> {
  if (!readTesterHint()) return null;
  const db = supabaseBrowser();
  if (!db) return null;
  try {
    const { data } = await db.auth.getSession();
    const s = data.session;
    return s?.user?.is_anonymous ? s.access_token : null;
  } catch {
    return null;
  }
}

/**
 * After the sign-in: the account takes the testing the anonymous session
 * agreed to. Best effort; a sign-in never fails for it.
 */
export async function carryTesting(token: string | null): Promise<boolean> {
  if (!token) return false;
  const answer = await post({ carry: token }, await sessionToken());
  if (answer.ok) keepHint(true);
  return answer.ok;
}

/** Google is about to take the page: the token waits in this tab. */
export function stashTesterCarry(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(CARRY_KEY, token);
    else sessionStorage.removeItem(CARRY_KEY);
  } catch {}
}

/** Back from Google signed in (/auth/callback): carried once, then gone. */
export async function carryStashed(): Promise<boolean> {
  let token: string | null = null;
  try {
    token = sessionStorage.getItem(CARRY_KEY);
    sessionStorage.removeItem(CARRY_KEY);
  } catch {}
  return carryTesting(token);
}

/**
 * localStorage: the guest's token for a confirmation link that will make
 * this device an account that already existed and never confirmed
 * (#426, review). The link opens in whatever tab the mail app picks, so
 * this tab's sessionStorage is no place for it.
 */
export const LINK_CARRY_KEY = "ethos.tester.carry.link";
/** As long as GoTrue's confirmation link lives. Past it, nothing is carried. */
export const LINK_CARRY_TTL_MS = 24 * 3600_000;

/** The link went: the guest's token waits for it on this device, or any old one goes. */
export function keepCarryForLink(token: string | null, now: number = Date.now()): void {
  try {
    if (token) localStorage.setItem(LINK_CARRY_KEY, JSON.stringify({ token, at: now }));
    else localStorage.removeItem(LINK_CARRY_KEY);
  } catch {}
}

/**
 * Back from that link signed in (/auth/callback?resent=1): carried once,
 * then gone. Only a token kept inside the link's life; the server takes
 * it only while it is still the guest's valid session.
 */
export async function carryKeptForLink(now: number = Date.now()): Promise<boolean> {
  let token: string | null = null;
  try {
    const raw = localStorage.getItem(LINK_CARRY_KEY);
    localStorage.removeItem(LINK_CARRY_KEY);
    const kept = raw ? (JSON.parse(raw) as { token?: unknown; at?: unknown }) : null;
    if (
      kept &&
      typeof kept.token === "string" &&
      typeof kept.at === "number" &&
      now - kept.at <= LINK_CARRY_TTL_MS &&
      kept.at <= now + 60_000
    ) {
      token = kept.token;
    }
  } catch {}
  return carryTesting(token);
}

/**
 * Answers that have not landed, kept on this phone (lib/tester.ts
 * PendingMatches) with the account they belong to: a save that fails
 * after the tester has left the screen is sent again on the next
 * recording screen, the way the recording outbox resends a recording.
 * Signing out clears them.
 */
const PENDING_KEY = "ethos.tester.pending";
type Pending = FeedbackRow & { user_id: string };

function readPending(): Record<string, Pending> {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, Pending>) : {};
  } catch {
    return {};
  }
}

function writePending(map: Record<string, Pending>): void {
  try {
    if (Object.keys(map).length) localStorage.setItem(PENDING_KEY, JSON.stringify(map));
    else localStorage.removeItem(PENDING_KEY);
  } catch {}
}

/**
 * One save, upserted on (user_id, client_id), so a changed answer
 * replaces the last one. It waits on the phone, merged with anything
 * still waiting about the same recording (how it felt, say), and the
 * merged row is what goes: a save that lands lands everything said
 * about that recording. False on any failure, which the screen says
 * with its retry.
 */
export async function saveMatch(row: FeedbackRow): Promise<boolean> {
  const db = supabaseBrowser();
  if (!db) return false;
  try {
    const me = await currentSession();
    if (!me) return false;
    const owned: Pending = { ...row, user_id: me.userId };
    const waiting = readPending();
    // A row left by another account on this phone is never merged in.
    if (waiting[row.client_id] && waiting[row.client_id].user_id !== me.userId) delete waiting[row.client_id];
    const now = withPending(waiting, owned);
    writePending(now);
    const sending = now[row.client_id];
    const { error } = await db
      .from("tester_feedback")
      .upsert(sending, { onConflict: "user_id,client_id" });
    if (error) return false;
    writePending(withoutPending(readPending(), sending));
    return true;
  } catch {
    return false;
  }
}

/** Every answer still waiting for this account, sent again. */
export async function flushPendingMatches(): Promise<void> {
  const me = await currentSession();
  if (!me) return;
  for (const row of Object.values(readPending())) {
    if (row.user_id !== me.userId) continue;
    const { user_id: _owner, ...rest } = row;
    await saveMatch(rest);
  }
}

/**
 * What was already said about this recording, as the match check
 * reopens it: the answer after the score (null for none, or for one of
 * 0020's, which answered a different question), the note, the numbers
 * it was given about, and how it felt.
 */
export interface GivenMatch {
  answer: MatchAnswer | null;
  note: string | null;
  scores: ScoreSnapshot | null;
  felt: Felt | null;
}

function given(row: { answer?: unknown; note?: string | null; scores?: ScoreSnapshot | null; felt?: Felt | null }): GivenMatch {
  const answer = isMatchAnswer(row.answer) ? row.answer : null;
  return {
    answer,
    note: answer ? (row.note ?? null) : null,
    scores: row.scores && Object.keys(row.scores).length ? row.scores : null,
    felt: row.felt ?? null,
  };
}

/**
 * The account's own answer about one recording (RLS: own rows only), or
 * null for none. A newer answer still waiting on this phone wins over
 * the stored one. Throws on a failed read.
 */
export async function fetchMatch(clientId: string): Promise<GivenMatch | null> {
  const waiting = readPending()[clientId];
  const me = await currentSession();
  if (waiting && me && waiting.user_id === me.userId && waiting.answer) {
    return given(waiting);
  }
  const db = supabaseBrowser();
  if (!db || !me) return null;
  const { data, error } = await db
    .from("tester_feedback")
    .select("answer, note, scores, felt")
    .eq("user_id", me.userId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data ? given(data as Parameters<typeof given>[0]) : null;
}

/** The consent version this device last asked a tester about, once (lib/tester.ts asksAgain). */
const ASKED_KEY = "ethos.tester.asked";

export function readAsked(): number {
  try {
    return Number(localStorage.getItem(ASKED_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function markAsked(version: number = CONSENT_VERSION): void {
  try {
    localStorage.setItem(ASKED_KEY, String(version));
  } catch {}
}
