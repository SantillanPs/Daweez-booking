# Bills and printed paper — why they look this way

## Two bills

- **Ordinary booking → Guest Billing Statement.** It mirrors the paper form staff already fill in.
- **Agency booking → the agency bill**, copied line by line from the hotel's real PGO paper: COMPANY above NAME OF GUEST (`c/o …`), the room table, **TOTAL only**, both bank accounts plus GCash and Check, Prepared by, a thank-you line. **No Pension Policies and no guest signature** — the office files this copy; the guest never signs it.
- Both share the same page frame and the same charges table, so they are one piece of paper with different contents.

## The statement

- **The charges table is the hotel's own:** `Room / Particulars · Rate · Date · No. of Night · Total`, grouped under Room Accommodation, Breakfast, Extras, Restaurant & bar, Discount. A group with no rows is not drawn — which is why a guest who has not checked in has no restaurant group.
- **Restaurant & bar lists each order slip as its number, its total and Paid or Not paid — never the dishes.** The staff, 2026-10-04: the bill kept showing past orders that were already paid.
- **The bill lists the payments already received.** The staff, the same day: it showed what still had to be paid but not what had been paid.
- **It prints only what applies.** A field the booking does not hold is skipped; only the chosen payment method is shown; only the matching account is shown; zero rows are hidden. The only blanks are the lines a hand fills in: Prepared by, Guest Signature.
- **Amount Due is what the guest hands over now** — the deposit, the custom figure, or the whole stay. There is **no "Balance on arrival" line**: the owner read it as a second demand on the same page.
- **Pension Policies are printed word for word** from the paper form. The app's earlier paraphrase had lost the ₱1,000 smoking penalty and its Tandag City ordinance, the key-card rule and the ₱500 lost-card charge. Never reword them and never tie their figures to Settings — the guest must read the words they signed.
- **Guest details, then stay details, separated by space alone.** They used to sit in one flat grid, so a name read beside a room number.
- **Labels are short** (`Name`, `Contact`, `Check In`) so values never wrap; a wrapped bank account number is how a guest mistypes it.
- **Where to pay is one row per way to pay** (Cash / GCash / bank). A single run-on line left guests unable to tell where one ended.
- **A short stay** prints the hours price as *the* price and `3 hrs` in the nights column, with no standard check-in/out line.
- `No. of Guests` sits with the stay, not among contact details.

## The paper size trap

- The statement is **A5 (559px wide)**. Any layout that switches to two columns only above 640px prints as **one column** and runs to 1.4 pages. Layouts that must hold on paper use fixed columns, no screen-size switches.
- A printable document must be drawn as its own top-level element at print time, or it prints a third of the way down a blank page.
- Page margin is zero so the browser has nowhere to print its own date, URL and page number.

## The 58 mm payment receipt

- **It prints on the hotel's thermal roll:** one column, pure black on white (the printer cannot do grey), nothing wider than 58 mm. The screen preview is the same slip.
- It shows only what happened: the one method used and its reference, what the payment was for, and the real status.
- **A receipt for several rooms describes the whole set** — `Rooms 2, 3, 5, 7`, with balances for the set. Printing one room's figures beside the whole payment added up to nothing.
- A short stay adds `Stay: Sep 25 · 3 hours`, because the slip has to prove what was bought.
- Print and Close are always shown — the receipt once appeared with no way to print or close it.

## Sending by email

- **The staff want to email a payment receipt and a guest billing statement** (the staff, 2026-10-04). Until now both could only be printed.

## The Daily Report sheet

Built to four rulings from the owner:

1. *"This report is for money only. Nothing else."* — no check-ins, no occupancy.
2. *"How much money was received and spent, not promised."* — it counts dated receipts only.
3. *"Can we just list where the money came from? And not summarize it?"* — one line per receipt and per expense (`Room 4 · SEB · Cash`).
4. *"The total should be very clear… a conclusion is always at the bottom."* — `NET TODAY` is last and largest.

- No signature lines and no captions.
- One payment that covered many rooms is one line naming the rooms.
- It is a **print action** on the Earnings Report toolbar, not a page: *"something like a 'print a daily report' type of feature. Not a page."*

## One rule for everything on screen and paper

**State facts; never explain them.** The owner: *"you have a bad habit of adding a lot of explanations in the UI."* A label that needs a sentence under it is the wrong label.
