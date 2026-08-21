import { redirect } from "next/navigation";

/**
 * The path lives on home (DECISIONS #141, finished by #155): the road
 * under the floor card is the whole thing, gates and all, so this tab
 * was a second door to the same room. The route stays so old bookmarks
 * and the service worker's cached links land somewhere real.
 */
export default function PathPage() {
  redirect("/");
}
