# Hooks AGENTS.md

## Purpose

The stateful data lifecycles the screens share: the realtime booking subscription and the guest tab's read/write cycle.

## Ownership

- Primary Owner: Frontend Engineers / Antigravity Agent
- Scope: `src/hooks/**`.

## Local Contracts

  - [useRealtimeBookings.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/hooks/useRealtimeBookings.ts) — listens to PostgreSQL replication changes over WebSockets and updates the React Query bookings cache in real time through `rowToBooking`. **Its column list must carry EVERY column the app writes — the same list `toBookingRecord` in `utils/db.ts` sends — and is kept in step with the `Booking` type.** A missing field here is not cosmetic: this mapping *replaces* the cached booking, and the cache is what the quick view saves back, so anything left out is silently wiped from the database on the next save. That is precisely how the receptionist's **"Prepared by" name** (bug B2), `actual_check_in`/`actual_check_out`, `payment_records`, `applied_discount`, `notes` (the block reason), `early_check_in_hours`/`late_check_out_hours`, `venue_day_blocks`, `breakfast_days` and `birthdate` were disappearing from live rows. **When a booking column is added, add it in FOUR places: the `Booking` type, `toBookingRecord`, `rowToBooking` — and `getBookings`'s own row → `Booking` mapper in `utils/db.ts`, a separate list that ends with `breakfast_records`.** That fourth place is what bites on a **fresh page load**: a column missing there is not wiped (the small writers refuse a blank) but it **reads as absent**, so the app treats the booking as something it is not. `stay_hours` was missing from it, and every short stay opened as an ordinary overnight booking — `Sep 24 → Sep 25 · 1 night`, priced as a whole night, so a guest who had already paid the hours price in full showed as **partly paid** (the owner's bug report, 2026-09).


  - [useGuestTab.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/hooks/useGuestTab.ts) — the guest tab's data lifecycle for one booking (k69): reads the tab when the slide-over opens, keeps the **stored** balance honest (a line added while the panel was closed must still reach the bill), and re-reads it after a line is added or removed. It also hands back `resolveTabId`, which opens the booking's tab on the first order, so the panel never has to know whether one exists yet. Extracted into a hook so the already-oversized `ExtendStayModal` did not grow: it writes no booking field except the recomputed balance.


  - [useBookings.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/hooks/useBookings.ts) — the booking write path (`createManualBooking`, plus the guest portal's own create). **Whatever the row stores, the price it is SAVED with must be told**: `createManualBooking` runs `calculatePricing` once for both create and edit, and that call must receive every flag the booking carries — `breakfastIncluded` (the room's own breakfast charge, card k140), `stayHours` (a short stay is one charge, never nights × rate) and `appliedDiscount`/`earlyCheckInHours`/`lateCheckOutHours`/`venueDayBlocks`/`breakfastDays`. `breakfastIncluded` was missing, so every new booking was stored owing the room alone while `breakfast_included` was set to `true` on the row: GRF-2026-09-0014 (Room 6, breakfast ₱600) held `balance_due` ₱1,800 against a ₱2,400 stay. The printed bill re-prices the saved booking — it *does* pass the flag — so the paper showed Sub-Total ₱2,400 with an **Amount Due of ₱1,800** copied from that short balance, the badge read *Owes ₱1,800*, the check-in gate let the guest in on that figure, and ₱600 reappeared the moment check-in re-priced the stay (`utils/bookingBalance.ts`, which passes the flag correctly). A **Deposit** booking lost half of it too. The lesson is the same one the short-stay rule carries: **a re-pricer that is not handed every flag prices a different stay than the one stored.**

