-- BOOKING.COM BY CALENDAR LINKS (Sebastian, 2026-10-31: "let's choose calendar links for now").
--
-- A calendar link says only which dates are taken, so what arrives is a stay with no name. The sync
-- may ADD a stay. It never changes or removes one: a stay gone from the link, or one that lands on a
-- room already taken, becomes a row in `channel_alerts` and the desk decides (`docs/why/`).

-- Which stay on the calendar link this booking is: `booking_com|room-3|2026-11-03|2026-11-05`, the
-- link's own room and dates. A guest moved to another room keeps it, so the sync still finds them.
-- `update_booking` does not name this column, so no save from a screen can wipe it.
alter table public.bookings add column if not exists channel_ref text;
create unique index if not exists bookings_channel_ref_key
  on public.bookings (channel_ref)
  where channel_ref is not null and status <> 'cancelled';

-- What needs the desk: `clash` (sold on the link, the room is taken here) and `gone` (the stay left
-- the link). A row stays after it is dealt with, so the sync does not ask the same thing again; the
-- sync removes it once the stay has left the link.
create table if not exists public.channel_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('clash', 'gone')),
  channel text not null,
  ref text not null,
  room_id text not null,
  check_in date not null,
  check_out date not null,
  booking_id character varying references public.bookings (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (ref, kind)
);
alter table public.channel_alerts enable row level security;
drop policy if exists "Anyone can read channel alerts" on public.channel_alerts;
create policy "Anyone can read channel alerts" on public.channel_alerts for select to anon, authenticated using (true);
alter publication supabase_realtime add table public.channel_alerts;

-- The next bill number, the same way `billNumber` (utils/billNumber.ts) works it out on the desk.
create or replace function public.next_bill_number()
returns text
language sql
stable
set search_path to 'public'
as $$
  with t as (select (now() at time zone 'Asia/Manila')::date as d),
  n as (
    select b.created_at, regexp_match(b.invoice_number, '^(\d{4})(\d{2})-(\d+)-(\d+)$') as m
      from bookings b
     where b.invoice_number is not null
  ),
  c as (
    select
      greatest(
        count(*) filter (where (n.created_at at time zone 'Asia/Manila')::date >= date_trunc('year', t.d)::date),
        coalesce(max((n.m[3])::int) filter (where n.m[1] = to_char(t.d, 'YYYY')), 0)
      ) as y,
      greatest(
        count(*) filter (where (n.created_at at time zone 'Asia/Manila')::date >= date_trunc('month', t.d)::date),
        coalesce(max((n.m[4])::int) filter (where n.m[1] || n.m[2] = to_char(t.d, 'YYYYMM')), 0)
      ) as m
    from n, t
  )
  select to_char(t.d, 'YYYYMM') || '-' || (c.y + 1) || '-' || (c.m + 1) from t, c;
$$;

-- One stay from the link written as a booking. Half-days and cancelled stays are left to the
-- exclusion constraint, the one rule that decides whether a room is free.
create or replace function public.insert_channel_stay(p_channel text, p_ref text, p_room_id text, p_check_in date, p_check_out date)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id text;
begin
  for attempt in 1..5 loop
    begin
      insert into bookings (room_id, guest_name, guest_email, guest_phone, check_in, check_out, source, status,
                            payment_status, payment_plan, balance_due, invoice_number, channel_ref)
      values (p_room_id, case when p_channel = 'airbnb' then 'Airbnb guest' else 'Booking.com guest' end, '', '',
              p_check_in, p_check_out, p_channel::booking_source, 'confirmed',
              'unpaid', 'reservation', 0, next_bill_number(), p_ref)
      returning id into v_id;
      return v_id;
    exception when unique_violation then
      -- Another booking took that number, or another sync already added this stay.
      if exists (select 1 from bookings where channel_ref = p_ref and status <> 'cancelled') then
        return null;
      end if;
    end;
  end loop;
  raise exception 'NO_BILL_NUMBER';
end;
$$;

-- For the sync: add the stay, or say who is in the way and raise the alert.
create or replace function public.add_channel_stay(p_channel text, p_ref text, p_room_id text, p_check_in date, p_check_out date)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id text;
  v_in_way text;
begin
  begin
    v_id := insert_channel_stay(p_channel, p_ref, p_room_id, p_check_in, p_check_out);
    delete from channel_alerts where ref = p_ref and kind = 'clash';
    return jsonb_build_object('added', v_id is not null);
  exception when exclusion_violation then
    select b.id into v_in_way
      from bookings b
     where b.room_id = p_room_id and b.status <> 'cancelled'
       and booking_halves(b.check_in, b.check_out, b.stay_hours, b.stay_half, b.actual_check_in, b.late_check_out_hours, b.actual_check_out)
           && booking_halves(p_check_in, p_check_out, null, null, null, null, null)
     order by b.check_in
     limit 1;
    insert into channel_alerts (kind, channel, ref, room_id, check_in, check_out, booking_id)
    values ('clash', p_channel, p_ref, p_room_id, p_check_in, p_check_out, v_in_way)
    on conflict (ref, kind) do update set booking_id = excluded.booking_id;
    return jsonb_build_object('added', false, 'clash_with', v_in_way);
  end;
