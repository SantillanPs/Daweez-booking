# The Board · Done (14 cards)

Every closed card, copied from the board on **30 September 2026** — its note, without re-wording. The index is in [kanban.md](kanban.md); the open cards are in [kanban-open.md](kanban-open.md).

The **comments** on these cards are the build log (what shipped, in what order, and what it fixed). They stay on the board; what matters afterwards is written into the `AGENTS.md` files.

---

## k128 · One price — stop calling it a promo
**high · New Feature**

Owner: "Just remove the regular price. there's only 1 price now which is the promo. but let's not call it that. it's the new regular now." And on the promo ON/OFF switch: "remove it".

The promo figure becomes THE price everywhere: no crossed-out regular, no promo badge, no "Use Promo Price" switch, no header toggle. Settings keeps one price per room and one per venue, and the printed bills follow. Retiring the toggle also means `promoMode`/`promo_applied` and the promo columns stop being part of pricing.

---

## k70 · Restaurant / Bar system — orders and charge to room
**high · New Feature**

Menu, tables and orders — a basic POS. Two ways to close an order: charge it to the guest's room (it lands on their tab and is paid at check-out) or pay now at the counter. The bar uses the same screen. Depends on the guest tab, so it comes second.

Built over four passes: the menu typed from the hotel's printed card (61 items in 15 groups) and moved into the database; the screen redesigned to the shape the owner picked — one strip of everyone being served, the bill on the left, **the menu card itself** on the right with no category buttons; then every dish made a 48px tap target; then a **Find a dish** box above the card. Follow-ups still open on their own cards: k105 (edit the menu), k109 (cooking-choice buttons), k152 (tables as pills).

---

## k69 · Guest tab — charge anything to the room
**high · New Feature**

The connection every other system needs: a running tab for the guest's stay. Any part can add a line to it (a restaurant lunch, an extra towel, a lost item) and read the total, so check-out adds everything up at once. Today the app only tracks the room's balance due; this widens it to room + restaurant + extras, minus payments. Build this first — everything else plugs into it.

Built in parts: the two tables and `utils/tabs.ts`; the owner changed a wrong line from a "correction" line to a plain **delete** (one money rule, the same as a wrong payment); settling a walk-in tab at the counter with its own numbered receipt and 58 mm slip; a mid-stay **running tab** printout stamped NOT A RECEIPT; and the **Restaurant & bar** row and column in the Earnings Report, counted on the day each order was placed. Then the owner moved ordering into the Restaurant screen for both kinds of guest, which the till's whole design follows.

**Since then:** as part of the stock room (k71 part 1), a sold line keeps the menu item's `id` and takes its ingredients off the shelf; removing the line puts them back.

---

## k126 · One booking form — no steps, no price summary
**high · New Feature**

Owner: "Step 2 and 3 should move to step 1 now. so there are no more steps, and it's just 1 form with everything." Plus "remove the price summary in the 3rd step".

One long page like the paper form: guest, companions, unit and dates, add-ons (behind a More button), discount, receptionist, deposit and payment. The Total/Deposit/Balance summary block comes out — the printed statement carries those figures. Booking / Block dates switch stays at the top.

**Later changes to the same form:** the Booking/Block toggle was removed altogether (blocking lives on the calendar now, k91), and the form **takes the money** — the guest is asked deposit-or-full-pay and how they will pay in the same breath.

---

## k140 · Breakfast folded into the room rate
**high · New Feature**

BUILT — and the rule changed after this card was written. Read this before checking it.

Original ask: "Forget about heads. just 150 times the amount of beds" + "breakfast is only charged once, which is added in the rate of the room".

