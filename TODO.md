# Daweez PMS Development Roadmap & Tracker

This document tracks the current implementation status and roadmap progress for the Daweez Property Management System (PMS) staff dashboard.

---

## 1. Group Bookings & Staggered Date Selection
Complete and verify active development on the group bookings branch. This allows reservation of multiple units (rooms/venues) with distinct check-in and check-out dates in a single transaction.

- [x] **Grid Selection Mechanics**: Double-click timeline ranges to select multiple units sequentially.
- [x] **Wizard Compatibility**: Load selected units and their distinct check-in/out dates into the Walk-in Booking Form step wizard.
- [/] **Calendar Staggered Highlights**: Improve timeline UI grid shading to clearly distinguish active staggered date ranges from occupied slots.
- [ ] **Wizard Step 2 Form Updates**: Add edit capabilities within the Walk-in wizard to adjust check-in/out dates per unit after grid selection.
- [ ] **Real-time Collision Validation**: Implement live verification in the database for each individual staggered unit date selection during wizard submission.

---

## 2. Add-ons & Amenities Management
Implement support for add-ons, including bed configuration and dining options.

- [x] **Automatic Breakfast inclusion**: Auto-calculate breakfast at ₱150 per person per night for room bookings.
- [x] **Room Amenities Form**: Extra bed foam (₱200/night), extra pillow (₱50/night), extra blanket (₱50/night), and extra towel (₱50/night).
- [x] **Venue Equipment Form**: Extra table (₱150), extra tent (₱500), and extra chairs (₱15).
- [ ] **Bed Configurations**: Add option to specify room bedding configurations (e.g. Twin, Queen, King, or Extra Bed setup) during booking creation.
- [ ] **Customized Food Options**: Add dropdown selections for breakfast preferences (e.g. Traditional Filipino, Continental, Vegetarian) and beverage selections.

---

## 3. Invoice & Receipt Generator
Build the invoice and receipt generator. This feature needs to reside in the **Bookings Tab** (currently marked under development) and track payment states for bookings and extensions.

- [ ] **Payment Status Registry**: Track three distinct financial states:
  - `Paid`: Downpayments or full settlements.
  - `Unpaid`: Outstanding balances or extension charges due.
  - `Already Paid`: Track history of partial payments (e.g., downpayment completed, balance remaining).
- [ ] **Payment Methods Support**: Support trackable local payment methods (GCash, InstaPay, Bank Transfer) with receipt verification.
- [ ] **Stay Extension Invoicing**: Automatically append stay extension fees and recalculate balance due upon submission.
- [ ] **Receipt Printer View**: Create a clean, print-friendly CSS template layout for invoices.
- [ ] **PDF Generator**: Generate and download static PDF statement sheets for guest records.

---

## 4. Corporate & Government Billing Generator
Create a billing generator for commercial clients that requires commercial invoicing standards.

- [ ] **Company Info Form**: Capture Corporate Name, Address, and Tax Identification Number (TIN).
- [ ] **Purchase Order (PO) / Letter of Intent (LOI) Tracking**: Attach PO/LOI documents or tracking numbers to commercial billing records.
- [ ] **Tax Exemption Exclusions**: Handle government tax-exempt statuses (such as official diplomats or tax-exempt agencies) with toggleable rate adjustments.
- [ ] **Official Receipt (OR) Format**: Match standard BIR invoicing formats in the Philippines.

---

## 5. Profit & Expense Reports
Implement calculated profit and expense reports for staff and administration to view business performance metrics.

- [ ] **Expense Tracker**: Panel to input monthly recurring expenses (e.g., utilities, laundry, staff salaries, amenities stock).
- [ ] **Occupancy Metrics**: Display average occupancy rates, Average Daily Rate (ADR), and Revenue Per Available Room (RevPAR).
- [ ] **Revenue Trends**: Interactive charts showing calculated profit against expenses across:
  - Daily metrics
  - Weekly metrics
  - Monthly metrics
  - Yearly metrics
- [ ] **Export Reports**: Generate CSV/Excel exports for accounting files.
