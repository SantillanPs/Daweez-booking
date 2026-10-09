# Booking — why it works this way

## The booking form

- **It copies the hotel's paper Guest Registration form.** Same fields (Birth Date, Sex, Plate No., companion name and nationality), so staff recognise it.
- **A companion has a sex as well.** Sebastian, 2026-10-05: *"can you also add sex for companions."*
- **Nationality is picked from a list of every nationality, found by typing** — his ask the same day. It still takes anything typed.
- **One page, no steps.** The owner chose a single scrolling form over a wizard. There is no Total / Deposit / Balance summary on it — the printed statement carries those figures.
- **Name and contact first; the rest behind "＋ More details".** That line opens by itself when any hidden field already holds a value, so correcting an old booking never hides something.
- **The form takes the money.** A real walk-in is settled in one sitting: the guest is asked deposit or full pay *and how they will pay* in the same breath, sends the GCash while the desk waits, and only then is the booking finished. So the form records the payment and hands over the **Payment Receipt**, not a bill. (An earlier rule said the form takes no money; the staff's real process overruled it.)
- **Nothing is preselected for the payment method.** Defaulting to "Cash" once printed a Cash receipt for a GCash guest. GCash and bank need a reference number before Confirm wakes up; cash and check do not.
- **Editing a booking never takes money again.** Money on a saved booking is added from its quick view.
- **Add-ons list only what suits the unit** and stay behind "More add-ons", because they are rarely used.
- **After confirming, the booking opens in the quick view**, so nobody hunts for it on the calendar.

- **It has to be easy to use.** Sebastian, testing it on 2026-10-04: *"I want to feel good or at least not have a hard time using it."*
- **It is flat, with no cards.** Sebastian, the same day, after the first round of fixes: *"I don't like the boxes design. I prefer a more 2d, clean, minimalistic, simple, yet professional look."*
- **The staff found the flat form hard to read and understand** when Sebastian showed it to them (2026-10-04). They named nothing specific.

## Payment plans

**The form's `Payment` is one choice of three: Custom, Full pay or No deposit** — a toggle, the same on every booking, an agency's included (Sebastian, 2026-10-06). It is called Payment, not Deposit: *"in the form, don't call it 'deposit', use Payment."*

- **None of the three is chosen when the form opens**, and the form waits for one: *"don't default to custom. let it be unselected between the 3."* The same reason nothing is chosen on `Paid by` — a payment the form picked itself is one nobody agreed. Until one is chosen there is no amount, no note and no `Paid by`.
- **Custom opens the amount with half the stay already in it**, and the desk types over it when the guest agrees to something else. *"custom should have automatic 50% filled, full pay and no deposit should just be a toggle, no need to show the amount input field."* Until it is typed over, it follows the stay.
- **A custom deposit has a Notes box, and nothing else does.** *"add notes for the custom payments in the booking form… only for the custom."* It is where the desk writes why the amount is what it is. It is kept on the booking (its `notes`) and comes back when the booking is corrected; choosing Full pay or No deposit drops it.
- It used to be a box that was always there with Half / Full pay / No deposit shortcuts beside it (2026-10-05), and before that one of four choices — Deposit (half the stay, already chosen), Full pay, Custom, Reservation. Sebastian, 2026-10-05: *"the deposit feature is a bit of a nuisance since most of the time the staff would do custom priced deposit."*
- **A reservation can have a deposit or none.** The same day: *"the staff wants to be able to add a deposit price on the reservation because sometimes they allow no deposit on reservations and sometimes they do."* He wondered about renaming every booking a reservation and was not sure of it. Instead "Reservation" stopped being a kind of booking to choose: every booking has a deposit, and it may be nothing.

- **A booking with no deposit is what the rules below call a reservation.** It is a hold for somebody the staff personally know ("they are trustworthy"). The app never checks who qualifies. It blocks the room, never expires, and agrees to no money at all.
- **A reserved guest pays when they arrive, not at check-out.** Check-in refuses while money is owed — that refusal is how the money is collected at the door.
- **Until they arrive, a reservation is a promise, not a debt.** It stays out of "Who owes right now". On the calendar its pill says **`Reserved · No Deposit` in blue, with no amount** (Sebastian, 2026-10-06: *"it should just say 'Reserved · No Deposit' and turn the color of the text to blue"*, and for an agency booking made with No deposit too: *"they shouldn't show an amount to pay"*). Blue means no deposit and nothing else — red is money owed, green is paid. Once any money is recorded against it the pill goes back to `₱… reserved`, and once the guest arrives it is an ordinary owing stay.
- **The calendar says it with signs, and the words are in a guide** (Sebastian, 2026-10-08, from the staff: on a guest's last morning the pill said only `IN`, and they wanted the name without opening it; they also could not tell from the room column which rooms were occupied). He chose each sign from a mock and asked throughout for *"visual design, not so much text heavy"*:
  - A half-day pill shows the guest's **initials**.
  - A room with a guest in it has a **bar** on its left edge (gold at first; green since 2026-10-09, with the pill). The `IN` tag and a gold circle round the initials were dropped as saying the same thing twice.
  - **Arrives today** is a green left edge on the pill; **leaves today** is a charcoal right edge. (On 2026-10-09 he tried it in the grey of a booking that has left, and had it put back the same day: *"revert the to check out indicator to black"*.)
  - **The card shown when pointing at a booking is three bands: who, when, how much.** 2026-10-09: *"the overview where I hover a pill looks messy"*. He chose "three bands" over a bill bar, calendar leaves, a bill ring and others, and added: *"remove the checked in status"* — the pill's colour already says it.
  - **A guest in the hotel is a soft green pill** (2026-10-09: *"when a guest checks in, the pill should turn green"*; he chose "Soft green" over mint, a green outline, solid green and sage). It was gold.
  - **No deposit is the words "No deposit" in blue** under the name, and blue initials on a half-day pill. It was a blue corner with no words for a few hours; Sebastian, the same day: *"honestly though, the no deposit indicator looks like a jewish cap"*, and after looking at dots, lines and shorter wordings, *"let's just bring back the blue no deposit text"*. *"As long as the staff records a check or payment, the indicator should be removed."* It stays through the stay and after it, because *"some agencies don't have deposits because they usually pay 3 months after giving a check"*. "Reserved" is no longer written: *"all of them are always reserved."*
  - An **agency** booking has a building icon before its name.
  - Under each date: how many **will arrive** and **will leave** that day — worded that way because *"how many arrive"* *"sounds as if they already did"*. They count down as guests are checked in and out.
  - **The "Today" line was taken off** — *"remove the today strip since it's redundant"* — once the grid said who arrives, leaves and is in. Breakfast and Diners to pay had nowhere else to live, so they moved to the calendar's top line. The two counts stand **over the two halves of their day** (leaving over the morning, arriving over the afternoon), his pick from a mock, with the arriving arrow turned round.
  - **A room still to be asked about breakfast has a cup that hops** beside the room's name, and the cup goes once the room is asked. It is a button that opens the breakfast list for that room. It began in the corner of the pill, and he moved it: *"I like the idea of clicking the cup. But the problem is that it's too small, but if it's big it doesn't fit the pill. So let's try and move it to the rooms."* A plain cup was not enough: *"it's not bringing the attention of the staff. It looks more of a status than a 'this room needs breakfast'."* He picked the hop from five movements and had its dark background taken off.
  - *"Add a place in the calendar for guides about what every single signal or sign or indication mean… so that all the calendar is showing is just the visuals."* That is the `?` on the calendar's top line.

## Agencies (corporate / government / travel agency)

- **An agency booking is a normal booking with a different price.** The owner: *"the agency feature is supposed to be a custom set pricing, not automatic booking… it should just change the pricing of the rooms specifically for them."*
- It is added from a quiet ⋯ on the guest card ("Add agency?"). The guest stays the guest; the bill is addressed to the agency with the guest as `c/o`, the way the hotel's real PGO bill reads.
- **Agencies pay by check or by bank, and the bank payment usually arrives about three months later**, because it is processed first (the owner, 2026-10-04). So an agency guest checks in and checks out with the bill still open, and what the agencies owe is kept apart from "Who owes right now" — it is not chased at the desk.
- **An agency booking pays the same three ways as any other.** Sebastian, 2026-10-06: *"when I book an agency, remove the 'bill the agency'… just keep the same payment methods the same as the normal booking. custom, full pay, no deposit."* The agency changes only the price and who the bill is addressed to; adding one no longer changes the deposit. Bookings made before that day with the old "billed to the agency" plan still read that way.
- **On the calendar an agency booking wears the agency's name, not the name of the guest who made the booking** (the same day). The guest is on the hover card and in the panel. Money an agency will send has no colour of its own — it was blue, and is now plain.
- **No room is ever selected for the desk.** Auto-ticking every contracted room was the "automatic booking" he rejected.
- A new agency is created only from the "No saved agency" line. "Change" only swaps which agency is named, so it can never overwrite one.
- There is no separate corporate form any more — one entrance, not two.

## The calendar

- **It opens on today**, 31 days wide, so nobody scrolls to find today.
- **The bar of actions always sits above the first cell that was picked, never below it** (Sebastian, 2026-10-06). For the first rooms there is only the date header above, and the bar goes over it rather than dropping onto the rooms the desk is about to pick the next day from.
- **The bar is centred on the picked dates**, from the afternoon of check-in to the morning of check-out — the span that is highlighted — and is always as wide as what is in it (Sebastian, the same day: *"the button is covering the text… keep the popup centered to the selected dates"*). Far to the right of the screen the browser had squeezed it to the room left over, and the buttons landed on the dates. It is held inside the grid at either end.
- **Actions appear beside the cell that was picked**, never in the toolbar. The rule teaches itself: pick the dates first. One day offers `3h · 6h · 12h`; a range offers `New booking`. Both carry the block icon and Log old booking.
- **Blocking dates happens on the calendar**, in a small pane that asks only *why* (Cleaning, Maintenance, Owner use, Other).
- **An Owner use block can have no end date.** The owner's family sometimes use a room for a few days or weeks, and when they will leave is often not known (the owner, 2026-10-04). The room stays closed until the desk presses "They have left".
- **A stay can end on the day the next guest arrives, so a booking fills half of its first and last day.** Sebastian, 2026-10-06: booking Oct 8 to 9 on a room was impossible because someone checks in on Oct 9, yet the hotel is fine with it — check-out is 12 PM, check-in is 2 PM, so the room has exactly two hours to be cleaned. His fix: *"update the calendar bookings to occupy only half of the box on the day they check in and check out."* The bookings and the database always allowed it (a stay is `[check-in, check-out)`); the calendar did not, because a booking filled every box from check-in to the day before check-out, so the day the next guest arrived was their whole box and could not be picked. Each day is now two halves (`components/calendar/timelineHalves.ts`): a stay runs from the afternoon of its first day to the morning of its last. The free morning of the arrival day is what the desk taps as the check-out. A day another guest arrives on can end a stay but not start one — tapping it first says the room is booked that night.
- **A short stay is the exception: it still fills its whole day** (it is never resold the same day, see Short stays). If a guest leaves on the day it is on, that guest keeps the morning and the short stay shows the afternoon only. A half-day pill is too narrow for a name, so it shows only the stage (`IN`) or the hours (`6h`); the name is on the hover card.
- **Nothing is drawn where a guest left.** The arrow and the word "out" beside the end of a booking were taken off (Sebastian, 2026-10-06) — the end of the pill says it. The grey `OUT` on a guest who has really checked out stays.
- **A booking that starts before the window shows `‹`**, so a cut-off block is not read as a new arrival.
- **A pill says what is still to pay and whether the guest is in or out.** The staff, 2026-10-04: they want to look at the calendar and know the amount left for every room, before and after check-in, and which rooms are checked in or checked out — without clicking each pill. The amount used to be a coloured dot.
- **Where the booking came from is not shown for now.** Sebastian, 2026-10-04: *"remove the 'booked from' for now since ical isn't used yet."*

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
- **Check-in and check-out must not happen by accident** (the staff, 2026-10-04). Sebastian chose: the app asks first, and a wrong one can be undone.
- **Food can only be ordered once the guest is checked in** — people order when they are physically in the hotel.

## Venues

- **The Vacation House is booked as the Vacation House, the Vacation House & Ground, or Exclusive** (Sebastian, 2026-10-06): ₱7,500, ₱10,000 and ₱15,000 a day. His words: it is *"like choosing the vacation house type or an add-on, but it's not technically an add-on."* So it is not charged on top of the day — the kind **is** the day's price — and it is chosen above the Stay extras, as a row of three with each price under its name, not among them.
- **The choices are named for what they contain.** His correction, after the first build called them Regular / Ground / Exclusive: *"Ground is supposed to be an addition to the regular, like vacation house & Ground. Exclusive is like the entire Vacation House and the others that come with it are all included, that's why it's 15,000."* So the ground is the house **and** the ground, not a different house, and Exclusive is all of it, which is why it costs most. The plain Vacation House is chosen when the form opens, and the Total moves as another is picked. The kind is named on the bill (`Vacation House & Ground`, `Vacation House · Exclusive`) and under the booking panel's title.
- **The kinds live on the venue's row** (`details.types`), so any venue can have them and one without shows no choice. The Vacation House used to be ₱15,000 a day, which is now its Exclusive price.

## Moving a booking

- **A booking can be moved to another room and other dates until the guest arrives** (Sebastian, 2026-10-06). His example: an agency wants to reschedule and change rooms. The only way had been to cancel the booking and type a new one — the guest retyped, a new invoice number, and the receipts left behind on the cancelled one. It is **Change room or dates** in the booking panel, beside Extend stay: one room (or venue) and the two dates.
- It is the same booking in a new place, so the guest, the agency, the payments, the receipts, the notes and the invoice number stay on it. Only the bill is worked out again, and it is shown before it is saved.
- **The agency's rate belongs to a room**, so it does not follow the booking: the new room gets the agency's rate for *it*, or the room's ordinary price when the agency has none. Breakfast is dropped when the new room sells none.
- **A guest who has paid more than the new stay costs** is told so in a line (`They have paid ₱1,900 more than this stay costs.`). The money stays recorded on the booking; the app does not refund anything.
- A booking moves as its own room — others booked with it stay where they are. Not offered once the guest has checked in, for a short stay, or for a block (those have Extend stay, a rebooking and the block's own dates).
- A room that is taken on the chosen dates says `booked` in the list, and a clash is refused with the reason.

## The quick view (the panel that opens on a booking)

- **Only one next step is ever on screen**, and nothing appears until it is needed. A paid booking shows one line (`Fully paid ✓`) and its button; the money box appears only while something is owed.
- **No stack of closed sections.** The owner, 2026-10-04: *"it looks so badly designed… it looks so lazy just stacking accordions."* The panel had become a money box over three closed sections that were there whether or not they held anything. Now a thing appears when the stay reaches it: receipts once there is one, the order slips once the guest is checked in, and extending is a quiet action in the bottom row beside Print and Cancel.
- **Money is taken in one place.** A part-payment is "A different amount" there; the second payment form that sat under Payment receipts is gone.
- **With the guest's money in hand, nobody could tell where to record it, what came after, or where the booking stood** (the staff and Sebastian, 2026-10-04). Sebastian: *"it's not directing my eyes on where I'm supposed to look at after receiving money."* The staff also could not tell whether a booking was checked in or checked out.
- **The title is the room and the guest** (`Room 7 · Noel Bautista`). Under it the panel says three things in words: the payment, the check-in, the check-out.
- The panel is **as wide as its contents**, never a fixed width, and one column.
- Recording the first payment confirms the booking and prints the receipt.

## Other rules

- **A walk-in starts unpaid ("On hold") and only recording money confirms it.** It still blocks the room and never expires.
- **Double booking:** every create or move checks for a clash; the database is the real gate. A save that changes neither room nor dates must *not* check — that check once made every paid booking collide with itself.
- **Log old booking** exists to enter past paper bookings. It keeps the paper log's own number and date so staff can find the physical page.
- **No browser pop-ups anywhere** (`alert`, `confirm`). A problem is shown under the box or button it belongs to; everything else is a toast. Destructive actions ask through the app's own confirm dialog.
- **No guest's name is written on the calendar** (the owner, 2026-10-09). A pill says "Reserved" until the guest checks in, "Occupied" while they are in, and the guest's name once they have checked out; who it is stays on the hover card and in the booking's panel. An agency's name and a block's reason are still shown, and a half-day pill keeps its initials.
- **A cooked breakfast comes back to the desk** (the owner, 2026-10-09: "after the kitchen finishes cooking, where does it go next?"). The room's cup returns in green; the desk taps it once the breakfast is served.
- **Number boxes are free-typing**, never the browser's number spinner — the spinner's snap-to-zero confused staff.
