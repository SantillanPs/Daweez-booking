-- One booking, several rooms (2026-10-04). Development first.
--
-- A booking of several rooms is stored as one row per room, and every row needs its own
-- invoice number (the column is UNIQUE). Nothing tied the rows together, so a bill
-- reprinted from one room showed only that room and the edit form saw only that room —
-- which matters most for an agency, whose bill must list every room.
--
-- `group_id` is that tie: the same value on every row made in one booking, empty for an
-- ordinary one-room booking. Written by its own small function, like the other narrow
-- writers, so `book_booking` / `update_booking` are left alone and can never blank it.

alter table public.bookings add column if not exists group_id text;
create index if not exists bookings_group_idx on public.bookings (group_id) where group_id is not null;

create or replace function public.set_booking_group(p_booking_id text, p_group_id text)
 returns void language sql security definer set search_path to 'public'
as $function$
    update public.bookings
       set group_id = nullif(btrim(coalesce(p_group_id, '')), '')
     where id = p_booking_id;
$function$;

grant execute on function public.set_booking_group(text, text) to anon, authenticated, service_role;
