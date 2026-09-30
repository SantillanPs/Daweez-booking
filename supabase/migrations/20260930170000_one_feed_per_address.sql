-- ONE ADDRESS, ONE ROOM (the owner's ruling, 2026-09-30: *"do what you think is good"*).
--
-- The channel table held 20 rows for a hotel with **one** real calendar: 11 rows with no address at all
-- (placeholders the Channels screen wrote for every room and channel, whether or not a link was ever pasted)
-- and **9 rows carrying the same Airbnb URL**, one per room.
--
-- That single repeated address is what did the damage the owner saw:
--   * the same calendar was downloaded **9 times** on every sync — on open, then every 5 minutes;
--   * every reservation in it was imported **once per room**, so one Airbnb stay blocked **nine rooms** for
--     the same night — the whole house, for one guest;
--   * and the two screens that wait on the shared load (Analytics, Expenses) sat for ~7 seconds because of it.
--
-- WHAT THIS DOES, and nothing else:
--   1. Deletes the rows that were never given an address. They fetch nothing today and can never fetch
--      anything, so they only make the screen look connected to Booking.com when it is not.
--   2. Keeps **one** row per address and deletes the copies. Nothing else can be lost: every copy held the
--      same URL, so at most one of them could ever have been the right room.
--   3. Hangs the surviving Airbnb calendar off **Room 1**, because a calendar shared by the whole house is the
--      house's, not a room's — so an imported stay lands on one room the desk can move, instead of all ten.
--
-- **No booking is touched.** The imported stays are left exactly as they are (there are none in the table
-- today); this only stops more of them being made.
--
-- IF THE HOTEL REALLY HAS ONE LISTING PER ROOM: paste each room's own iCal link into Settings → Channels. The
-- screen now **refuses to save one address on two rooms** and names the room that already holds it
-- (`utils/feedUrls.ts`), so the mistake cannot be typed twice.

-- 1. The placeholders that were never given an address.
delete from ical_feeds
where coalesce(trim(url), '') = '';

-- 2. One address, one room — keep the oldest row for each address.
with ranked as (
  select id, row_number() over (partition by url order by last_synced asc nulls last, id) as seq
  from ical_feeds
  where coalesce(trim(url), '') <> ''
)
delete from ical_feeds
where id in (select id from ranked where seq > 1);

-- 3. The house's own calendar sits on the first room.
update ical_feeds
set room_id = 'room-1'
where channel = 'airbnb'
  and room_id <> 'room-1';
