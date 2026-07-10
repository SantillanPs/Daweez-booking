---
date: 2026-07-10
topic: analytics-view-toggle
type: feat
origin: docs/brainstorms/2026-07-10-analytics-view-toggle-requirements.md
---

# Feature Plan: Analytics View Toggle

## Summary

Implement a view-mode toggle in the Analytics tab allowing users to switch between a spreadsheet-style report (the new default) and the existing visual trends view.

## Problem Frame

The current Analytics view emphasizes charts, which users find confusing for straightforward financial checks. A spreadsheet format showing income, expenses, and profit is strongly preferred. Charts should be hidden by default but accessible via a toggle.

## Key Technical Decisions

**KTD 1: Local state for view mode**
The view mode (`spreadsheet` vs `visuals`) will be managed as local React state within `AnalyticsTab.tsx`. Since this preference doesn't need to persist across sessions or affect other components, local state is sufficient.

**KTD 2: Selective rendering**
In `spreadsheet` mode, we will hide both the "Main Income Breakdown Cards" and the graphical charts (Bar and Donut), leaving only the filters and the "Financial Breakdown Statement" table. This creates a true top-to-bottom P&L report.

## Implementation Units

### U1. Add View Mode Toggle State and UI
- **Goal:** Introduce the `viewMode` state and its corresponding toggle UI at the top of the Analytics tab.
- **Files:**
  - `src/components/AnalyticsTab.tsx`
- **Patterns:**
  - Follow the existing toggle pattern used for "Include Pending Projections" using `ToggleLeft` and `ToggleRight` icons from `lucide-react`.
- **Test Scenarios:**
  - Verify toggle defaults to "Spreadsheet Report".
  - Verify clicking the toggle switches the state between modes.

### U2. Conditionally Render Content Based on View Mode
- **Goal:** Ensure the correct content is shown for each view mode.
- **Files:**
  - `src/components/AnalyticsTab.tsx`
- **Patterns:**
  - Wrap the JSX block containing the income cards and charts with `{viewMode === 'visuals' && (...) }`.
  - The "Financial Breakdown Statement" table should remain unconditionally rendered.
- **Test Scenarios:**
  - In "Spreadsheet Report" mode, verify only the filters and the Financial Breakdown table are visible.
  - In "Visual Trends" mode, verify all charts and summary cards reappear.
