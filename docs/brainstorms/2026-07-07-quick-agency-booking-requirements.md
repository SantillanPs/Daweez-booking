# Quick Agency & Partner Booking - Requirements

## 1. Problem & Outcome
**Problem:** Booking a corporate partner or travel agency currently forces hotel staff to go through the standard 3-step walk-in guest wizard. This requires filling in individual guest details, roommates, companion lists, custom phone/email entries, plate numbers, and downpayments, which is unnecessary friction when booking simple pre-negotiated corporate blocks.

**Outcome:** Provide a fast, single-screen "Quick Agency Booking" form that allows staff to choose an agency/partner preset, set check-in/check-out dates, choose the rooms, and immediately confirm the booking with ₱0 downpayment (since corporate accounts are billed via invoice statements).

---

## 2. Proposed User Experience
- **Modal Toggle:** When the "New Reservation" modal opens (via clicking date cells or the "+ New Booking" button), a clear segment tab bar at the top displays:
  - **Walk-in Guest** (Existing 3-step wizard)
  - **Agency & Partner** (New quick single-screen form)
  
- **Quick Single-Screen Form Fields:**
  1. **Partner Account Selection:** A dropdown list of all configured corporate partners and travel agencies.
  2. **Rooms/Venues Selection:** A list of checkboxes showing available rooms and venues. Pre-filled based on the timeline drag/selection.
  3. **Dates:** Check-In and Check-Out date fields (pre-filled from timeline click/drag, editable).
  4. **Primary Guest Name (Optional / Pre-filled):** Auto-populates with `"{Partner Name} Guest"` (e.g. *"Getz Pharma Guest"*). Staff can override this to type a specific representative's name if they wish.
  5. **Vehicle Plate (Optional / Pre-filled):** Pre-populates with the default vehicle plate registered under the partner profile.
  
- **Submission Rules:**
  - Bypasses step 2 (roommates/companions) and step 3 (amenities/add-ons).
  - Defaults downpayment to ₱0 and balance due to the entire contracted rate amount.
  - Automatically records the `partner_deal_id`, `company_name`, `vehicle_plate`, default invoice style, and breakfast inclusion preferences.
  - Resolves pre-negotiated room/venue rate overrides and bypasses standard loyalty or website discounts.
  
- **Success Screen:**
  - Shows a confirmation success page upon saving.
  - Displays the sequential invoice serial number generated (e.g., `GRB-2026-07-0014` or `GRF-2026-07-0014`).
  - Displays a **Print Invoice** action button that immediately triggers the A4/Letter print modal.

---

## 3. Out of Scope
- Custom amenities or individual room-add-ons during quick booking (these can be added later by editing the reservation if needed).
- Split-payment downpayment requirements for corporate contracts.

---

## 4. Verification Plan
- **Manual Flow:** Open the timeline calendar, drag/select a date range on Room 1, choose **Agency & Partner**, select **Getz Pharma**, verify the price overrides correctly to the contracted rate (e.g. ₱1,200 instead of ₱1,300), and click **Confirm**. Verify the success screen is rendered with the serial invoice number and print trigger.
- **Automated Compile:** Ensure Vite builds compile cleanly.
