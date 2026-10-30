/**
 * GET /api/audio?rep=<id>: a short-lived link to play one stored
 * recording, for the recording's owner only (the Log's page,
 * app/rep/[id]).
 *
 * The audio bucket is private, and every upload is made by the server
 * with the service role under `reps/<time>-<name>` (lib/db.ts): no owner
 * on the object and no user folder in its path, so no storage policy
 * can tell one person's recording from another's. Signing from the
 * browser needed a policy that lets any session sign any object in the
 * bucket, testers' and minors' voices included (the review of 30 Oct,
 * docs/testers.md). This route reads the recording's row, signs only
 * when it is the caller's, and answers 404 for anyone else's as for one
 * that does not exist. The browser needs no storage policy at all.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, supabaseAdmin } from "@/lib/db";

export const runtime = "nodejs";

/** An hour: long enough to listen, short enough that a copied link dies. */
const LINK_SECONDS = 3600;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NONE = { error: "That recording has no audio." };

export async function GET(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization")).catch(() => null);
  if (!user) {
    return NextResponse.json(
      { error: "That session has expired. Sign in and try again." },
      { status: 401 }
    );
  }

  const id = req.nextUrl.searchParams.get("rep") ?? "";
  if (!UUID.test(id)) return NextResponse.json(NONE, { status: 404 });

  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: "Accounts aren't configured on this server." },
      { status: 503 }
    );
  }

  const { data, error } = await db
    .from("reps")
    .select("audio_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("audio: read failed", error.message);
    return NextResponse.json({ error: "The recording didn't load. Try again." }, { status: 502 });
  }
  const path = (data as { audio_path: string | null } | null)?.audio_path;
  if (!path) return NextResponse.json(NONE, { status: 404 });

  const { data: signed, error: signError } = await db.storage
    .from("audio")
    .createSignedUrl(path, LINK_SECONDS);
  if (signError || !signed?.signedUrl) {
    console.error("audio: sign failed", signError?.message);
    return NextResponse.json({ error: "The recording didn't load. Try again." }, { status: 502 });
  }
  return NextResponse.json(
    { url: signed.signedUrl },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
