-- The inventory logbook (Sebastian, 2026-11-12; docs/why/stock.md, "The logbook").
--
-- Two books, the kitchen's and the hotel's, which never share an item. A stock-in line is
-- copied from the receipt later: the item, the total spent, how many (kilos or pieces) and
-- the day it was bought. The amounts in the inventory can be typed over, and that is the
-- check. Every save can be fixed or taken back.
--
-- Applied to development on 2026-11-14. Not on live.

-- ── Items: which book, kilos or pieces, when last checked ─────────────────────────────

alter table public.inventory_items
  add column if not exists book text not null default 'kitchen',
  add column if not exists checked_at timestamptz;

alter table public.inventory_items drop constraint if exists inventory_items_book_check;
alter table public.inventory_items add constraint inventory_items_book_check check (book in ('kitchen', 'hotel'));

-- The old shelf was one list; its kitchen rows go to the kitchen's book, the rest to the hotel's.
update public.inventory_items
   set book = case when category in ('Kitchen', 'Food', 'Drinks') then 'kitchen' else 'hotel' end;

-- The staff count in kilos or pieces, nothing else ("the metric should be changeable from
-- kilos to pieces"). A bottle, a roll, a pair or a set is one piece. Liquids were in litres;
-- they become pieces (a bottle), so their count should be checked once.
update public.inventory_items
   set unit = case when lower(coalesce(unit, '')) in ('kg', 'kilo', 'kilos') then 'kg' else 'pcs' end;

-- ── Stock in: one row per receipt line ────────────────────────────────────────────────

create table if not exists public.stock_in (
  id text primary key default gen_random_uuid()::text,
  book text not null check (book in ('kitchen', 'hotel')),
  item_id text not null references public.inventory_items(id),
  bought_on date not null,
  total numeric not null check (total > 0),
  amount numeric not null check (amount > 0),
  unit text not null check (unit in ('kg', 'pcs')),
  -- Whether it went onto the item's count. Bought in the other unit (chicken counted in
  -- kilos, bought by the piece), it is logged with its money and the count stays as it is
  -- until someone types it over; nothing asks them to (Sebastian, 2026-11-12).
  counted boolean not null default false,
  -- The expense it put in Today's money while the switch is on.
  expense_id text,
  -- Its expense was taken back by turning the switch off; turning it on puts it back.
  expense_taken boolean not null default false,
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists stock_in_book_day on public.stock_in (book, bought_on desc);

alter table public.stock_in enable row level security;
drop policy if exists "read stock_in" on public.stock_in;
create policy "read stock_in" on public.stock_in for select using (true);
grant select on public.stock_in to anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'stock_in') then
    alter publication supabase_realtime add table public.stock_in;
  end if;
end $$;

-- ── The switch: stock in also goes to Today's money ───────────────────────────────────

create or replace function public.set_app_setting(p_key text, p_value jsonb)
 returns void language plpgsql security definer set search_path to 'public' as $$
begin
    if p_key is null or p_key not in ('rate_config', 'payment_accounts', 'channel_sync', 'front_desk', 'stock_in') then
        raise exception 'UNKNOWN_SETTING: %', coalesce(p_key, '(null)');
    end if;
    insert into public.app_settings (key, value, updated_at)
    values (p_key, p_value, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

create or replace function public.stock_in_expenses_on()
 returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select (value->>'expenses')::boolean from app_settings where key = 'stock_in'), false)
$$;

-- The expense a stock-in line puts in Today's money, on the day it was bought.
create or replace function public.stock_in_expense(p_line stock_in)
 returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_id text := gen_random_uuid()::text;
  v_name text;
begin
  select name into v_name from inventory_items where id = p_line.item_id;
  insert into expenses (id, category_id, amount, expense_date, notes)
  values (
    v_id,
    (select id from expense_categories
      where name = case when p_line.book = 'kitchen' then 'Resto Expenses' else 'Pension House Expense' end
      limit 1),
    p_line.total,
    p_line.bought_on,
    'Stock in · ' || coalesce(v_name, 'item') || ' ' ||
      trim_scale(p_line.amount)::text || ' ' || p_line.unit
  );
  return v_id;
