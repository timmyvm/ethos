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
import type { FeedbackRow, TesterRow } from "./tester";

/** This device last saw the account as a tester: Settings' row paints right first. */
const HINT_KEY = "ethos.tester";

function keepHint(on: boolean): void {
  try {
    if (on) localStorage.setItem(HINT_KEY, "1");
    else localStorage.removeItem(HINT_KEY);
  } catch {}
}

/** Signing out: the next account on this device is someone else's. */
export function forgetTesterHint(): void {
  keepHint(false);
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
 * the read failed), null for no, the row for yes.
 */
export function useTester(): TesterRow | null | undefined {
  const [tester, setTester] = useState<TesterRow | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    fetchTester()
      .then((t) => {
        if (live) setTester(t);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
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
 * same one the first recording would have made.
 */
export async function joinTesting(code: string): Promise<CodeAnswer> {
  const token = await ensureSession();
  const answer = await post({ code, agree: CONSENT_VERSION }, token);
  if (answer.ok) keepHint(true);
  return answer;
}

/**
 * One answer, upserted on (user_id, client_id), so a changed answer
 * replaces the last one. False on any failure, which the screen says
 * with its retry.
 */
export async function saveMatch(row: FeedbackRow): Promise<boolean> {
  const db = supabaseBrowser();
  if (!db) return false;
  try {
    const me = await currentSession();
    if (!me) return false;
    const { error } = await db
      .from("tester_feedback")
      .upsert({ ...row, user_id: me.userId }, { onConflict: "user_id,client_id" });
    return !error;
  } catch {
    return false;
  }
}
