-- The introduction's two new answers (DECISIONS #249).
--
-- The NAME is deliberately not here. It already has a home in
-- profiles.display_name, which `updateDisplayName` writes and /you reads
-- and edits; a second copy on this table would be two truths about one
-- string, and the loser would be whichever screen was written last.
--
-- The reminder HOUR has nowhere on the server to live. It is a device
-- preference (lib/prefs.ts) and push_subscriptions carries it once a
-- subscription exists, but a subscription only exists after notification
-- permission is granted, and the introduction deliberately asks for no
-- permission. So the answer is stored with the answers, and a new phone
-- inherits the choice before it has been granted anything.
alter table public.onboarding
  add column if not exists reminder_hour smallint
    check (reminder_hour is null or reminder_hour between 0 and 23);

-- content/portfolio.ts's PORTFOLIO_RULES_VERSION moved to 2 when the
-- table gained Demos's opening line, so a stored portfolio built by an
-- older client can be told apart from one the current table built.
alter table public.onboarding alter column rules_version set default 2;
