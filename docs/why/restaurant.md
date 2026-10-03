# Restaurant and bar — why it works this way

## Who can be charged

- **Anyone can run a tab**, including diners with no room. The owner said walk-in diners are most of the restaurant's trade.
- **A room guest's food goes on their room and is paid with the stay at check-out.** One tab per booking.
- **A walk-in diner pays at the counter.** They settle the whole tab — nothing is typed and nothing is part-paid — and the receipt prints at once because they are standing there.
- **A room guest can only order once checked in.** People order when they are physically in the hotel, never over the phone.

## The till screen

Laid out in the order the counter works (the owner picked this from three drawings):

1. **A strip across the top** — everyone who can be charged: diners first, then every guest in the hotel, each with what they owe so far. No search box for guests; the search belongs to the menu.
2. **The bill on the left.**
3. **The menu on the right.**

- **Orders are taken on the Restaurant screen, for both kinds of guest.** A menu squeezed into the booking panel was the wrong place; the booking's Guest tab only shows the food and hands staff over.
- **A room guest's balance is updated the moment food is ordered** (since 2026-10-03), so "Who owes" is right without opening the booking.

## The menu

- **Orders are tapped, never typed.** A hand-written line hides behind "+ Something not on the menu" for the rare dish the menu lacks.
- **It looks like the hotel's printed menu card:** *"Make it look more like a normal physical menu."* One scroll, no category buttons, name · dotted line · price, two columns.
- **Staff hold the tablet in front of the guest**, so every dish is a tall row and the whole row is tappable. A dish already on the tab shows a count so it is not ordered twice by mistake.
- **A "Find a dish" box sits above the card** because hunting one of 61 dishes is slow with a guest waiting.
- The menu lives in the database (61 items, 15 groups, typed from the laminated card) so every tablet shows the same prices. A dish is retired, never deleted, so old orders still read correctly.
- It is a staff tool. Nobody hands the tablet to a diner.

## Mistakes

- **A wrong line is simply removed**, the same way a wrong payment is. The first plan was a "correction" line; the owner changed it so there is one money rule, not two. Nothing edits a line in place.

## Paper

- **A guest can ask for their running tab mid-stay.** It prints on the 58 mm roll, headed "Running Tab" and stamped **NOT A RECEIPT**, because no money has been received.
- A walk-in's settled tab prints a numbered receipt.

## In the reports

- Food and bar is its own line in the Earnings Report, counted on the day each order was placed, so a lunch never reads as a room earning more.

## Why food is kept apart from the booking record

Food lines live in their own tables, never on the booking. Saving a small food line through the booking would blank other booking fields.
