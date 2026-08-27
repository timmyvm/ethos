-- Cosmetics follow the account (27 Aug, Timothy's call). The equipped
-- Demos pose was device-local (localStorage) — a bought pose vanished on
-- the next device, which reads as a lost purchase. Ownership still comes
-- from the coin ledger; this column only records which owned pose is on
-- the floor card, and the client keeps falling back to the default for
-- any value the ledger can't prove.
alter table public.profiles
  add column if not exists equipped_pose text;
