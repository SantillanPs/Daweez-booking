-- A charge on an order slip (Sebastian, 2026-11-03, notes #20): corkage, a take-out box,
-- a broken glass. A label and a price, written on the slip's "+ Charge" line.
--
-- It is not food, so it never goes to the kitchen: it is written already given, cooked and
-- served, and stays that way whatever its count. That keeps it off the kitchen's list
-- (`kitchen_queue` wants sent_qty > ready_qty), out of "To send", and lets "Send bill" go.

alter table public.tab_lines add column if not exists other_charge boolean not null default false;

-- Rebuilt from the definition the database holds (pg_get_functiondef), with `other` read
-- from each change.
CREATE OR REPLACE FUNCTION public.apply_order_changes(p_tab_id uuid, p_changes jsonb, p_booking_id text DEFAULT NULL::text, p_label text DEFAULT NULL::text, p_moved_by text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_tab tabs;
  v_line tab_lines;
  v_found boolean;
  v_booking text;
  v_id uuid;
  v_delta numeric;
  v_by text := nullif(btrim(coalesce(p_moved_by, '')), '');
  v_stock_problem boolean := false;
  c record;
  r record;
begin
  if p_tab_id is null then
    raise exception 'No order slip was named.';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'The order was not a list of changes.';
  end if;

  -- The slip is locked first, so two tablets changing the same slip take turns.
  select * into v_tab from tabs where id = p_tab_id for update;
  v_found := found;
  v_booking := coalesce(v_tab.booking_id, p_booking_id);

  if v_found and v_tab.status = 'open' then
    null;
  elsif v_booking is not null then
    -- A stay's slip is opened by its first order, and the next order after a paid slip
    -- starts a new one. Another tablet may have opened it a moment ago: then that one is used.
    insert into tabs (id, booking_id, label, status, opened_by)
    values (
      case when v_found then gen_random_uuid() else p_tab_id end,
      v_booking,
      coalesce(nullif(btrim(coalesce(p_label, '')), ''), v_tab.label),
      'open',
      v_by
    )
    on conflict (booking_id) where ((status = 'open'::text) and (booking_id is not null)) do nothing;
    select * into v_tab from tabs where booking_id = v_booking and status = 'open' for update;
  elsif v_found then
    raise exception 'That order slip is closed: its bill is at the front desk.';
  else
    raise exception 'That order slip is not there any more.';
  end if;

  -- Every shelf item this order touches is locked in one fixed order, so two slips
  -- selling the same ingredients take turns instead of each waiting on the other.
  perform 1
     from inventory_items i
    where i.id in (
            select s.item_id from menu_item_stock s
             where s.menu_item_id in (select e.item ->> 'menu_item_id' from jsonb_array_elements(p_changes) as e(item))
            union
            select m.item_id from stock_movements m
             where m.source = 'tab_line'
               and m.source_id in (select e.item ->> 'line_id' from jsonb_array_elements(p_changes) as e(item))
          )
    order by i.id
      for update;

  for c in
    select nullif(e.item ->> 'line_id', '')::uuid                    as line_id,
           nullif(e.item ->> 'menu_item_id', '')                     as menu_item_id,
           btrim(coalesce(e.item ->> 'description', ''))             as description,
           round(coalesce((e.item ->> 'unit_price')::numeric, 0), 2) as unit_price,
           coalesce((e.item ->> 'delta')::numeric, 0)                as delta,
           coalesce((e.item ->> 'remove')::boolean, false)           as remove,
           coalesce((e.item ->> 'other')::boolean, false)            as other
      from jsonb_array_elements(p_changes) with ordinality as e(item, ord)
     order by e.ord
  loop
    -- The row is looked for by its own id, then by its dish: another tablet may have put
    -- the same dish on this slip a moment ago. A changed price is a different row.
    select * into v_line from tab_lines
     where id = c.line_id and tab_id = v_tab.id and kind = 'charge';
    v_found := found;
    if not v_found and c.menu_item_id is not null then
      select * into v_line from tab_lines
       where tab_id = v_tab.id and kind = 'charge'
         and menu_item_id = c.menu_item_id and unit_price = c.unit_price
       order by created_at, id
       limit 1;
      v_found := found;
    end if;

    if not v_found then
      continue when c.remove or c.delta <= 0;
      v_id := c.line_id;
      if v_id is null or exists (select 1 from tab_lines where id = v_id) then
        v_id := gen_random_uuid();
      end if;
      -- The clock, not the transaction's start: rows saved together keep the order they were tapped in.
      -- A charge is written already served: the kitchen never sees it.
      insert into tab_lines (id, tab_id, description, qty, unit_price, amount, kind, menu_item_id, created_by, created_at,
                             other_charge, sent_qty, ready_qty, served_qty)
      values (v_id, v_tab.id, c.description, c.delta, c.unit_price, round(c.delta * c.unit_price, 2),
              'charge', case when c.other then null else c.menu_item_id end, v_by, clock_timestamp(),
              c.other, case when c.other then c.delta else 0 end, case when c.other then c.delta else 0 end,
              case when c.other then c.delta else 0 end)
      returning * into v_line;
      v_delta := c.delta;
    elsif c.remove or v_line.qty + c.delta <= 0 then
      -- The whole row comes off. Its stock goes back first, and a failure there leaves the
      -- row where it is: an order taken off a bill must never leave the shelf short unsaid.
      perform reverse_stock_movements('tab_line', v_line.id::text);
      delete from tab_lines where id = v_line.id;
      continue;
    else
      continue when c.delta = 0;
      -- What the kitchen was given, what it has cooked and what was served never stay above
      -- what is left. A charge keeps all three at its count.
      update tab_lines
         set qty = qty + c.delta,
             amount = round((qty + c.delta) * unit_price, 2),
             sent_qty = case when other_charge then qty + c.delta else least(sent_qty, qty + c.delta) end,
             ready_qty = case when other_charge then qty + c.delta else least(ready_qty, qty + c.delta) end,
             served_qty = case when other_charge then qty + c.delta else least(served_qty, qty + c.delta) end
       where id = v_line.id
      returning * into v_line;
      v_delta := c.delta;
    end if;

    -- The shelf follows the sale. A dish with no recipe moves nothing, and a refused
    -- movement must not lose the order: the row stays on the slip and the tablet is told.
    if v_line.menu_item_id is not null then
      begin
        for r in
          select s.item_id, s.quantity from menu_item_stock s
           where s.menu_item_id = v_line.menu_item_id
           order by s.item_id
        loop
          perform apply_stock_movement(
            r.item_id,
            case when v_delta > 0 then 'out' else 'in' end,
            r.quantity * abs(v_delta),
            case when v_delta > 0 then 'Sold' else 'Order changed' end,
            v_by, null, 'tab_line', v_line.id::text
          );
        end loop;
      exception when others then
        raise warning 'apply_order_changes: the stock did not follow line %: %', v_line.id, sqlerrm;
        v_stock_problem := true;
      end;
    end if;
  end loop;

  -- The slip as it now stands, so the tablet does not have to read it again. Its first
  -- order has just given it its number.
  select * into v_tab from tabs where id = v_tab.id;
  return jsonb_build_object(
    'tab', to_jsonb(v_tab),
    'lines', coalesce(
      (select jsonb_agg(to_jsonb(l) order by l.created_at, l.id) from tab_lines l where l.tab_id = v_tab.id),
      '[]'::jsonb
    ),
    'stock_problem', v_stock_problem
  );
end $function$;
