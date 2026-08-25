/**
 * The outbox: finished recordings, held on the device until the server
 * confirms it stored them.
 *
 * Losing ninety seconds of speaking to one bad minute of wifi is the
 * worst failure in the product. The in-memory retry (the `pendingRef`
 * on the recording screen) survives a failed request but not a closed
 * tab, so the blob goes into IndexedDB the moment recording stops,
 * BEFORE the first upload attempt, and leaves only when /api/analyze
 * answers with a stored rep id. Anything still here on the next visit
 * is re-sent quietly in the background (components/OutboxRetry.tsx).
 *
 * Native IndexedDB only, no wrapper library. Every call degrades to a
 * no-op where IndexedDB is missing (SSR, some private windows): the
 * product's floor is the old behavior, never a crash.
 */

export interface OutboxRep {
  /** Client-generated: `<timestamp>-<lessonId>-<random>`. */
  id: string;
  createdAt: number;
  audio: Blob;
  filename: string;
  /** Every non-audio field of the /api/analyze form, ready to replay. */
  fields: Record<string, string>;
}

/** Waits between attempts. Three retries: patient, not stubborn. */
export const RETRY_DELAYS_MS = [2_000, 8_000, 30_000];

const DB_NAME = "ethos-outbox";
const STORE = "reps";

export function newOutboxId(lessonId: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${lessonId.replace(/[^\w-]/g, "_")}-${rand}`;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function done(tx: IDBTransaction): Promise<boolean> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

export async function outboxPut(rep: OutboxRep): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rep);
    const ok = await done(tx);
    db.close();
    return ok;
  } catch {
    db.close();
    return false;
  }
}

export async function outboxAll(): Promise<OutboxRep[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    const rows = await new Promise<OutboxRep[]>((resolve) => {
      req.onsuccess = () => resolve((req.result as OutboxRep[]) ?? []);
      req.onerror = () => resolve([]);
    });
    db.close();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    db.close();
    return [];
  }
}

export async function outboxDelete(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await done(tx);
  } catch {
    // Deletion failing just means one extra re-send later.
  }
  db.close();
}

/** Rebuild the /api/analyze form from a stored record. */
export function replayForm(rep: OutboxRep): FormData {
  const form = new FormData();
  form.append("audio", rep.audio, rep.filename);
  for (const [k, v] of Object.entries(rep.fields)) form.append(k, v);
  return form;
}

/**
 * Ids currently being uploaded in this tab, so the background flush
 * and the recording screen never send the same rep twice at once.
 */
const inFlight = new Set<string>();

export function markInFlight(id: string): void {
  inFlight.add(id);
}

export function clearInFlight(id: string): void {
  inFlight.delete(id);
}

export function isInFlight(id: string): boolean {
  return inFlight.has(id);
}

export interface SendOutcome {
  /** The request round-tripped and the body parsed. */
  ok: boolean;
  status: number;
  /** True when the server confirmed a stored rep (or nothing was ever
   *  going to store it: local mode with no session to attribute to). */
  settled: boolean;
  data: unknown;
}

/**
 * One upload attempt with the retry ladder. Retries only what waiting
 * can fix: network failures and gateway 5xx. A 4xx (including the rate
 * limiter's 429) is an answer, not an outage.
 */
export async function sendWithRetry(
  form: FormData,
  token: string | null,
  onAttempt?: (attempt: number) => void
): Promise<SendOutcome> {
  const attempts = RETRY_DELAYS_MS.length + 1;
  let last: SendOutcome = { ok: false, status: 0, settled: false, data: null };
  for (let i = 0; i < attempts; i++) {
    onAttempt?.(i);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        const repId = (data as { repId?: string | null }).repId ?? null;
        return { ok: true, status: res.status, settled: repId !== null || !token, data };
      }
      last = { ok: false, status: res.status, settled: false, data };
      // 5xx from a gateway is weather; anything else is a verdict.
      if (res.status < 500) return last;
    } catch {
      last = { ok: false, status: 0, settled: false, data: null };
    }
    // Waiting out a retry while offline is theatre; stop and let the
    // `online` event trigger the next try.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return last;
    }
    if (i < RETRY_DELAYS_MS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[i]));
    }
  }
  return last;
}