end;
$$;
revoke all on function public.insert_channel_stay(text, text, text, date, date) from public, anon, authenticated;
revoke all on function public.add_channel_stay(text, text, text, date, date) from public, anon, authenticated;

-- The desk's answer to "Sold twice": put the guest in another room.
create or replace function public.place_channel_stay(p_alert_id uuid, p_room_id text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_alert channel_alerts;
  v_id text;
begin
  select * into v_alert from channel_alerts where id = p_alert_id and kind = 'clash' and status = 'open' for update;
  if not found then
    raise exception 'ALERT_NOT_OPEN';
  end if;
  begin
    v_id := insert_channel_stay(v_alert.channel, v_alert.ref, p_room_id, v_alert.check_in, v_alert.check_out);
  exception when exclusion_violation then
    raise exception 'ROOM_TAKEN';
  end;
  update channel_alerts set status = 'done', resolved_at = now() where id = p_alert_id;
  return v_id;
end;
$$;

-- The desk has dealt with it some other way.
create or replace function public.close_channel_alert(p_alert_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.channel_alerts set status = 'done', resolved_at = now() where id = p_alert_id;
$$;
grant execute on function public.place_channel_stay(uuid, text) to anon, authenticated;
grant execute on function public.close_channel_alert(uuid) to anon, authenticated;

-- A room swapped on the bill is a new row, so the stay's link goes with it. Without this the next
-- sync would find the stay missing and add it a second time.
create or replace function public.move_channel_ref(p_from text, p_to text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ref text;
begin
  update bookings b set channel_ref = null
    from (select id, channel_ref from bookings where id = p_from for update) o
   where b.id = o.id
  returning o.channel_ref into v_ref;
  update bookings set channel_ref = v_ref, source = (select source from bookings where id = p_from) where id = p_to;
  update channel_alerts set booking_id = p_to where booking_id = p_from and kind = 'gone';
end;
$$;
grant execute on function public.move_channel_ref(text, text) to anon, authenticated;

-- However a stay comes to be cancelled, its "gone" question has been answered.
create or replace function public.close_gone_alert_on_cancel()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update channel_alerts set status = 'done', resolved_at = now()
   where booking_id = new.id and kind = 'gone' and status = 'open';
  return new;
end;
$$;
drop trigger if exists close_gone_alert_on_cancel on public.bookings;
create trigger close_gone_alert_on_cancel
  after update of status on public.bookings
  for each row
  when (new.status = 'cancelled' and old.status <> 'cancelled' and new.channel_ref is not null)
  execute function public.close_gone_alert_on_cancel();

-- The nights a room cannot be sold on the link, read from `booking_halves`. A night needs its
-- afternoon and the next morning, so a morning short stay takes the night before it and leaves its
-- own night free, and a guest who left early frees the nights after. A stay is left out of the link
-- it came from, so Booking.com is never told about its own guest (`p_for`).
create or replace function public.channel_export(p_room_id text, p_for text default null)
returns table (id text, first_night date, last_night date, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id::text,
         date '2000-01-01' + ceil((lower(h.r) - 2) / 2.0)::int,
         date '2000-01-01' + floor((upper(h.r) - 2) / 2.0)::int,
         b.created_at
    from bookings b
    cross join lateral (
      select booking_halves(b.check_in, b.check_out, b.stay_hours, b.stay_half, b.actual_check_in, b.late_check_out_hours, b.actual_check_out) as r
    ) h
   where b.room_id = p_room_id
     and b.status in ('pending', 'confirmed', 'blocked')
     and upper(h.r) >= ((now() at time zone 'Asia/Manila')::date - date '2000-01-01') * 2
     and (p_for is null or b.channel_ref is null or b.channel_ref not like p_for || '|' || p_room_id || '|%');
$$;
grant execute on function public.channel_export(text, text) to anon, authenticated;

-- Asked on a schedule, so a sale reaches the calendar with every screen closed. `channel_sync` still
-- decides whether anything is fetched. The address is this database's own: on live, use its ref.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('sync-calendar-links', '*/15 * * * *', $job$
  select net.http_post(
    url := 'https://uopxfnyyitoxmyvrgngp.supabase.co/functions/v1/sync-ical',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);
