# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A staff system for **Daweez Pension House** (Tandag City, Philippines): 10 rooms and three venues (Vacation House, Gazebo, Garden Area). It replaces a paper booking process. Three parts, in priority order: **bookings** (closest to done), **restaurant and bar till**, **stock room**. The staff are not technical — every label is plain everyday English ("Total Money In", never accounting terms), the UI states facts without captions explaining them, and there are no browser `alert`/`confirm` pop-ups (use `showToast` and `askConfirm`).

React 19 + TypeScript + Vite, TanStack Router/Query, Tailwind 3 + DaisyUI, Supabase (Postgres, Realtime, two edge functions). Deployed on Vercel.

## Commands

```bash
npm run dev            # Vite dev server on :5173
npx tsc -b --force     # type check — must exit 0
npm run lint           # must report 0 errors (≈277 Tailwind colour warnings are a known baseline)
npm run build          # tsc -b && vite build
```

There is **no test suite**. Verify changes by running the app against the development database and checking the rows.

## Two databases — change development first

| | Supabase project | Ref |
|---|---|---|
| Live (what the deployed site uses) | `Daweez-DB` | `ctbqxcxqfsrbgzfcmntw` |
| Development | `Daweez development` | `uopxfnyyitoxmyvrgngp` |

- `.env.local` points local work at **development**; the live values are kept there commented out. `.mcp.json` and `vercel.json` still name the **live** ref.
- Apply every schema or function change to development first, test it, and save it as a file in `supabase/migrations/`. Treat live as read-only unless the owner says to promote something.
- **The migration files have drifted from live.** Several were pasted in by hand and two stock functions exist only in the database. Always rebuild `book_booking` / `update_booking` from the definition the database holds (`pg_get_functiondef`), never from an older file. The development database was built from the live catalog, not from the files.
- Development holds setup data only (rooms, venues, settings, menu, stock items). The edge functions are not deployed there, so `sync-ical` console errors on localhost are expected.

## Architecture

### How the app reaches the database

- The app uses the public anon key. "Login" is a passcode checked in the browser that sets a `localStorage` flag — there are no staff accounts yet (board card k74).
- **Bookings cannot be written directly.** anon has SELECT only; every write goes through SECURITY DEFINER functions: `book_booking`, `update_booking`, `cancel_booking`, `delete_booking`, plus narrow single-column writers (`set_booking_agreed_deposit`, `set_booking_stay_hours`). Room prices and `app_settings` follow the same pattern. Tabs, menu, stock, expenses and agencies are written directly.
- **Ids are text** (`room-3`, `venue-gazebo`, `partner-…`). Never cast an id to `uuid` inside a database function. Only `tabs` and `tab_lines` use real uuids.
- Double booking is refused by exclusion constraints on `bookings`; the client check (`utils/availability.ts`) is only an early warning. Cancelled bookings are excluded from both.

### Booking data flow

`utils/db.ts` (reads/writes) → `utils/syncEngine.ts` (barrel re-export) → `hooks/useBookings.ts` (TanStack Query cache + mutations) → `DashboardContext` → tabs. `hooks/useRealtimeBookings.ts` patches the cache from Supabase Realtime.

- **A booking column must be added in four places:** the `Booking` type, `toBookingRecord` (db.ts), the reader in `getBookings` (db.ts), and `rowToBooking` (useRealtimeBookings.ts). The cached booking is what gets saved back, so a column missing from a mapper is wiped on the next save.
- **`update_booking` takes the whole row.** JSON columns sent as `null` are written as empty (the `COALESCE` in the function does not protect them). Any save path that builds a booking from scratch rather than from the cached row must carry over what it does not own — see the edit branch of `createManualBookingMutation`.
- The context exposes `bookings` (active stays; cancelled left out) and `allBookings`. Use `allBookings` only where cancelled bookings matter: the Bookings list, the daily money sheet, and receipt numbering.
- A booking of several rooms is **one row per room/venue, each with its own `invoice_number`** (the column is UNIQUE), tied together by a shared **`group_id`** written by `set_booking_group`. Ask `groupOf(booking, list)` (`utils/bookingGroup.ts`) which rooms belong together — the bill, the edit form and the booking panel all do. The bill carries the first room's number.

