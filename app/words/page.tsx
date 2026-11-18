import { redirect } from "next/navigation";

/**
 * Your words (#411) is now Say it better (#507): the word sheet's saves
 * and the coach's pairs are one list at /say. An old link, a bookmark or
 * a phone's history still lands, with the recording it came from kept as
 * the page's way back.
 */
export default async function YourWords({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const { from } = await searchParams;
  const back = typeof from === "string" && /^\/rep\/[\w-]{1,64}$/.test(from) ? from : null;
  redirect(back ? `/say?from=${encodeURIComponent(back)}` : "/say");
}
