-- 0033: the profile photo's bucket (#485, Timothy 16 Nov: "add a pfp option").
--
-- One private bucket, made the way the audio bucket is (0001): nothing
-- in it is public, and no storage policy lets a browser read, list or
-- write it. The server uploads each photo with the service role under
-- the account's own id (<user id>/<time>.webp) and signs an hour's link
-- to it only for that account (app/api/avatar), the shape the
-- recordings' audio has (app/api/audio, docs/testers.md). The account's
-- removal takes the folder with it (app/api/account).
--
-- Two walls behind the route's own checks: 512 KB a file (the phone
-- sends a 256px square, about 30 KB) and only WebP or JPEG.
--
-- The app works before this runs: with no bucket a read is "no photo",
-- the card draws the name's initial, and a save says photos are not on
-- yet.
--
-- Running the file twice is safe.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 524288, array['image/webp', 'image/jpeg'])
on conflict (id) do update
   set public = false,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;
