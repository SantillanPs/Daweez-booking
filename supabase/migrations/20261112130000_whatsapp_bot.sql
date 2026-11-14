-- The WhatsApp bot (2026-11-12). It answers guests from `whatsapp-bot`, an edge function holding the
-- service key; nothing here is open to the app's public key.

-- What the bot may tell a guest: each room or venue free for those dates, and what it costs. The same
-- overlap rule as `request_booking`, so the bot never offers a room the request would then refuse.
create or replace function public.free_units(p_check_in date, p_check_out date)
returns table (id text, kind text, name text, capacity integer, price numeric, total numeric)
language sql
stable
security definer
set search_path to 'public'
as $$
  with span as (select public.booking_halves(p_check_in, p_check_out, null, null, null, null, null) as v),
  units as (
    select r.id::text, 'room'::text as kind, 'Room ' || r.room_number || coalesce(' · ' || r.name, '') as name, r.capacity,
           case when r.promo_price > 0 then r.promo_price else r.base_price end as price
      from rooms r
    union all
    -- The Exclusive is the whole house: the desk sells it, never the bot.
    select v.id::text, 'venue', v.name::text, v.capacity,
           case when v.promo_price > 0 then v.promo_price else v.base_price end
      from venues v where v.id <> 'venue-exclusive'
  )
  select u.id, u.kind, u.name, u.capacity, u.price, u.price * (p_check_out - p_check_in)
    from units u, span s
   where p_check_out > p_check_in
     and not exists (
       select 1 from bookings b
        where (b.room_id = u.id or b.venue_id = u.id or b.venue_id = 'venue-exclusive') and b.status <> 'cancelled'
          and public.booking_halves(b.check_in, b.check_out, b.stay_hours, b.stay_half,
                b.actual_check_in, b.late_check_out_hours, b.actual_check_out) && s.v)
   order by u.kind, u.price;
$$;
revoke execute on function public.free_units(date, date) from public, anon, authenticated;

-- The chat so far, one row per message, so the bot remembers what the guest said a minute ago.
-- `wamid` is WhatsApp's id for a guest's message: Meta sometimes sends one twice.
create table if not exists public.whatsapp_turns (
  id bigint generated always as identity primary key,
  phone text not null,
  role text not null check (role in ('user', 'assistant')),
  text text not null,
  wamid text unique,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_turns_phone on public.whatsapp_turns (phone, id desc);
alter table public.whatsapp_turns enable row level security;
