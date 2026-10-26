-- 0019: a push reminder follows its device's time zone across a
-- daylight-saving change.
--
-- push_subscriptions stores the UTC offset the device had when it armed
-- (0008 tz_offset). The cron did all its arithmetic with that number, so
-- after a DST change, for everyone who had not opened the app since (the
-- people a reminder is for), it rang an hour off, judged "done today"
-- against the wrong midnight, and could ring inside quiet hours.
--
-- The device now also sends its IANA zone (Intl), stored here. The cron
-- works out the zone's offset at each tick and keeps tz_offset only as
-- the fallback for rows that have not re-armed since. No drop: one
-- nullable column.

alter table public.push_subscriptions add column if not exists tz text;
