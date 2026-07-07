---
date: 2026-07-07
topic: agency-deals-and-corporate-billing
---

# Agency & Partner Deals and Corporate Invoicing

## Summary
Proposes a configuration panel in the Settings tab to manage pre-negotiated corporate rates and preset details for partner agencies (companies, governments, universities). Integrates these presets into the walk-in booking wizard to auto-populate guest fields and override daily rates. Implements standard print layouts for "Guest Folio" and "Guest Registration and Billing" with sequential invoice numbering.

---

## Problem Frame
The hotel frequently deals with corporate clients, governments, and university accounts that operate on pre-negotiated fixed daily rates that bypass standard dynamic pricing (such as peak markups or regular discounts). Currently, staff must manually input the company name, vehicle plate, billing address, and manually adjust the rate for every single booking. Additionally, these partners require formal invoices (either a Guest Folio showing company billing or a Guest Registration and Billing statement) that must be styled to match official print templates, which are currently stubbed in the system.

---

## Key Decisions

- **KD1. Partner Presets in Settings:** We will store agency profiles in a new `partner_deals` table. Each profile contains default contact details, partner type, address, default breakfast status, default invoice style, and a custom room rate override map (`room_id` -> `rate`).
- **KD2. Dynamic Form Loading:** In `src/components/WalkInBookingForm.tsx`, selecting a partner deal from a new dropdown will instantly fill all guest/company details and lock selected room rates to the contracted prices.
- **KD3. Dual Print-Ready Layouts:** We will render two printable designs directly from the staff dashboard (supporting check-out/billing modals) using clean `@media print` print-styling matching the real-world paper invoice examples.
- **KD4. Sequential Monthly Invoice Numbers:** Auto-generate invoice/folio serial numbers (e.g., `GRB-2026-07-0048` or `GRF-2026-07-0048`) based on the sequential count of checked-in bookings in that specific year/month.

---

## Requirements

**Partner Profile Settings**
- R1. Provide a manager interface under a new "Agency & Partner Deals" section in the Settings tab.
- R2. Enable creating, updating, and deleting partner profiles with fields: Company Name, Partner Type (Agency, Company, Government, University, Other), TIN, Address, Contact No, Email, Default Vehicle Plate, Default Guest Count, Default Breakfast (W/ Breakfast, W/O), and Default Invoice Type (Folio, Billing).
- R3. Allow mapping specific rooms/venues to custom contracted rates (in PHP) within each partner profile.

**Booking Walk-In Form Integration**
- R4. Render an "Agency Preset" dropdown at the beginning of the walk-in wizard.
- R5. Auto-populate guest/company name, address, contact, email, and vehicle plate fields when a preset is loaded.
- R6. Automatically apply the custom contracted rate when a room is selected, overriding default pricing calculations, and default the breakfast checkbox/addons based on the preset definition.
- R7. Store the selected partner ID, company name, vehicle plate, invoice type, breakfast status, and contracted rate override directly on the booking record.

**Billing & Printable Invoices**
- R8. Implement the printable Guest Registration and Billing layout (GRB) containing headers, company info, guest details, breakfast state, vehicle plate, check-in/out dates, accommodation ledger with discount breakdown, Less Downpayment, Balance, prepared-by signature, and Landbank/GCash payment instruction blocks.
- R9. Implement the printable Guest Folio layout (GRF), hiding the Landbank/GCash payment instruction blocks at the bottom and substituting the title.
- R10. Auto-generate the unique serial number (e.g., `GRB-2026-07-0048` for billing, `GRF-2026-07-0048` for folio) using the check-in year, month, and sequence number of the booking.
- R11. Style the printable invoice modal/page using CSS print rules (`@media print`) so all action buttons, headers, and sidebar components are hidden, and the invoice table renders perfectly on standard A4 pages.

---

## Scope Boundaries
- **Deferred for later:** Consolidated monthly invoicing across multiple bookings (each booking will be printed/billed as an individual Guest Folio or Statement of Account).
- **Outside this product's identity:** Self-service partner booking portal. All reservations are made by hotel staff.

---

## Dependencies / Assumptions
- **Assumptions:** The rooms listed in the partner presets map directly to the existing standard room IDs (`room-1` through `room-10`, `venue-gazebo`, `venue-vacation`, etc.).
- **Dependencies:** Schema update to add `partner_deals` table and additional columns to the `bookings` table.

---

## Outstanding Questions
- **Deferred to Planning:** The exact UI layout of the "Agency & Partner Deals" list in the Settings tab (e.g., whether to use a side-by-side split screen or an inline table editor).
