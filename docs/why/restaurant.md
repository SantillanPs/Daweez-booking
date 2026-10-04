# Restaurant and bar — why it works this way

## Order slips

How the staff work without the system: **they write an order on a paper order slip and give it to the kitchen** (Sebastian, 2026-10-04). Their feedback the same day shaped everything below.

- **It is called an order slip, not a tab**, because that is the paper the staff already use.
- **Every order slip has a number (OS no.).** The app gives it, counting up and never restarting.
- **The app prints the slip for the kitchen.** When more is ordered on the same slip later, the print marks what is new.
- **Bill out, not a guest copy.** The owner did not want a "Guest copy" button and a "Receive at the front desk" button on every slip (Sebastian, 2026-10-04): a restaurant prints the bill when the guest has finished or asks for it. Bill out prints the bill. A walk-in then pays at the counter; a room guest's slip goes to the front desk and waits on their booking. Bill out waits until the kitchen has every order.
- **A slip stays open until it is paid (a room guest's until it is billed out); the next order after that starts a new slip.** The staff's complaint: the restaurant went on showing a room's items after they had been paid.
- **The same dish twice is `2 ×` on one row**, not a second row.

## Who can be charged

- **Anyone can have an order slip**, including diners with no room. The owner said walk-in diners are most of the restaurant's trade.
- **A room guest's food goes on their room.** It can be paid before check-out, and the money is always taken at the front desk, from the booking (Sebastian, 2026-10-04). What is still unpaid at check-out is paid with the stay.
- **A walk-in diner pays at the counter.** They pay the whole slip — nothing is typed and nothing is part-paid — and the receipt prints at once because they are standing there.
- **A room guest can only order once checked in.** People order when they are physically in the hotel, never over the phone.

## The till screen

Laid out in the order the counter works (the owner picked this from three drawings):

1. **A strip across the top** — everyone who can be charged: diners first, then every guest in the hotel, each with what they owe so far. No search box for guests; the search belongs to the menu.
2. **The bill on the left.**
3. **The menu on the right.**

- **Orders are taken on the Restaurant screen, for both kinds of guest.** A menu squeezed into the booking panel was the wrong place; the booking's panel only lists the order slips and hands staff over.
- **A room guest's balance is updated the moment food is ordered** (since 2026-10-03), so "Who owes" is right without opening the booking.

## The menu

- **Orders are tapped, never typed.** A hand-written line hides behind "+ Something not on the menu" for the rare dish the menu lacks.
- **It looks like the hotel's printed menu card:** *"Make it look more like a normal physical menu."* One scroll, no category buttons, name · dotted line · price, two columns.
- **Staff hold the tablet in front of the guest**, so every dish is a tall row and the whole row is tappable. A dish already on the order slip shows its count.
- **A "Find a dish" box sits above the card** because hunting one of 61 dishes is slow with a guest waiting.
- The menu lives in the database (61 items, 15 groups, typed from the laminated card) so every tablet shows the same prices. A dish is retired, never deleted, so old orders still read correctly.
- It is a staff tool. Nobody hands the tablet to a diner.

## Mistakes

- **A wrong line is simply removed**, the same way a wrong payment is. The first plan was a "correction" line; the owner changed it so there is one money rule, not two. The only thing changed on a line is its count.

## Paper

- **The kitchen's copy** carries the slip's number, where the food goes, and each dish with its count. No prices.
- **The bill** prints on the 58 mm roll with the prices, stamped **NOT A RECEIPT**, because no money has been received. A room guest's earlier slips can still be shown and printed from the booking panel.
- A walk-in's paid order slip prints a numbered receipt.

## In the reports

- Food and bar is its own line in the Earnings Report, counted on the day each order was placed, so a lunch never reads as a room earning more.

## Why food is kept apart from the booking record

Food lines live in their own tables, never on the booking. Saving a small food line through the booking would blank other booking fields.
