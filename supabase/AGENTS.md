# Supabase Backend AGENTS.md

## Purpose

This directory contains the database migration schema definitions and Supabase Edge Functions for external channel synchronization (iCal feeds).

## Ownership

- Primary Owner: Backend Engineers / Antigravity Agent
- Scope: Database tables, row-level security (RLS) policies, database performance indexes, and serverless Edge Functions.

## Local Contracts

- **Database Schema**:
  - [schema.sql](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/supabase/migrations/schema.sql) defines the tables:
    - `rooms`: Store hotel room configuration, capacity, pricing, and images.
    - `bookings`: Active and pending customer bookings. Includes table constraints like `check_in < check_out` and status values.
    - `ical_feeds`: Subscribed iCal URLs for syncing Airbnb and Booking.com channels.
- **Row-Level Security (RLS)**:
  - Public can select `rooms` and read-only `bookings` for collision checking.
  - Public can insert `bookings` with status set to `pending`.
  - Authenticated managers have full access to `rooms`, `bookings`, and `ical_feeds`.
- **Edge Functions**:
  - `export-ical`: Serverless function exporting local reservation tables into standard `.ics` file format.
  - `sync-ical`: Serverless function fetching, parsing, and updating local booking tables from subscribed external iCal feeds.

## Work Guidance

- **Edge Function Runtime**: Target Deno runtime for edge functions. Keep external imports pinned to tested versions.
- **Migration Policy**: Ensure schema changes in `supabase/migrations/` are idempotent. Always declare indices for query optimization on check-in/check-out boundaries.
- **Security Check**: Never expose write operations to public users except for inserting `pending` status website bookings.

## Verification

- **Linting & Validation**: Run `supabase db lint` or verify migrations by executing local database schema seeds using the Supabase CLI if configured.
- **Edge Functions**: Serve and test functions locally via `supabase functions serve`.

## Child DOX Index

No child DOX documents reside under `supabase/`.
