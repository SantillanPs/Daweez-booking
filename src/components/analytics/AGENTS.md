# Analytics (src/components/analytics) AGENTS.md

## Purpose

The Earnings Report screen and its parts: the filter bar that owns the period and the view, the two ways of reading the money (spreadsheet and visuals), and **Print daily report** — the hotel's end-of-day sheet, which is an *action* here and deliberately not a screen.

## Ownership

- Primary Owner: Frontend Engineers / Antigravity Agent
- Scope: `src/components/analytics/**`. The screen that assembles them is [AnalyticsTab](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/components/AnalyticsTab.tsx), which sits in `src/components/` (see the parent doc).

## Local Contracts

    - [AnalyticsTab](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/components/AnalyticsTab.tsx) — the `/analytics` screen, and **it holds every default** (the owner's ruling, 2026-09-30: *"make the spreadsheet and daily as the default"*): the view opens on **Spreadsheet** and the period opens on **Daily**, where it used to open on Visuals and Monthly. The reading was checked with him before it was built — his words name **two separate defaults**, one for the view and one for the period, not two views. It reads bookings, rooms, venues and expenses from `useDashboardData()`, reads **every tab line once** (`useQuery(['tab-lines'], getAllTabLines)` — food and bar money lives on the tabs, not the bookings, k69 part E), hands it all to [useAnalyticsCalculations](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/hooks/useAnalyticsCalculations.ts), and renders one of the two views. **It shows a spinner until the shared data has loaded** (`isLoading || !calculations`), which is why only this screen and Expenses feel slow to open — see the parent doc's note; every other tab paints at once.

    - [AnalyticsFilters](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/components/analytics/AnalyticsFilters.tsx) — the one toolbar: the period chips on the left (`Daily · Weekly · Monthly · Yearly · Custom`, with the two date boxes only while Custom is picked) and, on the right, **Print daily report**, the view switch (`Switch to Visuals` / `Switch to Spreadsheet`), and **Include pending bookings**. The print button is styled from the same tokens as the switch — `bg-card border-soft text-muted` — never the raw Tailwind palette the switch still carries, so it adds no lint warning.

    - [AnalyticsSpreadsheetView](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/components/analytics/AnalyticsSpreadsheetView.tsx) + [AnalyticsVisualsView](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/components/analytics/AnalyticsVisualsView.tsx) — the two ways of reading the same calculations: the tables, and the charts. The charts pull `@tanstack/charts` and its scale modules, which is why those five packages are listed in `vite.config.ts` → `optimizeDeps.include`; leaving them out makes Vite discover them on first navigation and answer `504 Outdated Optimize Dep`.

    - [DailyReportModal](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/components/analytics/DailyReportModal.tsx) — **Print daily report**, opened from the toolbar. It is an action, not a page (the owner's ruling, 2026-09-30: *"the daily report should be something like a 'print a daily report' type of feature. not a page"*), which replaced the standalone `/daily-report` tab and removed the top-nav item that went with it. **The old address did not die with it**: `router.tsx` keeps `/daily-report` as a route that only redirects to `/analytics`, because the owner's own browser was still sitting on that URL — a moved page keeps its address working, and a bookmark or a back-button must not land on "not found". The hotel's need is narrower than a screen: once a day somebody wants **that day's sheet on paper**, so this holds only the day (`localToday`, built from local parts — never `toISOString()`, which is UTC and is a different day for the first eight hours of every UTC+8 morning, exactly when the desk takes money) and the A5 print (injected for the moment of printing, exactly as `PrintInvoiceModal` does it). The figures come from [dailyReport.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/utils/dailyReport.ts) and the paper from [DailyReportDocument](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/components/billing/DailyReportDocument.tsx) — **the move changed neither**. It reads the tabs fresh (`useQuery(['tabs'], getTabs)`) because a tab settled at the counter is money the sheet must show and it belongs to no booking, and it states the one thing the sheet cannot: when a booking holds money with **no dated receipt** (`undatedCount`), that money belongs to no day, and a money report must never drop a peso in silence.

## Work Guidance

- **The Daily Report has no screen.** Do not give it a route, a tab or a third view — it is a print action on this toolbar. The owner asked for a page first, then ruled it down to the action after seeing it drawn.
- **Defaults live in `AnalyticsTab`**: Spreadsheet, and Daily.
- **A period means what its chip says.** The range badge beside the title is the promise the chips make, so `Daily` must be **one day** — it used to be seven, and the owner read the badge `Sep 24 – Sep 30` under a lit **DAILY** chip and asked *"this is supposed to be daily. why is this doing weekly?"*. The ranges themselves live in [useAnalyticsCalculations](file:///c:/Users/dev4s/Documents/Programming/Daweez-booking/src/hooks/useAnalyticsCalculations.ts) (see the hooks doc for the local-date rule that goes with them).

## Verification

- `npx tsc -b --force` and `npm run lint` (see the root `AGENTS.md`).

## Child DOX Index

None.
