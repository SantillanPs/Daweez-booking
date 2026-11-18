-- **Pay online** (Sebastian, 2026-11-17): a guest on the website pays half or all of the stay by GCash or a bank
-- transfer and adds the screenshot before the request is sent. "Can a website guest still send a request without
-- paying?" — "no". The request still holds no room ("same as the messenger booking, it should be a ghost
-- reservation until confirmed by staff that the guest paid"): the desk finds the money in the app, then books it.

alter table public.booking_requests
  add column if not exists pay_amount numeric,
  add column if not exists pay_method text,          -- 'GCash' or 'Bank transfer', as the bill writes them
  add column if not exists pay_account text,         -- which account it was sent to: 'gcash', 'bank', 'bank2'
  add column if not exists pay_reference text,
  add column if not exists pay_shot text,            -- the screenshot's path in the payment-shots bucket
  add column if not exists pay_read jsonb;           -- what was read off the screenshot (read-payment-shot)

-- The screenshots: private. A guest can only add one; only the desk can look at them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-shots', 'payment-shots', false, 6291456, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

drop policy if exists "payment shots: guests add" on storage.objects;
create policy "payment shots: guests add" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'payment-shots');
drop policy if exists "payment shots: desk reads" on storage.objects;
create policy "payment shots: desk reads" on storage.objects for select to authenticated
  using (bucket_id = 'payment-shots');

drop function if exists public.request_booking(text, text, date, date, text, text, integer, text, numeric, text, text[]);
create function public.request_booking(p_source text, p_room_id text, p_check_in date, p_check_out date, p_guest_name text, p_phone text,
  p_guests integer default null, p_note text default null, p_quoted_total numeric default null, p_language text default null,
  p_companions text[] default '{}'::text[],
  p_pay_amount numeric default null, p_pay_method text default null, p_pay_account text default null,
  p_pay_reference text default null, p_pay_shot text default null, p_pay_read jsonb default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_span int4range := public.booking_halves(p_check_in, p_check_out, null, null, null, null, null);
  v_names text[] := array(select trim(n) from unnest(coalesce(p_companions, '{}')) n where length(trim(n)) > 0);
  v_id uuid;
begin
  if p_check_in < (now() at time zone 'Asia/Manila')::date or p_check_out <= p_check_in
     or p_check_out > p_check_in + 60 then
    raise exception 'BAD_DATES';
  end if;
  if length(trim(coalesce(p_guest_name, ''))) = 0 or length(p_guest_name) > 120
     or length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 7 or length(p_phone) > 40
     or length(coalesce(p_note, '')) > 1000
     or coalesce(array_length(v_names, 1), 0) > 30 or exists (select 1 from unnest(v_names) n where length(n) > 120) then
    raise exception 'BAD_DETAILS';
  end if;
  -- The website's guest pays before the request goes in; the chat bot's guest is still sent the accounts after.
  if p_source = 'website' and (coalesce(p_pay_amount, 0) <= 0 or p_pay_method not in ('GCash', 'Bank transfer')
     or p_pay_account not in ('gcash', 'bank', 'bank2') or coalesce(p_pay_shot, '') !~ '^[0-9a-f-]{36}\.[a-z]{3,4}$'
     or length(regexp_replace(coalesce(p_pay_reference, ''), '\D', '', 'g')) < 6 or length(p_pay_reference) > 60) then
    raise exception 'NEED_PAYMENT';
  end if;
  if exists (select 1 from rooms where id = p_room_id)
     and coalesce(p_guests, 1) > 1 and coalesce(array_length(v_names, 1), 0) < p_guests - 1 then
    raise exception 'NEED_COMPANIONS';
  end if;
  if not exists (select 1 from rooms where id = p_room_id) and not exists (select 1 from venues where id = p_room_id) then
    raise exception 'NO_SUCH_ROOM';
  end if;
  if exists (select 1 from bookings b
             where (b.room_id = p_room_id or b.venue_id = p_room_id or b.venue_id = 'venue-exclusive') and b.status <> 'cancelled'
               and public.booking_halves(b.check_in, b.check_out, b.stay_hours, b.stay_half,
                     b.actual_check_in, b.late_check_out_hours, b.actual_check_out) && v_span) then
    raise exception 'ROOM_UNAVAILABLE';
  end if;
  if (select count(*) from booking_requests where status = 'open' and phone = p_phone) >= 3
     or (select count(*) from booking_requests where status = 'open') >= 100 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  insert into booking_requests (source, room_id, check_in, check_out, guests, guest_name, phone, note, quoted_total, language, companions,
                                pay_amount, pay_method, pay_account, pay_reference, pay_shot, pay_read)
  values (p_source, p_room_id, p_check_in, p_check_out, p_guests, trim(p_guest_name), trim(p_phone), p_note, p_quoted_total, p_language, v_names,
          p_pay_amount, p_pay_method, p_pay_account, nullif(trim(p_pay_reference), ''), p_pay_shot,
          case when jsonb_typeof(p_pay_read) = 'object' and length(p_pay_read::text) < 2000 then p_pay_read end)
  returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.request_booking(text, text, date, date, text, text, integer, text, numeric, text, text[], numeric, text, text, text, text, jsonb) from public;
grant execute on function public.request_booking(text, text, date, date, text, text, integer, text, numeric, text, text[], numeric, text, text, text, text, jsonb) to anon, authenticated, service_role;

-- Who used this reference before, if anyone: a booking's payment or another request. Digits only, so
-- "9012 345 678 901" and "9012345678901" are the same. For the desk's "Reference never used before".
create or replace function public.payment_reference_seen(p_reference text, p_except uuid default null)
 returns text
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with d as (select regexp_replace(coalesce(p_reference, ''), '\D', '', 'g') as ref)
  select coalesce(
    (select coalesce(b.guest_name, 'a booking') || ', ' || to_char(p.paid_at at time zone 'Asia/Manila', 'FMDD Mon')
       from payments p left join bookings b on b.id = p.bill_id or b.group_id = p.bill_id, d
      where length(d.ref) >= 6 and p.removed_at is null and regexp_replace(coalesce(p.reference, ''), '\D', '', 'g') = d.ref
      order by p.paid_at limit 1),
    (select r.guest_name || ', ' || to_char(r.created_at at time zone 'Asia/Manila', 'FMDD Mon')
       from booking_requests r, d
      where length(d.ref) >= 6 and r.id is distinct from p_except and regexp_replace(coalesce(r.pay_reference, ''), '\D', '', 'g') = d.ref
      order by r.created_at limit 1))
$function$;
revoke all on function public.payment_reference_seen(text, uuid) from public, anon;
grant execute on function public.payment_reference_seen(text, uuid) to authenticated;
