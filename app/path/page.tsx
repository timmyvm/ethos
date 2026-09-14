import { redirect } from "next/navigation";

/**
 * The road lived here, then Today, then here again, and now it is the
 * Lessons page at /lessons (DECISIONS #267, #269).
 *
 * The route stays as a redirect so old bookmarks and the service
 * worker's cached links land on the thing they were pointing at.
 */
export default function PathPage() {
  redirect("/lessons");
}
