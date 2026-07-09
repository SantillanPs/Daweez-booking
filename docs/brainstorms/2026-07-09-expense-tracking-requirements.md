---
date: 2026-07-09
topic: expense-tracking
---

# Expenses Tracking Requirements

## Summary
A dedicated Expenses tab for staff to log outgoings (amount, date, category, optional notes). Expense categories will be dynamically manageable in the Settings tab, and all logged expenses will automatically deduct from booking revenues in the Analytics tab to show true net profit.

## Key Decisions
**Dedicated Expenses tab over Analytics integration**
Keeping the detailed ledger in a dedicated Expenses tab keeps the Analytics tab focused purely on high-level profit metrics rather than cluttered data entry.

**Shared Access**
Expense records will be visible to anyone with the app passcode, as we currently do not have separate user roles or accounts.

## Requirements

**Data Model**
R1. The system must store `expense_categories` (id, name, created_at) which can be dynamically managed.
R2. The system must store `expenses` (id, category_id, amount, expense_date, notes, created_at).

**Settings & Category Management**
R3. The Settings tab must provide an interface to view, add, rename, and delete expense categories.
R4. Deleting a category should either be prevented if it has associated expenses, or it should perform a soft delete to preserve historical records.

**Expenses Tab**
R5. A new "Expenses" tab must be added to the main navigation layout.
R6. The Expenses tab must contain a form to log new expenses, capturing the amount, date, category (dropdown from active categories), and an optional text note.
R7. The Expenses tab must display a list or table of logged expenses, ordered by date descending.

**Analytics Integration**
R8. The Analytics tab must query the total expenses within the active timeframe filter (daily, weekly, monthly, custom).
R9. The Analytics tab's primary revenue display must subtract total expenses from total booking revenues to calculate and display the true net profit.
R10. The Financial Breakdown table in the Analytics tab should include an aggregated row for Expenses, expanding to show category-level totals.

## Scope Boundaries
- Receipt photo uploads and attachments are deferred.
- Complex accounting features (depreciation, multi-currency, tax splitting, per-user accountability) are out of scope.
