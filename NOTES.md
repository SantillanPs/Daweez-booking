# NOTES — Daweez Pension House PMS

Reference notes and decision log. This is NOT the binding contract (that's AGENTS.md);
these are the durable things we've learned so nothing is forgotten and all work stays
consistent with the real process.

## Staff booking process (front-desk flow)
1. Guest arrives -> staff fills the **booking form** (`WalkInBookingForm`), a 2-step wizard:
   room/venue + dates come straight from the calendar pick (shown as a top read-only
   **Selected Room / Venue** summary, NOT a step) -> **Step 1** Guest info (Name / Contact No. /
   Nationality / Address) + Companions -> **Step 2** Add-ons & Discount -> read-only Billing
   (Total / Deposit / Balance) -> Receptionist on duty -> Confirm.
2. Guest receives the **Guest Billing Statement** (`PrintInvoiceModal`) — it opens right
   after the booking is created.
3. Guest pays -> staff use the post-create **"+ Record a payment"** control (amount / method /
   reference / date).
4. Staff prints the **Payment Receipt** (`PrintPaymentReceiptModal`) — it opens automatically
   after a payment is recorded.
5. Guest receives the printed receipt.

So: create booking -> print statement -> record payment -> print receipt -> hand to guest.

## Key decisions & learned patterns
- **Paper form is the source of truth.** The booking form, Log old booking, and the printed
  Guest Billing Statement mirror the paper "Guest Registration and Reservation Form" (plain
  labels: NAME / CONTACT NO. / NATIONALITY / ADDRESS; Companion Information; Room Information;
  Billing; Receptionist on duty).
- **Bookings start unpaid (Option B).** The booking form records the plan + total; a new booking
  is saved unpaid (downpayment_paid=0, balance_due=grandTotal, payment_status='unpaid'). Money is
  counted only when staff record a payment -> that's when a Payment Receipt prints. In the form,
  Billing is a **read-only** Total / Deposit / Balance summary; the actual payment (amount + mode
  + reference + date) is taken via the post-create **Record a payment** control.
- **Booking form is only reachable after a calendar selection.** The New booking / Corporate / Log
  old booking buttons are DISABLED until a room/venue + date range is picked on the calendar; the
  form opens PRE-FILLED with that selection. So "pick room + dates" is the ENTRY POINT to the form,
  shown as a read-only summary, not a step.
- **Booking source is automatic (no dropdown).** Staff using the booking form = it's a walk-in / phone
  booking, so source is always 'manual'; there is NO manual "Booking Source" dropdown in the form. (Edit
  mode still preserves a booking's original source.)
- **Log old booking** = single-screen backfill; Total is auto-computed (room rate x nights) with a
  Use Promo Price toggle; contact number optional.
- **Guest Billing Statement** = the bill (what they owe). **Payment Receipt** = the selective record
  of what was actually paid (method, reason, status).
- **Inline required-field validation**: red * label, red border, short red note under the box; fires
  live on blur and again on Save.
- **Money-first display**: plain language, big bold + color-coded (green = paid/hero, red = owes),
  and color + icon per category/column so a user instantly recognizes what they're looking at.
- **Report extras** are an editable flat amount per group (Rooms + Vacation House share one; Garden +
  Gazebo share another) in Settings -> Shared Rates; "Extras + base = category Total".
- **Calendar stale-date bug (fixed)**: memoized cells must compare date/id and be keyed by the day's
  ISO string (NOT array index), or a reused cell can fire a stale, month-shifted date.
- **Tailwind gotcha**: Tailwind's JIT only generates classes written as FULL literal strings; classes
  built by string concatenation (e.g. "text-" + color) or a runtime-built arbitrary value silently
  render unstyled.
