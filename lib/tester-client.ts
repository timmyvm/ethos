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

import { useEffect, useState } from "react";
import { CODE_COPY, CONSENT_VERSION } from "@/content/tester";
import { currentSession, ensureSession, sessionToken, supabaseBrowser } from "./supabase-browser";
import {
  isCurrentTester,
  isMatchAnswer,
  withoutPending,
  withPending,
  type FeedbackRow,
  type Felt,
  type MatchAnswer,
  type ScoreSnapshot,
  type TesterRow,
} from "./tester";

/**
 * This device last saw the account as a tester: Settings' row paints
 * right first, and the app's open reads the account's row only on a
 * device that holds it (components/tester/TesterLayer.tsx), so nobody
 * else's open asks anything.
 */
const HINT_KEY = "ethos.tester";

/** Said on the window when this device's testing may have changed. */
export const TESTER_CHANGED = "ethos:tester";

function announce(): void {
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
    .select("consent_version, consented_at")
    .eq("user_id", me.userId)
    .maybeSingle();
  if (error) throw error;
  const row = (data as TesterRow | null) ?? null;
  keepHint(row !== null);
  return row;
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
