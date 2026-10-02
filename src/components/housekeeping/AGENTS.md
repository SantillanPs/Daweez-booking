# The Stock Room (src/components/housekeeping) AGENTS.md

## Purpose

The stock room's screens: the shelf itself, receiving stock, the movements log, and the recipes that let a sale take its own ingredients off the shelf. Board card **k71, part 1** — the owner's ruling, 2026-09-30: **"go"**.

## Ownership

- Primary Owner: Frontend Engineers / Antigravity Agent
- Scope: `src/components/housekeeping/**`, plus [utils/stock.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/utils/stock.ts) (the data layer) and the `stock_movements` / `menu_item_stock` tables.
- Parent: [components/AGENTS.md](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/components/AGENTS.md) — the Housekeeping tab that renders these.

## Local Contracts

  - [StockRoom.tsx](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/components/housekeeping/StockRoom.tsx) — **the shelf**, in the shape the owner approved from a one-screen drawing: one row for each item with its unit, what is on hand, its **par level**, its price and what that much is worth, with the **shelf worth** and the count below par in the header. The par column is red when the quantity is under the line — **the only colour on the screen that means anything**. There is **no “Use stock” button** (the owner, 2026-09-30: *"the stock should automatically get deducted when someone buys something"*, and on the manual movement he did not want: *"I don't see a reason for this to exist yet"*) — so the screen's own words are *"Stock goes down by itself when the till sells something. This screen only puts stock in."* `Receive` sits on each row; `Movements` swaps the list for the log; the item's name opens its editor.

  - [ReceiveStockForm.tsx](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/components/housekeeping/ReceiveStockForm.tsx) — **the only movement a person types.** How many arrived, who received them, an optional note, and **what the count becomes before it is recorded** — a stock figure nobody can check is a figure nobody trusts. `Received by` is the owner's answer to *"let the system know who logged it"*.

  - [StockItemForm.tsx](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/components/housekeeping/StockItemForm.tsx) — adds an item or corrects one: **name, unit, group, price, par level**. The owner's four answers live here — **one unit, the small one** (*"two cases of beer are 48 bottles"*, so the app does no case maths), **a price the staff set** (which is what lets the shelf show what it is worth), and the par level that turns a row red.

  - [StockMovementsLog.tsx](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/components/housekeeping/StockMovementsLog.tsx) — **the log that makes the rest possible**: when, item, in or out, how many, why, who. One sale writes several lines, one per ingredient. Filters by name, person or note, and by reason. The owner's own verdict on the drawn version: *"I like this."*

  - [DishStockEditor.tsx](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/components/housekeeping/DishStockEditor.tsx) — **what a dish uses** — the recipe, and the piece the owner called *"the important part"*. Pick a dish, add its stock lines, save once; a drink is one line and a cooked dish four or five. The header counts the dishes that have **no lines yet**, because **a dish with no recipe deducts nothing** and that count is the only warning the desk gets.

  - [useStockRoom.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/components/housekeeping/useStockRoom.ts) — the one place the three lists are read (items, movements, recipes) and the one place they are written. Every write reloads, because a movement changes both the log and the on-hand figure and the desk must see the new count at once. The first read sets its state **in callbacks, never in the effect body** — a synchronous `setState` in an effect cascades renders, and that is what the hooks lint asks about.

## Work Guidance

- **The log and the count are written together, and that is the whole design.** `utils/stock.ts` calls one database function (`apply_stock_movement`) that inserts the movement **and** moves `inventory_items.quantity` in the same statement, so the shelf and its explanation can never disagree. Never write one without the other.
- **A sale takes its dish's stock, and removing the line puts it back.** The till's tap goes through `useTabOrder.pickItem`, which now writes the **menu item's id** on the line (`tab_lines.menu_item_id`) and then deducts; removing the line reverses every movement it caused (`reverse_stock_movements`). That id column is what the code trace found missing (2026-09-30): the line used to keep only the dish's **name** and **price**, so nothing could point at a dish — and a dish is what points at the ingredients.
- **A dish with no recipe deducts nothing, and that is silent by design.** The editor counts them; nothing else warns. A written off-menu line deducts nothing either, and correctly so.
- **The furniture**: this folder exists because the stock room outgrew one card in `HousekeepingTab`. The tab itself keeps the nav and the cleaning checklist; everything about stock lives here.

## Verification

- `npx tsc -b --force` and `npm run lint` (see the root `AGENTS.md`).
- The two database functions were proved end to end on a real item: an `in` movement raised the count, `reverse_stock_movements` took it back, and no line was left behind.

## Child DOX Index

None.