What actually shipped (the owner's later decision): breakfast is one charge for the WHOLE stay at each ROOM'S OWN breakfast price, typed per room in Settings → Room Rates (blank until the desk types it). There is NO bed count and no x150 anywhere — a room with no price sells no breakfast, and its chip in the booking form cannot be ticked. The bed-count idea and its migration (add_room_beds) are dropped.

Where it lives: RoomRatesEditor (a Breakfast box per room) → `set_room_breakfast_price`; `pricing.ts` charges it once for the rooms the desk ticked (`breakfast_included` on that room's booking row); BreakfastRoomChips picks the rooms (tick = on, empty circle = off, "no price" rooms are not tappable, and a line under the row says what it adds up to); the guest portal offers the same switch for the room being booked; the per-day BreakfastRecorder is retired and no longer rendered; legacy `breakfast_records` still price old bookings.

---

## k130 · Deposit: half by default, typable
**high · New Feature**

Owner: "the custom deposit amount is an option, but default is always half." Every booking takes a deposit to hold the room.

The deposit box arrives filled with half the stay and can be overwritten with any peso amount. The typed amount then flows through the printed statement ("Amount Due"), `amountToPayNow`, and the arrival step — so the desk asks for exactly what was agreed.

Built over three passes: `agreed_deposit` on the booking and a small writer for it; the box showing its own arithmetic (`2 nights · Room ₱1,900 · Breakfast ₱300 / Whole stay ₱2,200 — half of it is ₱1,100`) after the owner had to reverse-engineer it; then the one-line control it is today — `Pays now · Deposit | Full pay | Custom`, Deposit already chosen, only Custom typed.

---

## k122 · The booking charges the price it shows
**high · bug**

BUG B3 (md line 13). Original symptom: the calendar showed promo prices while the booking form charged the regular ones.

What was really wrong (found 20 Sep): when the promo switch was retired (card k128) nothing recorded which price a booking was made at. `createManualBooking` wrote `promo_applied: usePromo ?? undefined`, and the form passes no usePromo, so every new booking saved `undefined` — while every read path (quick view / recomputeBalance, printed statement, analytics, calendar extend) reads `promo_applied === true`. So a booking was CREATED at the single price and RE-READ at the old regular one. A guest who had paid in full came back as "Partly paid · ₱2,850 of ₱3,800 · ₱950 still to receive", and the printed bill would have said ₱3,800 too.

Fixed: `createManualBooking` now records `promo_applied: usePromo ?? true`; the guest portal records `promo_applied: true`; the retired sale mode is deleted; the crossed-out old price is gone from the calendar labels and the portal cards; and the audit that followed removed the last "promo" wording from the printed bill, the bill's "Discount/Promos" header, the portal's "Promo Price" line and Settings' "Regular and Promo" sentence.

Rows saved BEFORE the fix still carry no marker: re-saving one (Edit booking → Confirm) records it and re-prices it at the single figure.

---

## k138 · Add-ons behind a More button, suited to the room or venue
**medium · New Feature**

Owner: "I like a more button. I just meant everything should be accessible but not immediately on display." Everything stays reachable behind a **More add-ons** button, and the list is trimmed to suit the unit: a room shows linens, toiletries, an extra bed and breakfast; a venue (Gazebo, Garden, Vacation House) shows tables, chairs, tent, mineral water and extra hours. No guest is ever offered a tent for a room. Approved by the owner.

---

## k144 · Guest bill on A5
**medium · New Feature**

md line 9. The Guest Billing Statement is laid out for A5 paper instead of A4. The payment receipt keeps its 58 mm thermal roll. Note: the same statement is also emailed (see the email card), so the email copy should match the A5 layout.

---

## k136 · The receptionist's name remembers itself
**medium · New Feature**

Owner: "I like the receptionist's name." The "Receptionist on duty" box suggests names already used (from past bookings), so the same person is never spelled two ways. Nationality and the other boxes stay plain for now — the owner is not sure about them yet.

---

## k142 · Breakfast folded into the room line on the bill
**medium · New Feature**

md line 14. On the guest bill and the payment receipt, a room with breakfast prints as ONE line — "Room 2 · Breakfast" — with the breakfast amount already inside the room rate. Breakfast stops having its own row anywhere. Follows from the card above (breakfast charged once, inside the rate). Touches `utils/statement.ts`, InvoiceDocument and PaymentReceiptDocument.

---

## k134 · Open the new booking in the quick view after the bill
**medium · New Feature**

md lines 10 and 20. After a booking is created the printable Guest Billing Statement comes first, as it does now; once that statement is printed or closed, the booking just created opens in the quick view instead of leaving staff on the calendar to hunt for it. With 2+ units, the first booking of the group opens.

**Since then:** when the form takes money, what is shown first is the **Payment Receipt**, not the bill.

---

## k132 · The guest chooses how they pay, not the staff
**medium · New Feature**

Owner: "the staff don't get to decide what type of payment method the guest will use, only the guest get to choose that."

The booking form stops demanding a payment method. The method is the guest's choice, recorded when the money is actually received — which is already how each payment record works. Printed statements therefore name the method only once it is known.

Built over four rounds with the owner: the "Guest pays by" row on the quick view (Cash / GCash / Bank transfer, saved on the tap, no money needed); "Other" removed because it hid how the guest really paid; a reference required for GCash and bank, with the receipt saying Cash on a GCash booking fixed; "Balance on arrival" removed from the printed bill, the Save-method button deleted, the circles and ticks removed; and the check-in reverting bug, caused by the timeline cell's memo comparator ignoring the check-in fields.

**Superseded in part:** the booking form now **does** ask how the guest pays (the owner's 2026-09-29 ruling — the real walk-in settles deposit and method in one sitting). The guest still chooses; the desk writes it down.

---

## k154 · The calendar starts at today
**medium · New Feature**

md line 22. Owner picked option (b): the grid begins at today and runs into the days ahead, so the earlier days of the month are not on screen at all and there is nothing to scroll back through. Replaces the current whole-month grid that opens at the start of the month.

Built: the window is 31 day columns beginning on today; a 1st prints its month name ("1 Oct") with a gold left edge; the header reads "20 Sep – 20 Oct 2026" when the window crosses a month; "This month" became **Today** with a "from today" badge; any month navigated to opens on its 1st; a stay that began before the first column carries a small "‹" before the guest's name; and the horizontal scroll snaps back to the left edge whenever the window changes. Files: `calendar/timelineDays.ts` (new), CalendarTab, TimelineGrid, TimelineCell, CalendarToolbar.
