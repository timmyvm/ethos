/**
 * The key a recording travels under when it is not the recording
 * screen's own (#436). The recording screen keys every take in its
 * outbox (lib/rep-outbox.ts) and the server stores a key once however
 * many times it arrives (migration 0016, /api/analyze). An uploaded
 * file and a Hostile take were sent with no key, so a send whose answer
 * was lost on the way back, followed by a second try, stored the same
 * recording twice: two rows in the Log, two days' XP.
 *
 * A key is made when the action starts and sent with every try.
 */

/** FNV-1a, 32 bits, as eight hex characters: enough to tell two file names apart. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * An uploaded file's key, from the file itself: the same file picked
 * again after a send that failed, or one that landed without its answer
 * coming back, is the same recording and opens as the one already
 * stored. Its size, its date and its name's hash; never the name, which
 * is the person's own words.
 */
export function uploadKey(file: { name: string; size: number; lastModified: number }): string {
  const when = Number.isFinite(file.lastModified) ? Math.max(0, Math.trunc(file.lastModified)) : 0;
  return `upload-${Math.max(0, Math.trunc(file.size))}-${when}-${hash(file.name)}`;
}

/** A Hostile take's key, made when the take is banked and kept for its retry. */
export function hostileKey(now: number = Date.now(), random: () => number = Math.random): string {
  return `hostile-${Math.trunc(now)}-${Math.floor(random() * 0xffffffff).toString(16).padStart(8, "0")}`;
}

/**
 * A key made off the recording screen. A tester's match question is
 * asked of recordings made on it, as it was before these had a key at
 * all (lib/tester.ts `showsMatchCheck`).
 */
export function isSideKey(id: string): boolean {
  return /^(upload|hostile)-/.test(id);
}
