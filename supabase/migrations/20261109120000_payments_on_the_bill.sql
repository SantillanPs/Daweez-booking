-- PAYMENTS HAVE THEIR OWN PLACE (Sebastian, 2026-11-09: "how about we just have payments its own place?
-- amount due doesn't need any attention since it's just bill total - payment total").
--
-- A payment belongs to the BILL, not to a room: `bill_id` is the rooms' shared `group_id`, or the booking's
-- own id for a one-room bill. Kept on the bill's first room (2026-11-07), cancelling or deleting that room
-- took every receipt of the bill with it, out of the bill and out of Today's money.
--
-- The app still sends a booking's payments with the booking (`update_booking` / `book_booking`); this
-- trigger files them here and leaves the booking's own column empty, so every save path — and a screen
-- still on an older version — keeps working. A payment is only ever added or changed that way; taking one
-- back is `remove_payment`, which marks it removed and keeps the row (a save from a stale screen cannot
-- bring it back, since a save never touches `removed_at`).

create table if not exists public.payments (
  id text primary key,
  bill_id text not null,
  receipt_number text,
  amount numeric not null default 0,
  method text,
  reference text,
  paid_at timestamptz,
  prepared_by text,
  purpose text,
  slips text[],
  by_hand boolean,
  discount numeric,
  fixes jsonb,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
create index if not exists payments_bill_id on public.payments (bill_id);
create index if not exists payments_receipt_number on public.payments (receipt_number);

alter table public.payments enable row level security;
drop policy if exists "read payments" on public.payments;
create policy "read payments" on public.payments for select using (true);

-- Every payment already on a booking, filed under its bill once (a receipt sat on several rooms of a
-- bill before 2026-11-07, so one copy per receipt number, the live room's first), with the trigger off
-- so clearing the column files nothing twice.
drop trigger if exists bookings_file_payments on public.bookings;
insert into public.payments (id, bill_id, receipt_number, amount, method, reference, paid_at, prepared_by, purpose, slips, by_hand, discount, fixes)
select distinct on (coalesce(b.group_id, b.id), coalesce(e->>'receipt_number', e->>'id'))
       e->>'id', coalesce(b.group_id, b.id), e->>'receipt_number', coalesce((e->>'amount')::numeric, 0), e->>'method',
       e->>'reference', (e->>'paid_at')::timestamptz, e->>'prepared_by', e->>'purpose',
       case when jsonb_typeof(e->'slips') = 'array' then array(select jsonb_array_elements_text(e->'slips')) end,
       (e->>'by_hand')::boolean, (e->>'discount')::numeric, case when jsonb_typeof(e->'fixes') = 'array' then e->'fixes' end
  from public.bookings b, jsonb_array_elements(case when jsonb_typeof(b.payment_records) = 'array' then b.payment_records else '[]'::jsonb end) e
 where coalesce(e->>'id', '') <> ''
 order by coalesce(b.group_id, b.id), coalesce(e->>'receipt_number', e->>'id'), (b.status = 'cancelled'), b.created_at
on conflict (id) do nothing;

update public.bookings set payment_records = '[]'::jsonb
 where jsonb_typeof(payment_records) = 'array' and payment_records <> '[]'::jsonb;

-- One booking's payments filed under its bill. Never touches `removed_at`.
create or replace function public.file_booking_payments()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if jsonb_typeof(new.payment_records) = 'array' and new.payment_records <> '[]'::jsonb then
    insert into public.payments as p (id, bill_id, receipt_number, amount, method, reference, paid_at, prepared_by, purpose, slips, by_hand, discount, fixes)
    select e->>'id', coalesce(new.group_id, new.id), e->>'receipt_number', coalesce((e->>'amount')::numeric, 0), e->>'method',
           e->>'reference', (e->>'paid_at')::timestamptz, e->>'prepared_by', e->>'purpose',
           case when jsonb_typeof(e->'slips') = 'array' then array(select jsonb_array_elements_text(e->'slips')) end,
           (e->>'by_hand')::boolean, (e->>'discount')::numeric, case when jsonb_typeof(e->'fixes') = 'array' then e->'fixes' end
      from jsonb_array_elements(new.payment_records) e
     where coalesce(e->>'id', '') <> ''
    on conflict (id) do update set
      receipt_number = excluded.receipt_number, amount = excluded.amount, method = excluded.method,
      reference = excluded.reference, paid_at = excluded.paid_at, prepared_by = excluded.prepared_by,
      purpose = excluded.purpose, slips = excluded.slips, by_hand = excluded.by_hand,
      discount = excluded.discount, fixes = excluded.fixes;
  end if;
  new.payment_records := '[]'::jsonb;
  return new;
end $$;

drop trigger if exists bookings_file_payments on public.bookings;
create trigger bookings_file_payments before insert or update of payment_records on public.bookings
  for each row execute function public.file_booking_payments();

-- A payment taken back: kept, marked removed (the Front desk's History still lists it from `removed_payments`).
create or replace function public.remove_payment(p_id text)
returns void language sql security definer set search_path to 'public' as $$
  update public.payments set removed_at = now() where id = p_id and removed_at is null;
$$;
grant execute on function public.remove_payment(text) to anon, authenticated;

-- A one-room booking that becomes several rooms takes a group mark: its payments follow it to the bill.
create or replace function public.set_booking_group(p_booking_id text, p_group_id text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare g text := nullif(btrim(coalesce(p_group_id, '')), '');
begin
  update public.bookings set group_id = g where id = p_booking_id;
  if g is not null then
    update public.payments set bill_id = g where bill_id = p_booking_id;
  end if;
end $$;

alter publication supabase_realtime add table public.payments;
