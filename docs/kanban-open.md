# The Board · To do (17 cards)

Every open card, copied from the board on **30 September 2026** — its note, and every comment on it, without re-wording. The index is in [kanban.md](kanban.md); the closed cards are in [kanban-done.md](kanban-done.md).

---

## k74 · Know who did it — staff names and PINs
**high · New Feature**

Right now the whole app shares one passcode, so every action is anonymous. Inventory and orders are worthless if you cannot see who moved what or took which order. Small fix: staff pick their name and a short PIN when they start work, and that name is recorded on every stock line, order and payment. Cheap now, painful to add later.

---

## k71 · Inventory system — food, drinks and hotel supplies
**high · New Feature**

One stock room shared by the kitchen and the hotel: food, drinks, linens, toiletries. Every item in and out is logged with who and when. Recipes are the important part — a dish is made of ingredients, so selling one dish takes its ingredients off the shelf automatically, no manual deducting. Plus low-stock alerts, suppliers, and a regular physical count so the numbers stay honest. Housekeeping's "used, replaced, lost" writes into this same log.

**Part 1 is built** (30 September 2026): the stock room, what a dish uses, receive stock, the movements log, and the automatic deduction — the sold line now keeps the dish's `id`, which is what made it possible. Parts 3 (suppliers), 4 (low-stock list) and 5 (physical count) are still open.

---

## k93 · Bookings with no check-out date — the app forces one the paper log never needed
**high · Feedback**

Raised by the owner from the old paper booking logs: at booking time staff often took a check-in and never wrote a check-out, and most paper bookings have no check-out date at all. The reason is not yet known — the owner is asking the staff first, before any change, and does not want to go against their workflow.

What the app does today: it FORCES a check-out before a booking can be saved (checkIn < checkOut is enforced in the booking form, again in isRoomAvailable, and a third time by the database exclusion constraint). So the app introduced a rule the paper process never had.

Why an end is needed — not stubbornness, and useful for the staff conversation:
- The calendar draws a booking by walking day by day from check-in to check-out (CalendarTab.tsx lines 62-70). No check-out = no end = the pill draws nothing, so the booking is invisible.
- The overlap check needs an end too: with an empty check-out the date comparisons fail silently and isRoomAvailable returns AVAILABLE, so the room would look free on every date and could be double-booked.

Questions to ask the staff (the answer changes the fix):
1. Did the guest not know how long they were staying — booked a night at a time?
2. Was that column the departure as it happened, written when they left and blank until then?
3. Was it simply not needed — the room was held until the key came back?

Ways to honour the habit without breaking the calendar:
- Ask "how many nights?" instead of an end date. Book 1 night by default, extend in one tap (ExtendStayModal already exists). Closest fit for a pension house.
- An "open stay" booking: no fixed departure, the room stays blocked from check-in onward until the stay is closed, and the calendar shows a "still here" bar to today. Needs real work on the overlap logic — no end means the room is blocked for everything after check-in.
- Both: default to nights, allow open stay when the guest truly does not know.

**Do NOT build until the owner has talked to the staff.**

---

## k120 · Receipt prints the receipt, not the booking behind it
**high · bug**

BUG B1 (md line 5). Pressing Print on a payment receipt sent the booking slide-over to the printer instead of the 58 mm slip.

**FIXED in code**: papers now mark themselves in `src/index.css` (`.print-slip` for the 58 mm roll, `.print-page` for the guest bill) and everything else steps aside for the print. Classes added to PaymentReceiptDocument, SlipModal and InvoiceDocument.

Left open only for the owner to try it and close the card himself.

---

## k124 · "Prepared by" on the bill and the receipt
**high · bug**

BUG B2 (md line 8). A name typed in "Receptionist on duty" never reaches the printed statement or receipt.

The app sends it, the mappers carry `prepared_by`, and both printed documents read it — so the name is lost on the way to the database (the booking RPCs are the drifted ones).

Waiting on one row from the owner's Supabase: the diagnostic query in `.lavish/new-notes.html` (bookings_in_db / with_prepared_by / tabs_in_db / rooms_with_promo / bookings_on_promo). If `with_prepared_by` is 0, rebuild `book_booking`/`update_booking` from the live definition with `prepared_by` added.

**Comment (agent, 19 Sep):** **Solved — and it was bigger than the name.** The owner's two database answers settled it: `book_booking` and `update_booking` both handle `prepared_by` (so it is not lost on the way in), and 6 bookings have a name stored. That means the name was being **wiped after it was saved**.

Root cause: `useRealtimeBookings.ts` → `rowToBooking`, the mapper that rebuilds a booking from the live database row. Its column list had fallen behind the app's own list (`toBookingRecord` in `utils/db.ts`), and `prepared_by` was not in it. So every live INSERT/UPDATE replaced the cached booking with one that had no `prepared_by` — and because the cache is what the quick view saves back, the next save (recording a payment, checking a guest in, extending a stay) wrote the booking back **without the name**, erasing it in the database too. That is why only 6 of 32 bookings still had one.

