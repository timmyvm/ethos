/**
 * A read of the account's own rows names the account (docs/scale/audit.md
 * DB-1 and DB-2, #512). Row level security already limits every read to
 * them, and naming the account returns exactly the same rows, but with
 * the policy alone Postgres can ask it of each row it looks at, and
 * Supabase's auth.uid() parses the request's JWT each time it is asked.
 * The lexicon read, with no index under the policy alone, scanned every
 * account's pairs on every open. Named, the policy is asked once and the
 * account's own index answers (docs/scale/explain.txt).
 *
 * `userId` is the session's own (read on the phone, no request); with
 * none the read goes as it did, left to the policy.
 */
export function own<Q>(query: Q, userId: string | null | undefined): Q {
  // Typed loosely: supabase-js's own filter types are too deep for a
  // constraint here, and its eq returns the builder it was called on.
  return userId ? (query as unknown as { eq(column: string, value: string): Q }).eq("user_id", userId) : query;
}
