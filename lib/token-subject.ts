/**
 * The account a bearer token NAMES, read from its payload without
 * verifying its signature (#508). Never trusted on its own: /api/analyze
 * uses it only to start the resend lookup beside the sign-in check, and
 * keeps that lookup's answer only when the check proves the same account.
 * Null for anything that is not a JWT naming a user id.
 */
export function tokenSubject(header: string | null): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const parts = header.slice(7).split(".");
  if (parts.length !== 3 || parts[1].length === 0 || parts[1].length > 4096) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { sub?: unknown } | null;
    const sub = payload?.sub;
    return typeof sub === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sub) ? sub : null;
  } catch {
    return null;
  }
}
