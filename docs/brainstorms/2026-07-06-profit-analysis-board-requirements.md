---
date: 2026-07-06
topic: profit-analysis-board
---

# Profit & Revenue Analysis Board

## Summary
Add a dedicated "Analytics" tab in the main sidebar and bottom navigation to track boutique hotel revenues. The view aggregates and visualizes profits, splitting them between the Pension (Rooms 1-10 collectively) and the individual event venues (Vacation House, Garden Area, Gazebo).

---

## Problem Frame
Boutique hotel managers cannot currently track operational revenue splits or analyze business trends directly inside the PMS dashboard. To assess performance, staff must manually export booking logs or check booking status values in different views, which delays financial reconciliation.

---

## Key Decisions

- **Visual Chart-First Dashboard with Tabular Breakdowns**: Combine modern interactive charts (monthly revenue trends, category splits) with detailed financial data tables to support both accounting accuracy and high-level trend analysis.
- **Unified Pension Aggregation**: Group Rooms 1-10 into a single "Pension" category to match the layout scale of the single-unit venues (Vacation House, Garden Area, Gazebo).
- **Proportional Revenue Distribution**: Distribute booking revenues proportionally across dates when a reservation crosses month/year calendar boundaries (e.g., distributing a stay from June 28 to July 3 night-by-night).

---

## Requirements

### R1. Navigation & Access
- R1.1 A new navigation menu item labeled "Analytics" must be added to the desktop sidebar and mobile bottom navigation layout in `src/components/DashboardLayout.tsx`.
- R1.2 Access to the Analytics tab must be guarded by the same staff passcode authentication gate that protects the dashboard.

### R3. Date Filtering & Views
- R3.1 Filters must allow selecting standard tracking windows: Daily, Weekly, Monthly, Yearly, and Custom Date Range.
- R3.2 A toggle filter must allow users to view Confirmed bookings only (finalized profit) or include Pending bookings (projected revenue).

### R4. Graphical Layout & Charts
- R4.1 A segmented trend bar/line chart must plot revenue over time, colored to distinguish Pension vs. Vacation House vs. Garden Area vs. Gazebo.
- R4.2 A donut chart must illustrate the percentage contribution of each category to the total gross sales.
- R4.3 Interactive tooltips must display metric values when hovering over chart elements.

---

## Scope Boundaries

### Deferred for later
- **Operational Expense Logging**: Tracking utility bills, staff wages, laundry costs, or custom maintenance fees to calculate net profits.
- **Export Formats**: Downloading spreadsheets or PDF accounting logs.

### Outside this product's identity
- **Multi-property Consolidated Group Accounting**: Managing external parent companies or multiple separate hotel sites.

---

## Success Criteria

- **No Overlap Discrepancies**: The total sum of individual category revenues must match the aggregate invoice total of all corresponding bookings in the system database.
- **Responsive Layout**: The visual charts and data tables must render cleanly on mobile viewports without horizontal text clipping.
