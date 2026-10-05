-- An order reaches the database in one trip (the developer's report, 2026-10-04).
--
-- "Every time I add an order it has to load and wait for the server before I can add
-- another." Putting one dish on an order slip was about seventeen trips from the tablet,
-- one after another, with the menu locked until the last came back: read the slip, write
-- the line, read the dish's recipe, one trip per ingredient, then read every slip again.
--
-- The tablet now shows the dish at once and hands over what was tapped together. One
-- function does the work of all those trips, in one transaction:
--
--   * a stay's slip is opened by its first order, and a paid one is never opened again;
--   * the same dish is one row with a count (the staff's rule), decided here with the
--     slip locked — two tablets tapping the same dish can no longer both read `1` and
--     both write `2`;
--   * every serving takes the dish's recipe off the shelf, and a row taken off the slip
--     puts back whatever it took.
--
-- Both functions run as the caller: they can do nothing the tablet could not already do
-- to these tables itself. Every statement is safe to run again.

-- 1. The changes to one order slip, together ------------------------------------
-- `p_changes` is a list of `{line_id, menu_item_id, description, unit_price, delta, remove}`.
-- `line_id` for a row not on the slip yet is made on the tablet, so the row it is already
-- showing and the row saved here are the same row.
CREATE OR REPLACE FUNCTION public.apply_order_changes(
    p_tab_id uuid,
    p_changes jsonb,
    p_booking_id text DEFAULT NULL,
    p_label text DEFAULT NULL,
    p_moved_by text DEFAULT NULL
)
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
    raise exception 'That order slip is already paid.';
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
           coalesce((e.item ->> 'remove')::boolean, false)           as remove
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
      insert into tab_lines (id, tab_id, description, qty, unit_price, amount, kind, menu_item_id, created_by, created_at)
      values (v_id, v_tab.id, c.description, c.delta, c.unit_price, round(c.delta * c.unit_price, 2),
              'charge', c.menu_item_id, v_by, clock_timestamp())
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
      -- The count the kitchen has already been given never stays above what is left.
      update tab_lines
         set qty = qty + c.delta,
             amount = round((qty + c.delta) * unit_price, 2),
             sent_qty = least(sent_qty, qty + c.delta)
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

-- 2. The kitchen's copy was printed ----------------------------------------------
-- One trip for the whole slip instead of one per row. `p_lines` is `[{id, qty}]` as they
-- stood on the printed paper: a dish another tablet added after the print stays new.
CREATE OR REPLACE FUNCTION public.mark_order_lines_sent(p_lines jsonb)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  update tab_lines l
     set sent_qty = least(l.qty, x.qty)
    from jsonb_to_recordset(p_lines) as x(id uuid, qty numeric)
   where l.id = x.id
     and l.sent_qty < least(l.qty, x.qty);
$function$;

-- 3. Finding a row's stock movements ---------------------------------------------
-- Taking a row off a slip looks its movements up by the row that caused them. Without
-- this the whole movement log was read each time, and the log only grows.
CREATE INDEX IF NOT EXISTS stock_movements_source_idx
    ON public.stock_movements (source, source_id)
    WHERE source IS NOT NULL;
