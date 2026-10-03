# Booking — why it works this way

## The booking form

- **It copies the hotel's paper Guest Registration form.** Same fields (Birth Date, Sex, Plate No., companion name and nationality), so staff recognise it.
- **One page, no steps.** The owner chose a single scrolling form over a wizard. There is no Total / Deposit / Balance summary on it — the printed statement carries those figures.
- **Name and contact first; the rest behind "＋ More details".** That line opens by itself when any hidden field already holds a value, so correcting an old booking never hides something.
- **The form takes the money.** A real walk-in is settled in one sitting: the guest is asked deposit or full pay *and how they will pay* in the same breath, sends the GCash while the desk waits, and only then is the booking finished. So the form records the payment and hands over the **Payment Receipt**, not a bill. (An earlier rule said the form takes no money; the staff's real process overruled it.)
- **Nothing is preselected for the payment method.** Defaulting to "Cash" once printed a Cash receipt for a GCash guest. GCash and bank need a reference number before Confirm wakes up; cash and check do not.
- **Editing a booking never takes money again.** Money on a saved booking is added from its quick view.
- **Add-ons list only what suits the unit** and stay behind "More add-ons", because they are rarely used.
- **After confirming, the booking opens in the quick view**, so nobody hunts for it on the calendar.

## Payment plans

The guest picks one of four: **Deposit** (half the stay — the standard, already chosen), **Full pay**, **Custom** (the only one typed), **Reservation**.

- **A reservation is a hold for somebody the staff personally know** ("they are trustworthy"). The app never checks who qualifies. It blocks the room, never expires, and agrees to no money at all.
- **A reserved guest pays when they arrive, not at check-out.** Check-in refuses while money is owed — that refusal is how the money is collected at the door.
- **Until they arrive, a reservation is a promise, not a debt.** It stays out of "Who owes right now" and shows only the name and the word `Reserved`.

## Agencies (corporate / government / travel agency)

- **An agency booking is a normal booking with a different price.** The owner: *"the agency feature is supposed to be a custom set pricing, not automatic booking… it should just change the pricing of the rooms specifically for them."*
- It is added from a quiet ⋯ on the guest card ("Add agency?"). The guest stays the guest; the bill is addressed to the agency with the guest as `c/o`, the way the hotel's real PGO bill reads.
- **Agencies pay by check or by bank, and the bank payment usually arrives about three months later**, because it is processed first (the owner, 2026-10-04). So an agency guest checks in and checks out with the bill still open, and what the agencies owe is kept apart from "Who owes right now" — it is not chased at the desk.
- **No room is ever selected for the desk.** Auto-ticking every contracted room was the "automatic booking" he rejected.
- A new agency is created only from the "No saved agency" line. "Change" only swaps which agency is named, so it can never overwrite one.
- There is no separate corporate form any more — one entrance, not two.

## The calendar

- **It opens on today**, 31 days wide, so nobody scrolls to find today.
- **Actions appear beside the cell that was picked**, never in the toolbar. The rule teaches itself: pick the dates first. One day offers `3h · 6h · 12h`; a range offers `New booking`. Both carry the block icon and Log old booking.
- **Blocking dates happens on the calendar**, in a small pane that asks only *why* (Cleaning, Maintenance, Owner use, Other).
- **An Owner use block can have no end date.** The owner's family sometimes use a room for a few days or weeks, and when they will leave is often not known (the owner, 2026-10-04). The room stays closed until the desk presses "They have left".
- **A booking that starts before the window shows `‹`**, so a cut-off block is not read as a new arrival.
- **Payment dot colours:** coral = owes, amber = deposit only, green = paid, grey = reserved.

## Short stays (3, 6, 12 hours)

- From the hotel's printed rate board. Each room has its own price per hours; a blank price means the room is not sold for those hours.
- **22 hours is just the room's normal night price**, so it is an ordinary booking.
- **A short stay blocks the whole day**, because housekeeping cleans the room afterwards and it is never resold the same day.
- **The clock starts at the Check in press.** The app shows the *time* the room is free (`out 1:12 PM`), never a countdown. When time is up the block turns red and the booking's panel opens by itself — one at a time, never reopened once closed. The app only tells the desk; it adds no money on its own.
- **No early or late charge on a short stay.** A 10am arrival for three hours is not "four hours early".
- **Extending a short stay turns it into a normal stay priced by nights** (ruled 2026-10-03).
- Everywhere a short stay is shown it reads `Sep 25 · 3 hours`, never `Sep 25 → Sep 26`.

## Check-in and check-out

- Standard times are 2 PM in and 12 PM out (changeable in Settings).
- **Early check-in is recorded at the door but charged at check-out.** The owner: *"just add it to their bill for when they checkout."* Before this, checking a fully paid guest in at 1 AM flipped the badge to "Partly paid" and he read it as a bug. The desk still sees a line saying what will be added.
- Early/late is charged per hour up to a cap, then one full night. Venues are always hourly.
- **Check-out is refused while money is owed**, said under the button. A stay billed to an agency is the exception (see Agencies).
- **Food can only be ordered once the guest is checked in** — people order when they are physically in the hotel.

## The quick view (the panel that opens on a booking)

- **Only one next step is ever on screen**, and nothing appears until it is needed. A paid booking shows one line (`Fully paid ✓`) and its button; the money box appears only while something is owed.
- The panel is **as wide as its contents**, never a fixed width, and one column.
- Recording the first payment confirms the booking and prints the receipt.

## Other rules

- **A walk-in starts unpaid ("On hold") and only recording money confirms it.** It still blocks the room and never expires.
- **Double booking:** every create or move checks for a clash; the database is the real gate. A save that changes neither room nor dates must *not* check — that check once made every paid booking collide with itself.
- **Log old booking** exists to enter past paper bookings. It keeps the paper log's own number and date so staff can find the physical page.
- **No browser pop-ups anywhere** (`alert`, `confirm`). A problem is shown under the box or button it belongs to; everything else is a toast. Destructive actions ask through the app's own confirm dialog.
- **Number boxes are free-typing**, never the browser's number spinner — the spinner's snap-to-zero confused staff.
