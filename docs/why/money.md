# Money — why it works this way

## One price

- **Each room and venue has one price.** The owner: *"the use promo should be gone permanently. because the promo price should be the new original price."* There is no sale mode and no crossed-out second price.
- The database still has two columns (`base_price`, `promo_price`); Settings writes the same figure into both so they cannot drift.
- **A booking sold at an older price keeps it** through its own `contract_rate_override`. Ten old bookings were pinned this way before the two prices were merged, so their bills still reprint as sold.

## The money is the status

- **Unpaid / Partly paid / Paid is worked out from the payments recorded. It is never typed.** There is no payment-status control anywhere. To fix a mistake, remove the wrong payment and everything recomputes.
- **What is owed = the stay + the food on the order slips − the money received.** One function (`recomputeBalance`) does this for the quick view, check-in, check-out, the order slips, and (since 2026-10-03) extending a stay.
- **The deposit is agreed on the stay alone.** A lunch eaten later must never raise what the desk asks for on arrival.
- **The booking form's total uses the same pricing as the bill** (since 2026-10-03). It used to have its own sum, which skipped the staff discount and the agency's price.

## Payments and receipts

- **One payment, one numbered receipt** (`PR-YYYYMM-NNN`). The number is stored on the payment — never worked out from its position, because removing one payment would renumber the rest, and staff quote these numbers to guests.
- **Cancelling a booking keeps the money it received** (Sebastian, 2026-10-17: *"make sure it stays"*). Today's money and the Earnings report both count it, on the day it was paid. In the Earnings report it adds no night.
- **Every payment carries its own method.** A guest may pay the deposit in cash and the rest by GCash; each receipt names its own.
- **One payment for several rooms is written onto every room it paid for.** The owner: *"if there are more than one rooms booked at the same time, the staff would need to find the room that holds the payment receipt."* Each room also keeps its own share. A reprint from any room shows the money actually handed over.
- **A receipt number belongs to one payment across the whole hotel.** Numbers were once counted per booking, so two fresh bookings both got `…-001`. Walk-in restaurant receipts had the same fault until 2026-10-03; they now look at every order slip and every booking.
- **Staff labels read like plain speech:** big green "Paid", amber "Partial · ₱X left", red "Owes ₱X". The most important number ("Who owes right now") sits at the top of money lists.
- **Profit should feel like a reward** — bold, vibrant green, not a flat theme colour.
- **Payments are written on the billing statement** (Sebastian, 2026-10-20: *"most of the time the staff likes to work on payments on the guest billing paper. that's what they are used to"*). Receive opens the statement; the payment goes on a blank line under the payments received — the day, the amount, how they paid — the way the paper is filled in. The day can be an earlier one, for money taken while nobody was at the desk. He picked the "Blank line" design from three (a pad under the paper, ticking the paper's Payment boxes). The payment details, policies and signatures are for the paper only: *"This should only show up when printed."* A stay billed to an agency, and a bill of several rooms, keep the Receive box, since a payment there is shared between rooms.
- **Rooms on one bill show one amount due** (Sebastian, 2026-10-20: *"if a group of reservations share a single guest billing, then it should share amount due … each reservation should share the same info"*). Each room's pill, hover card and booking window show what the whole bill still owes (`asBill`), not that room's part; each room still stores its own share, which the reports add up. A "rooms" tag beside the figure opens the bill's rooms in a small bubble (his pick of three: a bubble, badges in the header, arrows to step through). A payment written on the bill is shared out across its rooms on one receipt, as the booking form does.

## Breakfast

- **Breakfast belongs to the room, and it is charged once a night at that room's own breakfast price.** The desk types the price per room in Settings. Sebastian, 2026-10-17: *"it's supposed to be charged per night, so someone books for 2 nights and they want breakfast, and breakfast is 300. then the charge should be 600."* Until then it was one charge for the whole stay. A short stay is one breakfast.
- **A room with no breakfast price asks for one in the booking form** (the owner, 2026-10-16): its dashed "Set price" chip opens into a ₱ box, the price is saved on the room, and breakfast goes on.
- **A room with no breakfast price sells no breakfast.** The owner: *"remove every trace of 150 per head for breakfast calculations since the staff decides what the breakfast price is."* The old ₱150-per-head fallback once charged a guest ₱300 for breakfast they were never offered.
- **A guest who booked breakfast is asked every morning what they want** (the owner, 2026-10-04). The staff write the choice down for the kitchen; it does not change the price. **Since 2026-10-08 it really reaches the kitchen:** Sebastian asked for a *"satisfying sent to kitchen card"* after pressing Serve, and until then nothing on the kitchen's screen read a breakfast at all. A served breakfast is now a card on Restaurant → Kitchen with one "Order ready" button. The window itself was redrawn the same day to read like the restaurant's menu (dish, dotted line, how many), *"Save"* became *"Serve"*, and every tap in it is animated — his general rule: *"aside from core functionality, I prioritise satisfying user experience over everything else."*
- Two earlier ideas are dead: ₱150 × beds, and per person per day. Old bookings that recorded breakfast day by day keep what they were charged.

## Discounts and extras

- Staff discount: none, 20%, 10%, or a custom amount. On the bill it is its own negative row so the column adds up in front of the guest.
- **A custom (flat) amount off is taken once for the whole booking, however many rooms or venues it has** (Sebastian, 2026-10-06: two venues worth ₱50,000 with ₱6,200 off came to ₱37,600; he expected ₱43,800). Each unit is its own row and is priced on its own, and every row had been given the full amount, so it came off once per unit. It is now **shared out in proportion to what each unit costs** (`walk-in/discountSplit.ts`, the same split that divides one payment across rooms), each row keeps only its share, and the shares add back up to exactly what was typed. A percentage needs no sharing — 20% of each part is 20% of the whole. The edit form shows the shares added up. Bookings saved before this fix still carry the full amount on every unit; they are left as they are.
- **The bill has one `Discount` row, however many rooms were given one** (Sebastian, 2026-10-06: *"just use 1 row for the discount and just show the total of the discount for all"*), and it says `Discount`, not `Staff discount`. Each room still carries its own share in its booking; the rows are joined when the bill is made (`mergeDiscountRows`), and keep the percentage in their words only when every room had the same one.
- The gap between a room's night price and its hours price is **never** printed as a discount.
- Extras (foam, pillow, blanket, towel, tables, chairs, tent) are entered once for a group and go on the first room or first venue only.
- **The desk can add a charge on the bill itself** (Sebastian, 2026-10-20: *"staff should also be able to add a bill in the billing statement. for example: DINNER - 300 pesos"*): what it is for and how much, under Extras. It is kept in `event_addons.charges` and priced with everything else. A charge put on by mistake comes off with its × (he asked, *"how do I remove a charge I just added?"*), with Undo for five seconds.

## Lessons that cost real money

- **Every place that re-prices a booking must be handed every fact about it** — breakfast, short-stay hours, discount, agency rate. Each time one was left out, a screen charged a different stay than the one stored (a 3-hour stay billed as a night; a booking stored ₱600 short).
- **A report of money must never lose money in silence.** Money with no dated receipt is shown separately, not dropped.
- **Dates are built from local time, never UTC.** The hotel is UTC+8; UTC puts every payment before 8 AM on yesterday's sheet.
