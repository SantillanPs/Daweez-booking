# The Kanban Board

A copy of every card on the project board, taken on **30 September 2026**. The board itself is the working copy; this is the readable record, so a card can be read without opening the app.

**31 cards: 17 to do · 0 in progress · 0 in review · 14 done.**

| | Cards |
|---|---|
| **To do — with their full notes and comments** | [kanban-open.md](kanban-open.md) |
| **Done — with their notes** | [kanban-done.md](kanban-done.md) |

## To do (17)

| Card | Priority | Label | Task |
|---|---|---|---|
| k74 | high | New Feature | Know who did it — staff names and PINs |
| k71 | high | New Feature | Inventory system — food, drinks and hotel supplies |
| k93 | high | Feedback | Bookings with no check-out date — the app forces one the paper log never needed |
| k120 | high | bug | Receipt prints the receipt, not the booking behind it |
| k124 | high | bug | "Prepared by" on the bill and the receipt |
| k148 | high | New Feature | Vacation House: ₱2,000 reservation + ₱2,000 safety deposit |
| k72 | medium | New Feature | Housekeeping room board — cleaning status and notes |
| k75 | medium | New Feature | Navigation: group the tabs into the four parts (Option B) |
| k73 | medium | New Feature | Money and performance view for the whole hotel |
| k91 | medium | Feedback | Block dates from the calendar toolbar — and show the reason on the calendar |
| k105 | medium | New Feature | A screen to edit the restaurant menu and prices |
| k109 | medium | New Feature | Cooking choices on a dish (buttered / sinagang / tinola) |
| k146 | medium | New Feature | Email the bill and the receipt, from your Gmail |
| k150 | medium | New Feature | A photo of the payment, with the reference read from it |
| k152 | medium | New Feature | Tables as pills — several per tab, edited in Settings |
| k107 | low | New Feature | Photos of the dishes on the menu tiles |
| k156 | low | New Feature | Airbnb / Booking.com / Agoda — parked last |

## Done (14)

| Card | Priority | Label | Task |
|---|---|---|---|
| k128 | high | New Feature | One price — stop calling it a promo |
| k70 | high | New Feature | Restaurant / Bar system — orders and charge to room |
| k69 | high | New Feature | Guest tab — charge anything to the room |
| k126 | high | New Feature | One booking form — no steps, no price summary |
| k140 | high | New Feature | Breakfast folded into the room rate |
| k130 | high | New Feature | Deposit: half by default, typable |
| k122 | high | bug | The booking charges the price it shows |
| k138 | medium | New Feature | Add-ons behind a More button, suited to the room or venue |
| k144 | medium | New Feature | Guest bill on A5 |
| k136 | medium | New Feature | The receptionist's name remembers itself |
| k142 | medium | New Feature | Breakfast folded into the room line on the bill |
| k134 | medium | New Feature | Open the new booking in the quick view after the bill |
| k132 | medium | New Feature | The guest chooses how they pay, not the staff |
| k154 | medium | New Feature | The calendar starts at today |

## How this copy was made

Every card was read from the board with `kanban_get_card`, one at a time, and copied without re-wording. The board stays the authority: if a card changes there, this copy is out of date until it is taken again.

**Two of the open cards are already built in code and only wait on the owner's own test** — k120 (the print went to the wrong paper) and k124 (the receptionist's name was being wiped after it saved, along with ten other columns). Both say so in their notes.
