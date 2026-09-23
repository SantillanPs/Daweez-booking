# Utils AGENTS.md

## Purpose

The data and money layer under the whole app: database access with its offline fallback, the pricing engine, the money helpers, receipts, rates and every stored configuration list.

## Ownership

- Primary Owner: Frontend Engineers / Antigravity Agent
- Scope: `src/utils/**` (except the restaurant tab modules, which belong to the restaurant doc).

## Local Contracts

- **Data Operations**:

  - [syncEngine.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/syncEngine.ts) is a barrel re-export. Actual logic lives in domain modules under `src/utils/`:


    - [helpers.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/helpers.ts) — `generateUUID`, `randomUUID` (real RFC-4122), `isValidUUID`, `normalizeVenueId`.


    - [defaultData.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/defaultData.ts) — `DEFAULT_ROOMS` and `DEFAULT_VENUES` seed data.


    - [db.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/db.ts) — All CRUD operations (getRooms, updateRoomRate, getVenues, getBookings, saveBookings, insertBooking, updateBooking, deleteBooking, confirmBooking, getFeeds, saveFeeds) with Supabase primary + localStorage fallback. Supabase writes route through Postgres RPCs (`book_booking`, `update_booking`, `delete_booking`, `confirm_booking`, `cleanup_expired_pending`); business-rule failures (ROOM_UNAVAILABLE / VENUE_UNAVAILABLE / invalid dates) surface to the UI instead of falling back to localStorage. Non-business-rule write failures (e.g. the database being unreachable) fall back to the browser store so the app still saves offline; business-rule failures (ROOM_UNAVAILABLE / VENUE_UNAVAILABLE / invalid dates) surface to the UI. `update_booking`/`delete_booking`/`confirm_booking` are invoked for every stored text id (including non-UUID `manual-…`/`imported-…` ids, since `bookings.id` is a TEXT column), so legacy ids persist correctly; only `insertBooking` normalizes *new* ids to real UUIDs. Sequential invoice numbers retry on unique-violation races. Also `initDB()` for first-run seeding. `updateRoomRate` saves a room's Regular/Promo rate through the `update_room_rate` SECURITY DEFINER RPC (RLS gives anon SELECT-only on `rooms`), falling back to a localStorage override (`l_etoile_rooms_db`) that `getRooms` overlays for offline use.


    - [availability.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/availability.ts) — `isRoomAvailable`, `isVenueAvailable`, `isVenueRangeAvailable` collision detection.


    - [pricing.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/pricing.ts) — `calculatePricing`: client-side pricing policy (**one price**: the nightly rate is the promo figure whenever the unit has one, and `base_price` is only the fallback for a unit without one (card k128 — no sale mode, no crossed-out second price). An explicit **`usePromo: false`** still forces the regular figure, which is how a booking made before the single-price rule keeps the price it was actually made at; 50% reservation deposit, equipment rental rates, event add-ons; legacy `rateMultiplier` retained only as a shim for partner/additional-discount stacking). It also takes `appliedDiscount` (20%/10% percent or flat peso custom from `AppliedDiscount`), `earlyCheckInHours`/`lateCheckOutHours` (₱/hr up to `lateEarlyCapHours` then 1 night; vacation house is always hourly), `venueDayBlocks` (Gazebo/Garden 6-hour day blocks), **breakfast as one charge** — for a room, its OWN breakfast price (`rooms.breakfast_price`, typed by the desk in Settings), charged ONCE for the stay and only for the rooms the desk ticked (card k140). The room's bed count was tried as the rule first (₱150 × beds) and dropped: the staff already know each room's figure, so nothing is multiplied anywhere. A room with no breakfast price sells none, and the form says so instead of charging ₱0; `breakfastRecords` (per-day, per person) and the `breakfastDays` plan-ahead estimate are those fallbacks, and `rates` (a `RateConfig`; defaults to `DEFAULT_RATE_CONFIG`).


    - [promoMode.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/promoMode.ts) — **the sale mode is gone** (card k128): the old `daweez_promo_active` flag, `isPromoActive`/`setPromoActive` and their `storage`/`promo-toggle` broadcasts were deleted, because a second price behind a switch is exactly what let one screen quote a figure and another charge a different one. What is left is `getEffectiveNightlyPrice(regular, promo, promoOn)`, the single place that picks the figure to charge: the promo column holds the real price whenever it has one, and `base_price` is only the fallback for a unit that has never been given one. Only the **Log old booking** backfill still passes `promoOn: false`, because typing in a past paper booking really does mean choosing the Regular figure.


    - [otaSync.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/otaSync.ts) — `runSimulatedOTASync` for iCal feed ingestion. Mock OTA booking injection is gated behind `VITE_ENABLE_MOCK_SYNC` (off by default) so the local/offline fallback never fabricates fake bookings; the fallback is non-destructive.


    - [seedData.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/seedData.ts) — `seedFutureMockData` for testing with June–Dec 2026 bookings.


    - [partnerDeals.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/partnerDeals.ts) — Partner deal CRUD with Supabase/localStorage dual path.


    - [expenses.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/expenses.ts) — Expense categories and expenses CRUD with Supabase/localStorage dual path.


    - [bookingMoney.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/bookingMoney.ts) — Plain-language payment views for staff: `getPaymentView` (Paid / Partial · ₱X left / Owes ₱X / Not paid — the amount stays IN this label for the bookings list, where the badge is the only place the money appears), `paymentStatusWord` (the same status with **no amount in it**, for the quick view whose card shows the money as its own big number, so one figure never reads as two), `paymentPlanLabel`, `hasPaymentRecorded` (true once any money has landed), `isOwed`, `hasOutstandingBalance` (the money gate: it blocks **check-in**, where the balance is received on arrival, and still guards check-out), `amountToPayNow` (what to RECEIVE now — the agreed 50% deposit or the full amount while nothing is paid, switching to the outstanding balance once a payment is recorded, so a settled deposit never shows ₱0 and hides money still owed), plus `PAYMENT_BADGE_CLASSES` (vibrant green paid, amber partial, red owes).


    - [paymentMethod.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/paymentMethod.ts) — the one place that decides what a payment method is: `paymentKind` / `paymentMethodLabel` / `methodNeedsReference` (whole-word matching, so `'gcash'.includes('cash')` can never tick Cash). Receipts and statements read the method belonging to each recorded payment (`record.method` through these helpers), never the method the guest merely agreed to at booking time.


    - [receiptNumber.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/receiptNumber.ts) — `nextReceiptNumber` (assigns the stored `PR-YYYYMM-NNN` number when a payment is recorded), `nextTabReceiptNumber` (the same for a **walk-in tab**, which has no check-in month to borrow, so today's LOCAL month is used — never UTC, which would report the previous month for the first eight hours of a new month in UTC+8), `receiptNumberFor` (shows it, falling back to a derived number for payments recorded before numbering), and `paymentBreakdown` (splits money received into a booking-time deposit plus recorded receipts so a receipt's Previous Balance is right for legacy bookings too).


    - [statement.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/statement.ts) — `buildStatement`: turns a booking (and any related bookings sharing an invoice number) into structured line items + payment totals for the printable Guest Billing Statement (stay rows, one row per per-day breakfast served, extra linen/rental equipment, venue excess hours, event add-ons, early/late check-in-out, staff discount), reusing `calculatePricing` (and taking early check-in hours through `chargeableEarlyHours`, so the printed bill only carries them once the stay is checked out — the screen and the paper must never disagree). `dateIssued` carries the bill date + time. Its `amountDue` is what the guest hands over at this point — the agreed 50% deposit while nothing is paid, otherwise what is left (`amountToPayNow`, never the whole stay) — with `balanceAfter` for the rest and `paymentPlan` carrying the guest's own choice through to the printed page. Its `tabLinesByBooking` input (k69) prints the guest's food and bar lines under the room as `Restaurant & bar · <item>` rows and adds their total to the Sub-Total, so the paper agrees with the balance the screen shows; the same total is passed to `amountToPayNow` so the printed deposit stays worked out from the stay alone.


    - [rateConfig.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/rateConfig.ts) — editable `RateConfig` (late/early per hour + cap, staff-editable breakfast menu (`breakfastMenu`: name + price per item; default matches the paper form — Hotsilog, Bangsilog, Lumpiasilog, Cornsilog, Milo, Hot Coffee), venue hourly, Gazebo/Garden day-block hours (6) + rate, security deposit, standard check-in/out times, and extras/rental rates — foam/pillow/blanket/towel, big/small table, chair, mineral water, tent) with `DEFAULT_RATE_CONFIG`, `getRateConfig`, `saveRateConfig` (localStorage).


    - [paymentAccounts.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/paymentAccounts.ts) — where the guest sends a downpayment (GCash name/number + bank name/account). Defaults match the official Daweez form (GCash Narlina D. · 0910-793498, BPI Daweez Pension House · 5636-0544-12); editable in Settings → Rates via `getPaymentAccounts`/`savePaymentAccounts`, and shown on the guest portal, chatbot, printed Guest Billing Statement, and the booking Money step.


    - [checkInOut.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/checkInOut.ts) — `computeCheckInOutHours`: computes early check-in / late checkout hours from the actual check-in/out times against the standard times (default 2 PM check-in, 12 PM check-out), rounding partial hours up. It also holds **`chargeableEarlyHours(booking)`** — the early hours that are **billable yet**: the arrival time is honest the moment it is stamped, but early check-in is *collected at check-out* (the owner's rule, *"just add it to their bill for when they checkout"*), so while `actual_check_out` is empty they are kept out of `recomputeBalance` and off `buildStatement`. Without that gate, checking a fully-paid guest in flipped the badge from `Paid` to `Partly paid` on the spot (a 1 AM arrival is 13 hours early, past the 3-hour cap, so it charges a whole night).


    - [inventory.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/inventory.ts) — hotel inventory items (pillows, blankets, soap, etc.) with `getInventory`/`saveInventory` (Supabase + localStorage dual path).


    - [cleaning.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/cleaning.ts) — cleaning checklist entries (item, room, date, `cleaned_by`, `checked_by`, status) with `getCleaningTasks`/`saveCleaningTasks` (Supabase + localStorage dual path).


    - [bookingBalance.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/bookingBalance.ts) — `recomputeBalance(booking, { rooms, venues, tabTotal })`, the one pure place the money rule lives: **what is owed = the stay + the food tab − the money received**, with the payment status derived from that same figure via `paymentStatusFromMoney` (`utils/bookingMoney.ts`). It replaced the pricing block that used to sit inside `ExtendStayModal`, so the quick view, the check-in/check-out recompute, the breakfast recorder and the tab all agree on the amount. Because the rule is now derived rather than carried over, a charge added to an already-settled booking correctly re-opens it (`paid` → `downpayment`) instead of leaving the badge reading "Paid" while money is owed. **One thing it deliberately does NOT charge yet: early check-in hours** — those go through `chargeableEarlyHours`, so they enter the balance only once the stay is checked out (see `checkInOut.ts`), which is what stops a mid-stay food order from surfacing an extra night on the screen. **`pendingEarlyCharge(booking, ctx)`** returns the money those held-back hours represent — worked out by asking `recomputeBalance` twice (with and without them) rather than re-deriving the ₱/hour-or-a-night rule — so the quick view can show *"₱1,900 goes on the bill at check-out"* without billing it.


    - [toast.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/toast.ts) — the message store behind `Toast`: `showToast(text, tone)` from any screen, `useToastMessage()` for the host. Deliberately a plain module singleton (no provider, no drilled prop), and deliberately **not** `window.alert`.


    - [confirm.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/utils/confirm.ts) — `askConfirm({ title, message?, confirmLabel?, tone? })` returns a promise for the answer, so a destructive call site still reads as one line: `if (!(await askConfirm({ title: 'Delete this expense?', confirmLabel: 'Delete', tone: 'danger' }))) return`. Asking a second question resolves the first as "no" so no caller is left waiting forever.


## Work Guidance

- **Breakfast (cards k140/k142)**: Breakfast is the **ROOM's** choice, never a guest's, and it is **one charge for the whole stay at that room's own breakfast price** — a price the desk types per room in Settings, blank until they do. It is folded into the room rate, so a room with breakfast prints on the bill as ONE line, `Room 6 · Breakfast`, and never as a row of its own. The per-day `BreakfastRecorder` is **retired and not rendered**; the ₱150 × beds idea was dropped when the owner asked for a price per room instead, so **no bed count is used anywhere**. Legacy `breakfast_records` (per-day, per-person) still price old bookings, and the bill prints those rows for a venue booking only.

- **Null-Safe Pricing Reads**: `calculatePricing` treats `null` like `undefined` for `breakfastOrders` (DB round-trips turn missing arrays into `null`); callers passing stored booking fields into the invoice must normalize `null` arrays (PrintInvoiceModal maps `null` → `[]`) so re-priced invoices never crash or invent charges.

- **Local Date Strings (timezone-safe)**: Booking dates (`check_in`/`check_out`) are plain `YYYY-MM-DD` calendar-day strings. Always build them with `dateToString(date)` from `utils/helpers.ts` (local components) — never `.toISOString().split('T')[0]`, which shifts dates back one day in UTC+8. This applies to calendar cell keys, booking creation/confirmation, "today" comparisons (briefing, dashboard stats, bookings list), and date-input defaults/minimums.

- **Offline / Local Fallback**: Code must check `isSupabaseConfigured` and seamlessly fallback to local storage DB endpoints (`l_etoile_bookings_db`, `l_etoile_feeds_db`) to guarantee runtime persistence without a live database.

- **Background Calendar Sync**: Third-party bookings (Airbnb/Booking.com) must sync automatically via iCal feeds in the background upon mounting the application and at regular intervals (5 minutes) thereafter, with a manual OTA Sync trigger as a backup.

