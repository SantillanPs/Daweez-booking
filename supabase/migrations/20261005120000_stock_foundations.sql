-- STOCK FOUNDATIONS (board card k71) — three things that had to be true before real stock goes in.
--
-- 1 · `inventory_items.quantity` was an INTEGER. A recipe line may be 0.2 (kg, litre) and a delivery may be 2.5,
--     and both screens take decimals — but Postgres rounds a decimal back to a whole number when it is written
--     to an integer column. So a dish that uses 0.2 kg of rice moved the count by nothing, every time, and the
--     log still said "Out 0.2". The owner's rule is one small unit per item (grams, millilitres) so most items
--     stay whole numbers, but the column must not be the thing that decides that. It is NUMERIC now, like the
--     movements log already was.
--
-- 2 · `apply_stock_movement` and `reverse_stock_movements` existed only in the live database, never in a file
--     (docs/why/database.md). They are saved here exactly as the database holds them, so a database rebuilt from
--     the files has the stock room's two writers. Nothing about how they behave is changed by this file.
--
-- 3 · The 18 hotel supplies the first inventory migration seeded carry the category `room`, which is not one of
--     the groups the stock room offers (Food · Drinks · Linen · Toiletries · Other), so they could not be found
--     by group. They are moved into the group each one belongs in. A one-off repair of data, matched by name and
--     by the old `room` category so an item the staff have already regrouped is left alone.
--
-- Every statement is safe to run again.

-- 1. The on-hand figure may be a fraction ------------------------------------------
ALTER TABLE public.inventory_items
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

-- 2. The two stock writers, as the database holds them -------------------------------
CREATE OR REPLACE FUNCTION public.apply_stock_movement(p_item_id text, p_direction text, p_quantity numeric, p_reason text, p_moved_by text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_source text DEFAULT NULL::text, p_source_id text DEFAULT NULL::text)
 RETURNS stock_movements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m stock_movements;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'STOCK_QUANTITY: the quantity must be more than zero.';
  end if;
  if p_direction not in ('in', 'out') then
    raise exception 'STOCK_DIRECTION: the direction must be in or out.';
  end if;

  insert into stock_movements (id, item_id, direction, quantity, reason, moved_by, note, source, source_id)
  values (
    gen_random_uuid()::text, p_item_id, p_direction, p_quantity, p_reason,
    nullif(btrim(coalesce(p_moved_by, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    nullif(btrim(coalesce(p_source, '')), ''),
    nullif(btrim(coalesce(p_source_id, '')), '')
  )
  returning * into m;

  update inventory_items
     set quantity = greatest(0, coalesce(quantity, 0) + case when p_direction = 'in' then p_quantity else -p_quantity end)
   where id = p_item_id;
  return m;
end $function$;

CREATE OR REPLACE FUNCTION public.reverse_stock_movements(p_source text, p_source_id text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n integer := 0;
  r record;
begin
  for r in select * from stock_movements where source = p_source and source_id = p_source_id loop
    update inventory_items
       set quantity = greatest(0, coalesce(quantity, 0) + case when r.direction = 'in' then -r.quantity else r.quantity end)
     where id = r.item_id;
    delete from stock_movements where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $function$;

-- 3. The seeded hotel supplies go into the groups the stock room offers --------------
UPDATE public.inventory_items SET category = 'Linen'
 WHERE category = 'room'
   AND name IN ('Bed sheet', 'Blanket', 'Curtains', 'Foam', 'Pillow', 'Pillow case', 'Towel');

UPDATE public.inventory_items SET category = 'Toiletries'
 WHERE category = 'room'
   AND name IN ('Soap', 'Tissue', 'Toothbrush', 'Toothpaste', 'Slippers');

UPDATE public.inventory_items SET category = 'Other'
 WHERE category = 'room'
   AND name IN ('Hanger', 'Mirror', 'Remote', 'Trash can', 'TV', 'Wall clock');