end $$;

-- Turning it off takes back every expense it added; turning it on puts those back.
create or replace function public.set_stock_in_expenses(p_on boolean)
 returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  l stock_in;
  n integer := 0;
begin
  perform set_app_setting('stock_in', jsonb_build_object('expenses', p_on));
  if p_on then
    for l in select * from stock_in where expense_taken and removed_at is null loop
      update stock_in set expense_id = stock_in_expense(l), expense_taken = false where id = l.id;
      n := n + 1;
    end loop;
  else
    for l in select * from stock_in where expense_id is not null and removed_at is null loop
      delete from expenses where id = l.expense_id;
      update stock_in set expense_id = null, expense_taken = true where id = l.id;
      n := n + 1;
    end loop;
  end if;
  return n;
end $$;

-- ── Writing a line onto the count, and taking it off ─────────────────────────────────

create or replace function public.stock_in_apply(p_id text, p_sign integer)
 returns void language plpgsql security definer set search_path to 'public' as $$
declare
  l stock_in;
begin
  select * into l from stock_in where id = p_id;
  if p_sign > 0 then
    if (select unit from inventory_items where id = l.item_id) = l.unit then
      perform apply_stock_movement(l.item_id, 'in', l.amount, 'Stock in', null, null, 'stock_in', l.id);
      update stock_in set counted = true where id = l.id;
    else
      update stock_in set counted = false where id = l.id;
    end if;
  elsif l.counted then
    perform apply_stock_movement(l.item_id, 'out', l.amount, 'Stock in taken back', null, null, 'stock_in', l.id);
    update stock_in set counted = false where id = l.id;
  end if;
end $$;

-- A receipt: every line written together. An item not in the book yet is added to it,
-- counted in the unit it was bought in.
create or replace function public.write_stock_in(p_book text, p_bought_on date, p_lines jsonb)
 returns setof stock_in language plpgsql security definer set search_path to 'public' as $$
declare
  j jsonb;
  v_item text;
  v_name text;
  v_id text;
  l stock_in;
begin
  if p_book not in ('kitchen', 'hotel') then raise exception 'STOCK_BOOK: kitchen or hotel.'; end if;
  if p_bought_on is null then raise exception 'STOCK_DAY: the day it was bought is needed.'; end if;
  for j in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_name := btrim(coalesce(j->>'item', ''));
    if v_name = '' then raise exception 'STOCK_ITEM: an item needs a name.'; end if;
    select id into v_item from inventory_items
     where book = p_book and active and lower(name) = lower(v_name)
     order by created_at limit 1;
    if v_item is null then
      v_item := gen_random_uuid()::text;
      insert into inventory_items (id, name, category, quantity, unit, book, active)
      values (v_item, v_name, case when p_book = 'kitchen' then 'Food' else 'Other' end, 0, j->>'unit', p_book, true);
    end if;
    insert into stock_in (book, item_id, bought_on, total, amount, unit)
    values (p_book, v_item, p_bought_on, (j->>'total')::numeric, (j->>'amount')::numeric, j->>'unit')
    returning id into v_id;
    perform stock_in_apply(v_id, 1);
    if stock_in_expenses_on() then
      select * into l from stock_in where id = v_id;
      update stock_in set expense_id = stock_in_expense(l) where id = v_id;
    end if;
    return query select * from stock_in where id = v_id;
  end loop;
end $$;

-- Taken out of the log: off the count and out of Today's money. Never deleted.
create or replace function public.remove_stock_in(p_id text)
 returns void language plpgsql security definer set search_path to 'public' as $$
declare
  l stock_in;
begin
  select * into l from stock_in where id = p_id for update;
  if l.id is null or l.removed_at is not null then return; end if;
  perform stock_in_apply(l.id, -1);
  if l.expense_id is not null then delete from expenses where id = l.expense_id; end if;
  update stock_in set removed_at = now(), expense_id = null, expense_taken = false where id = l.id;
