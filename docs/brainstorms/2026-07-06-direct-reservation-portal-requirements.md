---
date: 2026-07-06
topic: direct-reservation-portal
---

# Direct Reservation Portal

## Summary
Proposing a public-facing, unauthenticated booking page `/reserve` allowing guests to check real-time availability, select a room or event venue, input stay details with a GCash reference code, and submit a reservation that enters the PMS as a pending booking for staff confirmation.

---

## Problem Frame
Currently, the PMS is strictly an internal administrative tool. For direct channels like Facebook Messenger and phone calls, guests must communicate back-and-forth with staff to check availability and rates. Staff then manually enter the booking. This creates a high operational burden, slow response times, and double-booking risks during high-traffic inquiry periods. Giving guests a self-service link to book available dates directly eliminates this friction.

---

## Key Decisions
- **Manual Downpayment Verification:** Rather than integrating complex, expensive merchant payment gateways, guests manually input their GCash or bank reference code when booking. Staff verify this code against their payment records before confirming the stay.
- **Unauthenticated Booking Route:** The `/reserve` URL is configured as a public route bypass in the router, ensuring it is accessible to any external user without a PMS login.
- **Automatic 20% Discount for Direct Link Bookings:** Bookings submitted via the public portal are marked under the `'website'` channel, automatically qualifying them for the 20% direct reservation discount.

---

## Actors
- A1. Guest: Public client browsing units, inputting reservation data, and submitting payment proof.
- A2. Staff: Back-office administrator verifying GCash reference numbers and confirming reservations.
- A3. PMS System: Backend database tracking availability and displaying pending reservations.

---

## Key Flows
- F1. Guest Self-Service Booking Flow:
  - **Trigger:** Guest opens the shared `/reserve` URL in a browser.
  - **Steps:**
    1. Guest selects desired Check-in and Check-out dates.
    2. System queries all existing bookings and filters rooms and venues to display only vacant units.
    3. Guest selects a vacant room or venue card (showing original vs. 20% discounted price).
    4. Guest fills in contact info (Name, Email, Phone), number of companions, and copy-pastes their GCash transaction reference code.
    5. Guest clicks "Submit Reservation" and sees a success confirmation screen.
  - **Outcome:** A new booking is created in Supabase with `status = 'pending'`, `source = 'website'`, and the reference code stored in `event_addons.payment_reference`.

- F2. Administrative Verification and Confirmation Flow:
  - **Trigger:** Staff views the timeline grid in the PMS.
  - **Steps:**
    1. Staff identifies a pending booking highlighted in yellow on the timeline.
    2. Staff clicks the pending booking node to open the reservation details modal.
    3. Modal displays guest info and GCash reference code.
    4. Staff verifies the transaction code in their GCash account.
    5. Staff clicks "Confirm Reservation".
  - **Outcome:** Booking status is updated to `confirmed` in Supabase, updating the timeline cell to green and locking the calendar slot.

---

## Requirements

### Public Route & Layout
- R1. Router must define an unauthenticated public route at `/reserve`.
- R2. Public layout must be responsive, mobile-optimized (optimized for Facebook Messenger's in-app webview), and use the cream-gold premium theme.
- R3. Portal must verify availability against Supabase bookings in real time, hiding fully booked or blocked units for the chosen date range.

### Booking Wizard Workflow
- R4. Wizard must guide the guest through date selection, vacant unit selection, guest detail entry, and payment reference collection.
- R5. Guest detail form must require Guest Name, Email, Phone, and the GCash/payment reference code before submission.
- R6. Submission screen must display an invoice summary showing the 20% Direct Booking Discount and the 50% downpayment due.
- R7. Success state must render a clean confirmation screen displaying the auto-generated Booking ID and next steps.

### Supabase Persistence & Pricing Integration
- R8. Successful submissions must insert a new record into the `bookings` table with `status = 'pending'` and `source = 'website'`.
- R9. Payment reference code must be persisted inside the `event_addons` JSONB under the key `payment_reference`.
- R10. Database save operations must execute transactional integrity checks to prevent double-booking if two guests submit for the same unit simultaneously.

### Admin Validation & Confirmation Panel
- R11. Timeline calendar in the PMS must highlight pending bookings in a distinct yellow warning style.
- R12. Details modal for pending bookings must display the GCash reference code prominently.
- R13. Details modal must render a "Confirm Reservation" button for pending bookings that calls the confirmation endpoint to change the status to `confirmed`.

---

## Scope Boundaries
- **In Scope:**
  - Public `/reserve` page with date selection and available units display.
  - Guest details and payment reference input fields.
  - Dynamic invoice summary with 20% website discount.
  - Live timeline grid highlighting of pending bookings in yellow.
  - Admin modal confirmation button for pending bookings.
- **Deferred for Later:**
  - Integrated GCash/bank payment gateway checkouts (merchant APIs).
  - Customer accounts, booking history portals, or login dashboards.
  - Automated transactional SMS or email notifications.
  - Multi-room reservations in a single checkout session.

---

## Acceptance Examples
- AE1. Overlap Prevention:
  - **Given:** Room 5 is booked from July 10 to July 15.
  - **When:** A guest searches for dates July 12 to July 14 on `/reserve`.
  - **Then:** Room 5 must not be displayed in the list of available units.

- AE2. Discount Verification:
  - **Given:** A guest selects Room 1 (standard base rate of ₱2,000/night) for a 2-night stay on `/reserve`.
  - **When:** The invoice summary renders.
  - **Then:** Original rate shows ₱4,000, Direct Discount shows -₱800 (20%), Subtotal shows ₱3,200, and Downpayment Due shows ₱1,600 (50%).