### Money

- **One pricing rule:** `calculatePricing` in `utils/pricing.ts`. Everything that re-prices a booking must pass every fact about it (breakfast, short-stay hours, discount, agency rate) or screens disagree. `recomputeBalance` in `utils/bookingBalance.ts` is the one place "what is owed" is worked out: stay + food tab − money received.
- Payment status is derived from recorded payments, never typed. Payments live in `bookings.payment_records` (JSON), each with a stored receipt number `PR-YYYYMM-NNN` that must be unique across all bookings and tabs.
- One payment for several rooms is stored on **every** room with the full `amount`; each room's own slice is `share` / `downpayment_paid`.
- Dates are built from **local** time parts (`dateToString`), never `toISOString()` — the hotel is UTC+8.
- `recomputeBalance` leaves a booking untouched when its room is not in the list it was handed (the page is still loading) and when it is a block. Do not re-price with an empty `rooms` array: `calculatePricing` falls back to built-in sample rooms.
- A stay **billed to an agency** (`isBilledToAgency`: has `partner_deal_id` or `company_name`) may check in and out unpaid; plan `'agency'` takes no money at the desk. It is left out of `isOwed` and listed under "Agencies owe".
- Each morning's breakfast answer is `bookings.breakfast_choices`, written only by `set_booking_breakfast_choices` (`utils/breakfastChoice.ts`). It is a record, not a charge — never put it in `breakfast_records`, which the pricing rule bills.
- A block with no end date is an ordinary block whose `check_out` is `OPEN_END` (`utils/openBlock.ts`).

### Screens

- **Calendar** (`CalendarTab`) is the landing screen and the only way to start a booking: pick dates on the grid, then the action bar offers New booking / short stay / block / log old booking. `WalkInBookingForm` is the single-page booking form (it takes the payment); `calendar/ExtendStayModal` is the booking "quick view" (payments, check-in/out, extend, cancel).
- **Restaurant** (`RestaurantTab`): tabs and tab lines live in their own tables, never on the booking. A room guest's food joins the room bill; a walk-in diner settles at the counter. A menu tap writes a tab line and deducts the dish's recipe from stock (`utils/stock.ts`, `apply_stock_movement`).
- **Stock** (`HousekeepingTab`, still at `/housekeeping`): Stock room · What a dish uses (`/housekeeping/dishes`) · Cleaning checklist (`/housekeeping/cleaning`).
- **The top bar is four tabs — Front desk, Restaurant, Stock, Money — plus a Settings gear.** The list is `TABS` in `DashboardLayout.tsx`; a tab opens on its first screen and the rest are sub-tabs. A new screen goes inside a tab, never a fifth tab, and never in the bottom bar.
- `/reserve` (`PublicReservePortal`) is a public page outside the passcode gate.

## Project docs

- `docs/why/` holds **how the staff work, what they asked for, and their feedback** — the reason a feature is shaped the way it is. Read the relevant file before changing behaviour. Add to it only when there is new staff or owner input; it is not a changelog and not a place for implementation notes.
- `docs/kanban-open.md` is a copy of the open board cards (k-numbers referenced in code comments).
- `NOTES.md` and `TODO.md` are older and partly superseded by `docs/why/`.

## Conventions

- Tailwind only generates classes written as full literal strings; a class built by concatenation renders unstyled.
- Number inputs are free-typing (`NumInput`), never the browser number spinner.
- Printed documents: the guest statement is A5, the payment receipt is a 58 mm thermal slip (`.print-page` / `.print-slip` in `index.css`). Layouts that must hold on paper use fixed columns, not responsive breakpoints.
- Code comments in this repo explain the owner's ruling or the bug that led to the code; keep that style when a change has such a reason.
