-- Booking requests (2026-11-12). A guest asking on WhatsApp (Meta's AI) or on the website leaves a
-- request; a person at the desk turns it into a booking or turns it down. Nothing outside the desk
-- ever writes `bookings` (the owner: "the system shouldn't do anything on its own"; docs/why/booking.md).
create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('whatsapp', 'website')),
  room_id text not null,
  check_in date not null,
  check_out date not null,
  guests integer,
  guest_name text not null,
  phone text not null,
  note text,
  -- What the guest was told it costs, so the desk can see the bot's quote beside its own bill.
  quoted_total numeric,
  language text,
  status text not null default 'open' check (status in ('open', 'booked', 'declined')),
  booking_id character varying references public.bookings (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (check_out > check_in)
);
create index if not exists booking_requests_open on public.booking_requests (status) where status = 'open';
alter table public.booking_requests enable row level security;
drop policy if exists "Anyone can read booking requests" on public.booking_requests;
create policy "Anyone can read booking requests" on public.booking_requests for select to anon, authenticated using (true);
alter publication supabase_realtime add table public.booking_requests;

-- The only way in. Refuses a room that is already taken, so the bot cannot promise one.
create or replace function public.request_booking(
  p_source text, p_room_id text, p_check_in date, p_check_out date, p_guest_name text, p_phone text,
  p_guests integer default null, p_note text default null, p_quoted_total numeric default null, p_language text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_span int4range := public.booking_halves(p_check_in, p_check_out, null, null, null, null, null);
  v_id uuid;
begin
  if p_check_in < (now() at time zone 'Asia/Manila')::date or p_check_out <= p_check_in
     or p_check_out > p_check_in + 60 then
    raise exception 'BAD_DATES';
  end if;
  if length(trim(coalesce(p_guest_name, ''))) = 0 or length(p_guest_name) > 120
     or length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 7 or length(p_phone) > 40
     or length(coalesce(p_note, '')) > 1000 then
    raise exception 'BAD_DETAILS';
  end if;
  if not exists (select 1 from rooms where id = p_room_id) and not exists (select 1 from venues where id = p_room_id) then
    raise exception 'NO_SUCH_ROOM';
  end if;
  -- ponytail: any Exclusive day refuses every room and venue; refine with exclusiveCovers if the grounds kind matters.
  if exists (select 1 from bookings b
             where (b.room_id = p_room_id or b.venue_id = p_room_id or b.venue_id = 'venue-exclusive') and b.status <> 'cancelled'
               and public.booking_halves(b.check_in, b.check_out, b.stay_hours, b.stay_half,
                     b.actual_check_in, b.late_check_out_hours, b.actual_check_out) && v_span) then
    raise exception 'ROOM_UNAVAILABLE';
  end if;
  -- A flood guard: the public key can call this.
  if (select count(*) from booking_requests where status = 'open' and phone = p_phone) >= 3
     or (select count(*) from booking_requests where status = 'open') >= 100 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  insert into booking_requests (source, room_id, check_in, check_out, guests, guest_name, phone, note, quoted_total, language)
  values (p_source, p_room_id, p_check_in, p_check_out, p_guests, trim(p_guest_name), trim(p_phone), p_note, p_quoted_total, p_language)
  returning id into v_id;
  return v_id;
end;
$$;

-- Why the desk turned it down: a quick reason, its own words, or both (as a cancelled bill keeps).
alter table public.booking_requests add column if not exists decline_note text;

-- The desk booked it (with the booking it made) or turned it down.
create or replace function public.close_booking_request(p_id uuid, p_status text, p_booking_id text default null, p_note text default null)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.booking_requests
     set status = p_status, booking_id = p_booking_id, decline_note = left(p_note, 500), resolved_at = now()
   where id = p_id and status = 'open' and p_status in ('booked', 'declined');
$$;

-- Undo of a turn-down: open again.
create or replace function public.reopen_booking_request(p_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.booking_requests set status = 'open', decline_note = null, resolved_at = null
   where id = p_id and status = 'declined';
$$;

grant execute on function public.request_booking(text, text, date, date, text, text, integer, text, numeric, text) to anon, authenticated;
grant execute on function public.close_booking_request(uuid, text, text, text) to anon, authenticated;
grant execute on function public.reopen_booking_request(uuid) to anon, authenticated;
