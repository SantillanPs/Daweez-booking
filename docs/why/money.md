# Money — why it works this way

## One price

- **Each room and venue has one price.** The owner: *"the use promo should be gone permanently. because the promo price should be the new original price."* There is no sale mode and no crossed-out second price.
- The database still has two columns (`base_price`, `promo_price`); Settings writes the same figure into both so they cannot drift.
- **A booking sold at an older price keeps it** through its own `contract_rate_override`. Ten old bookings were pinned this way before the two prices were merged, so their bills still reprint as sold.

## The money is the status

- **Unpaid / Partly paid / Paid is worked out from the payments recorded. It is never typed.** There is no payment-status control anywhere. To fix a mistake, remove the wrong payment and everything recomputes.
- **What is owed = the stay + the food tab − the money received.** One function (`recomputeBalance`) does this for the quick view, check-in, check-out, the tab, and (since 2026-10-03) extending a stay.
- **The deposit is agreed on the stay alone.** A lunch eaten later must never raise what the desk asks for on arrival.
- **The booking form's total uses the same pricing as the bill** (since 2026-10-03). It used to have its own sum, which skipped the staff discount and the agency's price.

## Payments and receipts

- **One payment, one numbered receipt** (`PR-YYYYMM-NNN`). The number is stored on the payment — never worked out from its position, because removing one payment would renumber the rest, and staff quote these numbers to guests.
- **Every payment carries its own method.** A guest may pay the deposit in cash and the rest by GCash; each receipt names its own.
- **One payment for several rooms is written onto every room it paid for.** The owner: *"if there are more than one rooms booked at the same time, the staff would need to find the room that holds the payment receipt."* Each room also keeps its own share. A reprint from any room shows the money actually handed over.
- **A receipt number belongs to one payment across the whole hotel.** Numbers were once counted per booking, so two fresh bookings both got `…-001`. Walk-in restaurant receipts had the same fault until 2026-10-03; they now look at every tab and every booking.
- **Staff labels read like plain speech:** big green "Paid", amber "Partial · ₱X left", red "Owes ₱X". The most important number ("Who owes right now") sits at the top of money lists.
- **Profit should feel like a reward** — bold, vibrant green, not a flat theme colour.

## Breakfast

- **Breakfast belongs to the room, and it is one charge for the whole stay at that room's own breakfast price.** The desk types the price per room in Settings.
- **A room with no breakfast price sells no breakfast.** The owner: *"remove every trace of 150 per head for breakfast calculations since the staff decides what the breakfast price is."* The old ₱150-per-head fallback once charged a guest ₱300 for breakfast they were never offered.
- **A guest who booked breakfast is asked every morning what they want** (the owner, 2026-10-04). The staff write the choice down for the kitchen; it does not change the price.
- Two earlier ideas are dead: ₱150 × beds, and per person per day. Old bookings that recorded breakfast day by day keep what they were charged.

## Discounts and extras

- Staff discount: none, 20%, 10%, or a custom amount. On the bill it is its own negative row so the column adds up in front of the guest.
- The gap between a room's night price and its hours price is **never** printed as a discount.
- Extras (foam, pillow, blanket, towel, tables, chairs, tent) are entered once for a group and go on the first room or first venue only.

## Lessons that cost real money

- **Every place that re-prices a booking must be handed every fact about it** — breakfast, short-stay hours, discount, agency rate. Each time one was left out, a screen charged a different stay than the one stored (a 3-hour stay billed as a night; a booking stored ₱600 short).
- **A report of money must never lose money in silence.** Money with no dated receipt is shown separately, not dropped.
- **Dates are built from local time, never UTC.** The hotel is UTC+8; UTC puts every payment before 8 AM on yesterday's sheet.
