-- 0031: the brand bucket is private (security audit, 11 Nov, second pass).
--
-- The bucket dates from before the git link, when a deploy went up as
-- files and its binaries came from here (docs/archive/BUILT.md). It was
-- public, and beside the pictures it still held the whole source tree of
-- 10 Aug as one file, src-bundle.json, and a src/ folder of loose files:
-- the coach's prompt, the scoring, the schema, readable by anyone with
-- the address. No key or secret is in it (scanned), and nothing the app
-- serves reads this bucket any more, so it is closed.
--
-- Closing it stops the storage server answering. A copy the CDN already
-- held can outlive that, and only removing the files themselves clears
-- it: Storage, brand, in the Supabase dashboard (STATE.md, Open).
--
-- Running the file twice is safe.

update storage.buckets
   set public = false
 where id = 'brand';
