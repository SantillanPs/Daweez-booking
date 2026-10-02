-- THE STOCK ROOM, PART 1 (board card k71). The owner's ruling, 2026-09-30: **"go"**.
--
-- His design, in his own words: *"One stock room shared by the kitchen and the hotel: food, drinks, linens,
-- toiletries. Every item in and out is logged with who and when. Recipes are the important part — a dish is made
-- of ingredients, so selling one dish takes its ingredients off the shelf automatically, no manual deducting."*
--
-- And his four answers, which shape every column below: **one unit per item, the small one** (two cases of beer
-- are typed as 48 bottles — the app does no case maths); **a price the staff set on each item**, so the stock
-- room can say what the shelf is worth; **the name of whoever moved the stock**, on every line; and **the stock
-- goes down by itself when the till sells something** — so the only manual movement is stock coming in.
--
-- WHY THE FIRST STATEMENT IS THE MOST IMPORTANT ONE. The code trace (same day) found that a sold line keeps the
-- dish's NAME and PRICE but never its ID. So no sale could point at a menu item, and no sale could point at
-- stock. That one missing column is the whole difference between a stock room that works by itself and one
-- where a person types every movement.

-- 1 · The dish's id on the sold line.
alter table tab_lines add column if not exists menu_item_id text;

-- 2 · The stock items. `inventory_items` is already the hotel's supplies list, so it grows into the stock room
--     rather than standing a second list beside it. `quantity` stays the item's on-hand figure; every movement
--     writes it, and the movement log remains the explanation of how it got there.
alter table inventory_items add column if not exists unit text;
alter table inventory_items add column if not exists price numeric;
alter table inventory_items add column if not exists par_level numeric;
alter table inventory_items add column if not exists active boolean not null default true;

-- 3 · Every movement, in and out, with who and when. `source` says what caused it: a delivery, or the tab line
--     of a sale. `reason` carries NO check constraint on purpose — the owner's standing rule for a value list
--     that may grow (`payment_plan` is the precedent), because a new reason must not need a migration.
create table if not exists stock_movements (
  id text primary key,
  item_id text not null,
  direction text not null check (direction in ('in', 'out')),
  quantity numeric not null check (quantity > 0),
  reason text not null,
  moved_by text,
  note text,
  source text,
  source_id text,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_item_time_idx on stock_movements (item_id, created_at desc);
create index if not exists stock_movements_time_idx on stock_movements (created_at desc);

-- 4 · What a dish uses: the recipe. One row per ingredient, so a drink is one row and a cooked dish is four or
--     five. An item may appear on only one row of a dish.
create table if not exists menu_item_stock (
  id text primary key,
  menu_item_id text not null,
  item_id text not null,
  quantity numeric not null check (quantity > 0)
);
create unique index if not exists menu_item_stock_pair_idx on menu_item_stock (menu_item_id, item_id);

-- 5 · Access: the same public full-access shape the menu, the inventory and the cleaning checklist already use.
--     Stock is configuration, not money, and the dashboard runs on the anon key.
alter table stock_movements enable row level security;
alter table menu_item_stock enable row level security;
drop policy if exists "public all stock_movements" on stock_movements;
create policy "public all stock_movements" on stock_movements for all to public using (true) with check (true);
drop policy if exists "public all menu_item_stock" on menu_item_stock;
create policy "public all menu_item_stock" on menu_item_stock for all to public using (true) with check (true);

-- 6 · Realtime, so a deduction made at the till shows on the other tablet without a refresh.
do $$
begin
  begin
    alter publication supabase_realtime add table stock_movements;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table menu_item_stock;
  exception when duplicate_object then null;
  end;
end $$;
