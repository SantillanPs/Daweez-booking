---
date: 2026-07-10
topic: analytics-view-toggle
---

# Analytics View Toggle Requirements

## Summary

This proposes adding a view-mode toggle to the Analytics tab to switch between a top-to-bottom P&L spreadsheet and the existing visual charts. The spreadsheet will serve as the default view, keeping raw financial numbers front-and-center while tucking the trend graphs away.

---

## Problem Frame

The current Analytics tab emphasizes visual charts (bar charts and donut charts) which the user finds confusing and unnecessary for their daily financial checks. They strongly prefer a straightforward spreadsheet format that explicitly details income, expenses, and total profit from top to bottom. However, completely removing the charts eliminates the ability to spot long-term trends if needed in the future.

---

## Key Decisions

**Toggle over new page**
We reuse the Analytics tab rather than adding a new "Reports" page to the main sidebar. This avoids navigation bloat since both modes look at the same underlying financial data.

**Spreadsheet as default**
The spreadsheet mode is set as the default view. This aligns with the user's primary workflow of checking raw numbers quickly without being distracted by visual graphs.

---

## Requirements

- R1. The Analytics tab must display a toggle to switch between "Spreadsheet Report" and "Visual Trends" views.
- R2. The default state of the toggle must be "Spreadsheet Report".
- R3. In "Spreadsheet Report" mode, the visual charts (Revenue Split Over Time, Profit Share) must be hidden, showing only the date filters and the Financial Breakdown Statement.
- R4. In "Visual Trends" mode, the visual charts must be displayed.

### Acceptance Examples

- AE1. When navigating to the Analytics tab, the UI shows the "Spreadsheet Report" view with no charts visible.
- AE2. When clicking the toggle to "Visual Trends", the charts appear.
- AE3. When clicking the toggle back to "Spreadsheet Report", the charts are hidden again.

---

## Scope Boundaries

- Exporting the spreadsheet to CSV or Excel is deferred.
- No new sidebar navigation item will be created for reports.