The same gap was silently wiping, on every live event and the save that followed: `actual_check_in` / `actual_check_out` (the in-house state — which also decides whether a guest's food tab is unlocked), `payment_records` (the numbered receipts), `applied_discount`, `notes` (the block reason), `early_check_in_hours` / `late_check_out_hours`, `venue_day_blocks`, `breakfast_days`, and `birthdate`.

All eleven columns are now mapped. `npx tsc -b --force` exits 0. No SQL needed — the fix is app-side. The rule is in `src/AGENTS.md`: a booking column must be added in three places (the `Booking` type, `toBookingRecord`, `rowToBooking`).

---

## k148 · Vacation House: ₱2,000 reservation + ₱2,000 safety deposit
**high · New Feature**

md line 23. Owner approved: a flat **₱2,000 reservation** for the Vacation House, never "half", taken off the house rate — plus a **₱2,000 safety deposit**.

Agreed handling: both collected with the reservation and printed as two separate lines (₱2,000 + ₱2,000 = ₱4,000 up front); the safety deposit is handed back at check-out as a refund line on the bill — "Safety deposit returned ₱2,000" — only once staff confirm no damage. If there is damage, the amount kept is typed and a line says why. The check-out refund flow is new.

---

## k72 · Housekeeping room board — cleaning status and notes
**medium · New Feature**

A board for room state: Clean · Being cleaned · Needs cleaning · Maintenance, with who and when. After a guest checks out, staff tick what they used, replaced or lost — those become stock lines, and a lost or damaged item can optionally be added to the guest's tab. The existing cleaning checklist slots in here; it just needs the room-state link.

**Comment (agent, 17 Sep):** Connection to the date-block work: a "Cleaning" block on the calendar should itself create the cleaning job for that room + date, so staff never enter the same job twice. Once the job is marked cleaned and checked, the calendar pill should turn green ("Cleaned") and offer to open the room again. Only Cleaning spawns a job — Maintenance and Owner-use blocks just block.

Shape to change: today one row = one item (pick from a fixed list, then retype room / date / cleaned by / checked by for every item). The real job is one cleaning per room per day, with the items ticked inside it — replaced (bed sheet, towel) vs restocked (toothbrush, toothpaste) vs lost.

Bug found while checking this: cleaning and inventory saves cannot reach the database. Both tables declare id uuid, but the app builds ids like 'clean-1755432…' and 'inv-1755432…' (HousekeepingTab.tsx lines 54 and 34). Postgres rejects those, the error is only console.error'd, and everything falls back to that one browser's localStorage. **The id widening in `20260928162102_widen_text_id_columns.sql` fixed this** (both columns are TEXT now), and the stock room writes real UUIDs.

---

## k75 · Navigation: group the tabs into the four parts (Option B)
**medium · New Feature**

Make the top bar one tab per part, with the detail inside as sub-tabs, so the bar stays six tabs no matter how much gets built:
- Front desk — Calendar (opens here) · Bookings · Guests & Partners
- Restaurant — Orders · Menu
- Inventory — Stock · Recipes · Suppliers · Counts
- Housekeeping — Rooms · Cleaning checklist
- Money — Payments · Expenses · Purchases · Performance
- Settings — Rates · Staff · Accounts

Nothing is hidden: the sub-tabs are visible as soon as the tab opens, and Calendar stays the landing screen so front-desk staff click once. Every future feature goes inside its part instead of adding another top tab. Do this AFTER the restaurant and inventory exist, so nothing is reorganised while it is still being built. Later (once staff PINs land) tabs can follow the person: kitchen sees Restaurant + Inventory, manager sees everything.

---

## k73 · Money and performance view for the whole hotel
**medium · New Feature**

Buying stock must be ONE action that both adds it to the shelf and records the money out — never typed twice, or the profit figure comes out wrong. Maintenance, tools and equipment are plain expenses. Then a single performance view adds everything up grouped by business area: Rooms, Restaurant, Bar, Gazebo, Garden, Parking. It is a view over the other parts, not a system holding its own numbers.

---

## k91 · Block dates from the calendar toolbar — and show the reason on the calendar
**medium · Feedback**

Owner reports blocking a date is buried: you must pick dates, press New booking, and only then does the Block dates toggle appear inside the booking form.

Plan (agreed in discussion, NOT built yet):
- Add a Block dates button to the calendar toolbar beside New booking / Corporate / Log old booking, disabled until a unit + date range is picked — the same rule the other buttons already use.
- Reasons as one-tap chips: Cleaning · Maintenance · Owner use (family stays, e.g. Room 10). Free text kept for anything unusual.
- The reason becomes the calendar label: the pill should read "Cleaning" or "Owner use", not "Admin Date Block". Today the typed reason is stored in notes and shown nowhere (TimelineCell prints guest_name only).
- Remove the Booking/Block toggle from the booking form header so the action has one home, and move block into its own small modal like LogOldBookingModal.

Caveat to explain in the form: a block covers nights, not days (check-in must be before check-out), so a cleaning block for today also closes the room tonight.

Connected to k72 — a Cleaning block should create the housekeeping job itself.

**Comment (agent, 25 Sep):** First half of this card is built. Blocking dates no longer lives in the booking form: the form's `Booking / Block dates` toggle is gone, and the calendar's action bar now carries a **block icon** on BOTH picks — one day (beside `3h · 6h · 12h`) and a range (beside `New booking`). Tapping it opens `src/components/calendar/BlockDatesPane.tsx`: room + dates read-only from the pick, then Cleaning · Maintenance · Owner use · Other + an optional note + Create block, writing `createManualBooking({ status: 'blocked', notes })` — one block per picked unit, with the missing reason shown inline. The `Log old booking` icon also moved into the same bar, so the same pick fills its dates in.

Still open: **the second half — the block pill carrying its reason on the calendar** (the reason is stored in `notes` already, it just is not drawn on the pill yet). `tsc` and `lint` both exit 0.

---

## k105 · A screen to edit the restaurant menu and prices
**medium · New Feature**

The menu is in the database now (`menu_categories` + `menu_items`, seeded with the hotel's 61 items). What is missing is a screen: change a price, add a dish, retire one — without a developer and without a SQL run.

Natural home: Settings → a "Restaurant Menu" tab next to Shared Rates, or the Restaurant tab itself. Editing writes through `saveMenu` (`utils/restaurantMenu.ts`), which already upserts the whole list for every device.

Depends on nothing; the data layer is done.

---

## k109 · Cooking choices on a dish (buttered / sinagang / tinola)
**medium · New Feature**

Shrimp, Tuna, Pampano and the Mix Vegetable salad come with a choice the guest picks at the counter — buttered / sinagang / tinola / fried. Today the choices live in the tile's tooltip and the staff member just says them out loud, so the bill does not record which one was ordered, and the kitchen slip could not either.

Wanted: tapping such a dish asks for the choice, and the line reads `Shrimp · Sinagang` on the tab, the bill and the kitchen slip. Needs a small `choices` field on `menu_items` (the `note` column already holds the list today).

Worth doing before the restaurant opens, but not before the till works.

---

## k146 · Email the bill and the receipt, from your Gmail
**medium · New Feature**

Owner: "send only when staff presses a button. We have gmail." Nothing is emailed automatically: staff press **Email to guest** on the statement and on a receipt, and the guest gets it from the hotel's Gmail account. Needs a Gmail app password (or an SMTP-capable sender), and a Supabase edge function to send with the PDF attached. Owner to supply the account details when this is built.

---

## k150 · A photo of the payment, with the reference read from it
**medium · New Feature**

Owner: "guests can send the screenshot of the payment that has the reference no. or just take a picture if they are physically right beside them... the photo should be kept, while the reference no. field gets filled because of the AI extracting it."

So: the payment confirmation PHOTO is stored as proof, and the reference number box is filled by AI reading the photo — staff can correct what it read. Works both ways: a guest sends a screenshot ahead (portal), or the desk photographs a phone at the counter. Needs image storage (Supabase storage bucket) plus an AI reading step (a paid API, with typing still possible when it cannot read).

---

## k152 · Tables as pills — several per tab, edited in Settings
**medium · New Feature**

md line 27. Owner: "sometimes they use more than 1 table so an order would use 2 tables or more. and yes, it should be editable in the settings."

Opening a walk-in tab offers the tables as tappable pills instead of a typed box — one table or several for the same tab. A table already on a running tab shows as taken and cannot be picked twice; it frees up when that tab is settled. The list of tables lives in Settings, where tables can be added or retired.

---

## k107 · Photos of the dishes on the menu tiles
**low · New Feature**

Right now each dish tile shows a lucide icon for its food group (a coffee cup for Breakfast, a beer mug for Beer). A photo of the actual dish would be far more visual and faster to recognise — the owner asked for a more visual till.

Needs: somewhere to store the images (Supabase Storage), an upload path in the menu editor (see the edit-screen card), and a fallback to the icon when a dish has no photo.

Held back until there are real pictures — a grid of mismatched stock photos is worse than clean icons.

---

## k156 · Airbnb / Booking.com / Agoda — parked last
**low · New Feature**

md line 6. Owner: "suspend airbnb, booking, agoda development. last on the list of things to work on." Nothing is deleted — the iCal sync work simply sits at the very bottom of the queue until the owner says otherwise. The k69 restaurant work came first, as he also said.
