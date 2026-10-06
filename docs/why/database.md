# The database — why it is shaped this way

## How the app talks to it

- The staff app uses Supabase's public ("anon") key and a passcode checked in the browser. There are no staff accounts yet.
- Because of that, **bookings cannot be written directly** — every booking write goes through a database function (`book_booking`, `update_booking`, `delete_booking`) that checks dates and overlaps. Room prices and shared settings follow the same pattern.
- **Two bookings cannot overlap on one room or venue** — the database itself refuses it.
- Menu, stock, cleaning, tabs, expenses and agencies are written directly.

## Ids are text

Rooms, bookings, venues, agencies, expenses and stock items use readable ids like `room-3` and `partner-…`. **Any id that reaches a database function must be treated as text, never as a uuid.** This one mistake caused four separate outages: bookings that would not save, room prices that never reached the database, agencies that could not be added, and a week where every booking update failed.

Only `tabs` and `tab_lines` use real uuids.

## The live database has drifted from the files

Several migration files were pasted into the live database by hand, and some were never applied through the normal history. So:

- **Always rebuild `book_booking` / `update_booking` from the live definition**, never from an older file — older files silently drop columns the app writes.
- The two stock functions (`apply_stock_movement`, `reverse_stock_movements`) existed only on the live database until `20261005120000_stock_foundations.sql` saved them as the database holds them. That file has been applied to development only; live still needs it promoted.
- New single columns on a booking (agreed deposit, short-stay hours) got their own small writer function instead of touching the big booking functions, for the same reason.

## Deliberate choices

- **`payment_plan` and stock `reason` have no fixed list in the database**, so a new value needs no migration. Adding "Reservation" as a fourth plan cost nothing.
- **A dish is retired, a tab is closed — neither is deleted** — so past orders still read correctly.
- **Shared settings sit in one key/value table** (`rate_config`, `payment_accounts`, `channel_sync`). The allowed keys are listed in the writer function, so adding a key needs a migration.
- **One-off data repairs live in migration files** (merging the two prices, copying receipts onto every room, tidying duplicate calendar links). They are records of what was done to the live data and must not be replayed on another database.

## When a booking column is added, add it in four places

The `Booking` type, the record sent to the database, the realtime mapper, and the bookings reader. The cached booking is what gets saved back, so a column missing from a mapper is **wiped from the database on the next save**. That is how the receptionist's name, check-in times, payment records and discounts once disappeared from live rows.

## Checks

`npx tsc -b --force` and `npm run lint` must both finish with 0 errors. The lint warnings about Tailwind colours are a known baseline being worked through.
