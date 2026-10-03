# Stock room — why it works this way

Started 2026-09-30 (board card k71, part 1). It lives under the Housekeeping tab: **Stock room · What a dish uses · Cleaning Checklist**.

## The idea

- **Stock goes down by itself when the till sells something.** The owner: *"the stock should automatically get deducted when someone buys something."*
- **This screen only puts stock in.** He did not want a manual "use stock" button: *"I don't see a reason for this to exist yet."*
- **Every movement is logged** — what, how many, in or out, why, and who. The owner: *"let the system know who logged it."*

## How a sale reaches the shelf

- Each dish has a **recipe**: the stock items it uses and how much. A drink is one line; a cooked dish is four or five.
- A tap at the till writes the dish on the tab and takes its recipe off the shelf. Removing the line puts it back.
- **A dish with no recipe takes nothing off the shelf**, silently. The recipe screen counts those dishes — that count is the only warning.
- A hand-written off-menu line takes nothing either.

## The shelf

- **One unit per item, the small one.** *"Two cases of beer are 48 bottles"* — the app does no case maths.
- **Staff set a price per item**, which lets the shelf show what it is worth.
- **Par level** is where the row turns red — the only colour on the screen that means anything.
- The old flat "Hotel Inventory" list (pillows, soap, towels…) became these stock items; there is one shelf, not two lists.

## Rules that protect the count

- **The log and the count are written together** in one database function, so they cannot disagree.
- **Correcting an item's name or price never touches its count** (fixed 2026-10-03). It used to write back the old count and silently undo sales made in between.

## Not built yet

Suppliers · a low-stock alert list · a physical count screen · used / damaged / lost entries · housekeeping supplies leaving stock.
