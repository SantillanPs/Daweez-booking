# Hooks AGENTS.md

## Purpose

The stateful data lifecycles the screens share: the realtime booking subscription and the guest tab's read/write cycle.

## Ownership

- Primary Owner: Frontend Engineers / Antigravity Agent
- Scope: `src/hooks/**`.

## Local Contracts

  - [useRealtimeBookings.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/hooks/useRealtimeBookings.ts) — listens to PostgreSQL replication changes over WebSockets and updates the React Query bookings cache in real time through `rowToBooking`. **Its column list must carry EVERY column the app writes — the same list `toBookingRecord` in `utils/db.ts` sends — and is kept in step with the `Booking` type.** A missing field here is not cosmetic: this mapping *replaces* the cached booking, and the cache is what the quick view saves back, so anything left out is silently wiped from the database on the next save. That is precisely how the receptionist's **"Prepared by" name** (bug B2), `actual_check_in`/`actual_check_out`, `payment_records`, `applied_discount`, `notes` (the block reason), `early_check_in_hours`/`late_check_out_hours`, `venue_day_blocks`, `breakfast_days` and `birthdate` were disappearing from live rows. **When a booking column is added, add it in three places: the `Booking` type, `toBookingRecord`, and `rowToBooking`.**


  - [useGuestTab.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/hooks/useGuestTab.ts) — the guest tab's data lifecycle for one booking (k69): reads the tab when the slide-over opens, keeps the **stored** balance honest (a line added while the panel was closed must still reach the bill), and re-reads it after a line is added or removed. It also hands back `resolveTabId`, which opens the booking's tab on the first order, so the panel never has to know whether one exists yet. Extracted into a hook so the already-oversized `ExtendStayModal` did not grow: it writes no booking field except the recomputed balance.

