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

## The logbook (Sebastian, 2026-11-12)

- **Two inventories: the kitchen's and the hotel's.**
- The staff keep a logbook: **stock in on the left page, stock out on the right.**
- A stock-in line is the item's name, **the total spent on it, divided by how many** were bought. The unit can change, kilos or pieces.
- Stock out is not settled yet.
- They check how much is left **weekly, or whenever they have time.**
- It needs a phone layout and a desktop layout, so they can do it on either.
- **The same item is bought by the kilo one time and by the piece another.**
- The two books never share an item.
- Stock in is written **later, from the receipt.** Whether the app replaces the paper logbook is the staff's call, once they have tried it.
- A stock-in line keeps **the day it was bought**, nothing more. No price tracking yet: only the total spent and how many.
- Stock in may also go into Today's money as an expense, **as a switch**: if it gets in the way, turning it off takes back every expense it added.
- The check is **not a routine**: whenever they get the chance, they count what is physically there and compare it with what the app says.
- **The check is not its own page:** the amounts in the inventory can be typed over, and that is the check.

## Counting the shelf (Sebastian, 2026-11-11)

- **Both kinds of count:** a whole-shelf count now and then, and a few items at a time in between.
- **Both ways of doing it:** walking the shelves with a phone, or counting on paper and typing it in at the PC.
- **When the count differs, a note is enough** — no list of reasons to pick from; the staff may not know why.
- **Choosing what to count is flexible:** any item, in any order, found however they like.
- **The owner sees the gaps:** what was missing or extra in each count, and what it is worth.
- **Nothing is set in stone once saved.** *"They tend to make mistakes, that's why they get scared to use the system because they might mess everything up. So give them a bit of control and space to make mistakes and allow them to revert changes if they do."*

## Not built yet

Suppliers · a low-stock alert list · used / damaged / lost entries · housekeeping supplies leaving stock.
