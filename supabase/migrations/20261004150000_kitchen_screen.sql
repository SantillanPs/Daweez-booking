-- Orders reach the kitchen on a screen, not on paper (Sebastian, 2026-10-04).
--
-- There is always one member of staff at the front desk, one in the kitchen and one in
-- the restaurant or bar, all using the system at once. The only way to give the kitchen
-- an order was the printed kitchen copy, and the only printer is at the front desk — so
-- the staff taking orders walked there and back for every order.
--
-- The staff now tap "Send to kitchen" and the order shows on a screen in the kitchen. The
-- cook taps when a dish is cooked, and the staff tap when it has gone to the table. A line
-- already counted what was ordered (`qty`) and what the kitchen was given (`sent_qty`); it
-- now also counts what is cooked and what is served.
--
-- Every statement is safe to run again.

-- 1. What is cooked, what is served, and when it was sent ------------------------
-- Lines that already exist were cooked and served long ago, so the kitchen's screen
-- starts empty. That is done ONLY when the columns are first added: running this file
-- again must never mark an order the kitchen is cooking right now as cooked.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'tab_lines' AND column_name = 'ready_qty'
    ) THEN
        ALTER TABLE public.tab_lines ADD COLUMN ready_qty numeric DEFAULT 0 NOT NULL;
        ALTER TABLE public.tab_lines ADD COLUMN served_qty numeric DEFAULT 0 NOT NULL;
        UPDATE public.tab_lines SET ready_qty = sent_qty, served_qty = sent_qty;
    END IF;
END $$;
ALTER TABLE public.tab_lines ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- 2. An order is given to the kitchen ---------------------------------------------
-- `p_lines` is `[{id, qty}]` as they stood on the slip when Send was tapped: a dish
-- another tablet added a moment later stays new.
CREATE OR REPLACE FUNCTION public.mark_order_lines_sent(p_lines jsonb)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  update tab_lines l
     set sent_qty = least(l.qty, x.qty),
         -- A line the kitchen is still cooking keeps the time it was first sent, so the
         -- order that has waited longest stays at the front of the kitchen's list.
         sent_at = case when l.sent_qty > l.ready_qty and l.sent_at is not null then l.sent_at else now() end
    from jsonb_to_recordset(p_lines) as x(id uuid, qty numeric)
   where l.id = x.id
     and l.sent_qty < least(l.qty, x.qty);
$function$;

-- 3. The cook has cooked it; the staff have served it -----------------------------
-- Both take `[{id, qty}]` as the screen showed them. What is cooked is never more than
-- what the kitchen was given and never less than what was already served — it can be
-- lowered again, which is how a wrong tap on the kitchen's screen is put back. What is
-- served is never more than what is cooked, and only goes up.
CREATE OR REPLACE FUNCTION public.mark_order_lines_ready(p_lines jsonb)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  update tab_lines l
     set ready_qty = greatest(l.served_qty, least(l.sent_qty, x.qty))
    from jsonb_to_recordset(p_lines) as x(id uuid, qty numeric)
   where l.id = x.id
     and l.ready_qty is distinct from greatest(l.served_qty, least(l.sent_qty, x.qty));
$function$;

CREATE OR REPLACE FUNCTION public.mark_order_lines_served(p_lines jsonb)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  update tab_lines l
     set served_qty = least(l.ready_qty, x.qty)
    from jsonb_to_recordset(p_lines) as x(id uuid, qty numeric)
   where l.id = x.id
     and l.served_qty < least(l.ready_qty, x.qty);
$function$;

-- 4. The kitchen's list ------------------------------------------------------------
-- Every dish the kitchen was given and has not cooked yet, with the slip it belongs to.
-- It does not look at whether the slip is still open: a guest who pays before the food
-- is cooked must still get their food. It reads as the caller, so it shows nothing the
-- tablet could not already read from the two tables.
CREATE OR REPLACE VIEW public.kitchen_queue WITH (security_invoker = true) AS
SELECT l.id, l.tab_id, l.description, l.sent_qty, l.ready_qty, l.sent_at, l.created_at,
       t.os_number, t.label, t.table_label, t.booking_id
  FROM public.tab_lines l
  JOIN public.tabs t ON t.id = l.tab_id
 WHERE l.kind = 'charge'
   AND l.sent_qty > l.ready_qty;
GRANT SELECT ON public.kitchen_queue TO anon, authenticated;

-- Only the few lines still being cooked are in this index, so the kitchen's list never
-- reads through every line the restaurant has ever sold.
CREATE INDEX IF NOT EXISTS tab_lines_kitchen_idx
    ON public.tab_lines (sent_at)
    WHERE sent_qty > ready_qty;

-- 5. A count that goes down takes the kitchen's counts down with it ----------------
-- `apply_order_changes` as the database holds it, with one change: lowering a row's count
-- now also keeps what is cooked and what is served at or below it.
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
      -- What the kitchen was given, what it has cooked and what was served never stay above what is left.
      update tab_lines
         set qty = qty + c.delta,
             amount = round((qty + c.delta) * unit_price, 2),
             sent_qty = least(sent_qty, qty + c.delta),
             ready_qty = least(ready_qty, qty + c.delta),
             served_qty = least(served_qty, qty + c.delta)
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