end $$;

-- Undo of a removal: back on the count and, while the switch is on, back in Today's money.
create or replace function public.restore_stock_in(p_id text)
 returns void language plpgsql security definer set search_path to 'public' as $$
declare
  l stock_in;
begin
  select * into l from stock_in where id = p_id for update;
  if l.id is null or l.removed_at is null then return; end if;
  update stock_in set removed_at = null where id = l.id;
  perform stock_in_apply(l.id, 1);
  if stock_in_expenses_on() then
    select * into l from stock_in where id = p_id;
    update stock_in set expense_id = stock_in_expense(l) where id = l.id;
  end if;
end $$;

-- A line fixed from the receipt: the count and its expense follow.
create or replace function public.fix_stock_in(p_id text, p_total numeric, p_amount numeric, p_unit text, p_bought_on date)
 returns stock_in language plpgsql security definer set search_path to 'public' as $$
declare
  l stock_in;
  v_name text;
begin
  select * into l from stock_in where id = p_id for update;
  if l.id is null or l.removed_at is not null then raise exception 'STOCK_IN_GONE: that line was taken out.'; end if;
  perform stock_in_apply(l.id, -1);
  update stock_in set total = p_total, amount = p_amount, unit = p_unit, bought_on = p_bought_on where id = l.id;
  perform stock_in_apply(l.id, 1);
  select * into l from stock_in where id = p_id;
  if l.expense_id is not null then
    select name into v_name from inventory_items where id = l.item_id;
    update expenses
       set amount = l.total, expense_date = l.bought_on,
           notes = 'Stock in · ' || coalesce(v_name, 'item') || ' ' ||
             trim_scale(l.amount)::text || ' ' || l.unit
     where id = l.expense_id;
  end if;
  return l;
end $$;

-- ── The check: an amount typed over ───────────────────────────────────────────────────

-- Sets what is there now, in the unit given, and logs the difference as a count. A count
-- in another unit (or after buying in the other unit) logs no difference: it is not a loss.
-- Undo sends the old amount, unit and checked time back.
create or replace function public.set_stock_count(
  p_item_id text, p_quantity numeric, p_unit text, p_checked_at timestamptz default now()
) returns text language plpgsql security definer set search_path to 'public' as $$
declare
  i inventory_items;
  v_diff numeric;
  v_id text;
begin
  if p_quantity is null or p_quantity < 0 then raise exception 'STOCK_QUANTITY: zero or more.'; end if;
  if p_unit not in ('kg', 'pcs') then raise exception 'STOCK_UNIT: kg or pcs.'; end if;
  select * into i from inventory_items where id = p_item_id for update;
  if i.id is null then raise exception 'STOCK_ITEM: no such item.'; end if;
  v_diff := p_quantity - coalesce(i.quantity, 0);
  if i.unit = p_unit and v_diff <> 0 then
    v_id := gen_random_uuid()::text;
    insert into stock_movements (id, item_id, direction, quantity, reason, source)
    values (v_id, i.id, case when v_diff > 0 then 'in' else 'out' end, abs(v_diff), 'Counted', 'count');
  end if;
  update inventory_items set quantity = p_quantity, unit = p_unit, checked_at = p_checked_at where id = i.id;
  return v_id;
end $$;

-- The note on a count that came out different. "Don't know" is fine: it may stay blank.
create or replace function public.set_count_note(p_movement_id text, p_note text)
 returns void language sql security definer set search_path to 'public' as $$
  update stock_movements set note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_movement_id and source = 'count'
$$;

grant execute on function public.write_stock_in(text, date, jsonb), public.remove_stock_in(text),
  public.restore_stock_in(text), public.fix_stock_in(text, numeric, numeric, text, date),
  public.set_stock_count(text, numeric, text, timestamptz), public.set_count_note(text, text),
  public.set_stock_in_expenses(boolean), public.stock_in_expenses_on() to anon, authenticated;
revoke execute on function public.stock_in_apply(text, integer), public.stock_in_expense(stock_in) from anon, authenticated, public;
