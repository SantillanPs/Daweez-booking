# Supabase Backend AGENTS.md

## Purpose

This directory contains the database migration schema definitions and Supabase Edge Functions for external channel synchronization (iCal feeds).

## Ownership

- Primary Owner: Backend Engineers / Antigravity Agent
- Scope: Database tables, row-level security (RLS) policies, database performance indexes, and serverless Edge Functions.

## Local Contracts

- **Database Schema**:
  - [schema.sql](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/supabase/migrations/schema.sql), [01_agency_deals_and_billing.sql](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/supabase/migrations/01_agency_deals_and_billing.sql), and [20260801120000_add_guest_details_and_venues.sql](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/supabase/migrations/20260801120000_add_guest_details_and_venues.sql) define the tables. Two newer migrations harden the data layer:
    - [20260816120000_enforce_no_double_booking.sql](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/supabase/migrations/20260816120000_enforce_no_double_booking.sql) — adds `btree_gist`, a normalized generated `venue_key` column, and Postgres exclusion constraints so overlapping bookings for the same room/venue are impossible server-side.
    - [20260816130000_secure_booking_writes.sql](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/supabase/migrations/20260816130000_secure_booking_writes.sql) — revokes anon INSERT/UPDATE/DELETE on `bookings` and routes all writes through SECURITY DEFINER RPCs (`book_booking`, `update_booking`, `delete_booking`, `confirm_booking`, `cleanup_expired_pending`) that enforce date order + overlap checks atomically.
    - [20260816140000_add_payment_status.sql](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/supabase/migrations/20260816140000_add_payment_status.sql) — adds a nullable `payment_status` enum (`unpaid`/`downpayment`/`paid`) to `bookings` and threads it through `book_booking`/`update_booking` so payment state survives across tabs/refreshes.
    - [20260816150000_fix_booking_rpc_room_id_type.sql](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/supabase/migrations/20260816150000_fix_booking_rpc_room_id_type.sql) and [20260816160000_fix_booking_rpc_id_type.sql](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/supabase/migrations/20260816160000_fix_booking_rpc_id_type.sql) — treat `room_id` and `id` as TEXT in the booking RPCs (both columns are VARCHAR and hold legacy ids like `room-1`/`imported-…`, not valid UUIDs). Without these, every `book_booking`/`update_booking` call crashed and writes silently fell back to localStorage. `confirm_booking`/`delete_booking` now take `text` ids.
    - `rooms`: Store hotel room configuration, capacity, pricing, and images.
    - `venues`: Store event venue configuration, capacity, pricing, and details (Gazebo, Vacation House, Garden Area).
    - `bookings`: Active and pending customer bookings. Includes table constraints like `check_in < check_out`, status values, sequential invoice numbers, guest demographics, and corporate partner deal fields.
    - `partner_deals`: Store corporate company, travel agency, and government contract profiles, default breakfast inclusions, default invoice styles, and room/venue rate overrides.
    - `ical_feeds`: Subscribed iCal URLs for syncing Airbnb and Booking.com channels.
- **Row-Level Security (RLS)**:
  - Public can select `rooms`.
  - Public can SELECT `bookings` (availability checks) and has full access (ALL) to `ical_feeds` because the frontend PMS dashboard operates with the public/anon key and uses client-side passcode authentication. Direct anon INSERT/UPDATE/DELETE on `bookings` is revoked — every write goes through the SECURITY DEFINER RPCs above so arbitrary clients cannot edit or delete other people's bookings.
  - Authenticated managers have full access to `rooms`, `bookings`, and `ical_feeds`.
- **Edge Functions**:
  - `export-ical`: Serverless function exporting local reservation tables into standard `.ics` file format. Accepts either `room_id` (UUID) or `room_number` (integer) query parameters. Rewritten from `/api/ical/room/:room_number.ics` in the Vercel deployment.
  - `sync-ical`: Serverless function fetching, parsing, and updating local booking tables from subscribed external iCal feeds. Non-destructive and idempotent: it reconciles only sync-managed rows (deletes feed blocks no longer present, skips events that are already synced), and skips any event that overlaps an existing booking instead of forcing a double-booking.

## Work Guidance

- **Edge Function Runtime**: Target Deno runtime for edge functions. Keep external imports pinned to tested versions.
- **Migration Policy**: Ensure schema changes in `supabase/migrations/` are idempotent. Always declare indices for query optimization on check-in/check-out boundaries.
- **Security Check**: The frontend uses client-side passcode gate authentication and operates via the Supabase anon key, so RLS keeps `bookings` public-read and routes all writes through the SECURITY DEFINER RPCs (which enforce collision rules). `ical_feeds` still grants public write access to support feed updates. When adding new write paths, prefer an RPC + an exclusion-constraint backstop over granting direct table writes to `anon`.

## Verification

- **Linting & Validation**: Run `supabase db lint` or verify migrations by executing local database schema seeds using the Supabase CLI if configured.
- **Edge Functions**: Serve and test functions locally via `supabase functions serve`.

## Child DOX Index

No child DOX documents reside under `supabase/`.
