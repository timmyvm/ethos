/**
 * Work through `items` with at most `lanes` at a time, in order of start;
 * resolves when every one has finished. `work` must not throw: a lane
 * that throws stops taking items and the whole call rejects, so callers
 * catch inside it. No timer is used, so fake clocks in tests run it as is.
 *
 * The reminder sender sends this way (docs/scale/audit.md DB-4): one at a
 * time, each reminder's four reads and its push took about a quarter
 * second, and a 60-second function served about 240 a tick.
 */
export async function inLanes<T>(items: readonly T[], lanes: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++];
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(lanes, items.length)) }, lane));
}
