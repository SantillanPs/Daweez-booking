-- ==========================================
-- Enforce No Double Booking (Server-Side)
-- Supabase PostgreSQL Migration
--
-- Adds a generated normalized venue key + Postgres exclusion constraints so
-- overlapping bookings for the same room or venue are IMPOSSIBLE at the DB
-- level, even if two clients race past the frontend collision check.
--
-- NOTE: This migration fails if existing rows already overlap. Clean overlaps
-- first (or delete test data) before applying in production.
-- ==========================================

-- btree_gist lets us index UUID/text equality alongside daterange overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Mirrors src/utils/helpers.ts normalizeVenueId() so the DB enforces the same
-- fuzzy venue normalization the frontend uses.
CREATE OR REPLACE FUNCTION public.booking_venue_key(p_venue_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT CASE
    WHEN p_venue_id LIKE 'venue-%' THEN p_venue_id
    WHEN lower(p_venue_id) LIKE '%vacation%' THEN 'venue-vacation'
    WHEN lower(p_venue_id) LIKE '%garden%' THEN 'venue-garden'
    WHEN lower(p_venue_id) LIKE '%gazebo%' THEN 'venue-gazebo'
    ELSE p_venue_id
  END;
$$;

-- Stored, generated venue key (kept in sync with normalizeVenueId()).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS venue_key TEXT
  GENERATED ALWAYS AS (public.booking_venue_key(venue_id)) STORED;

-- No two bookings may overlap for the same room.
-- daterange(check_in, check_out) is half-open [check_in, check_out),
-- which is the correct semantics for hotel nights.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS no_overlap_room;
ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlap_room
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out) WITH &&
  )
  WHERE (room_id IS NOT NULL);

-- No two bookings may overlap for the same venue (normalized key).
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS no_overlap_venue;
ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlap_venue
  EXCLUDE USING gist (
    venue_key WITH =,
    daterange(check_in, check_out) WITH &&
  )
  WHERE (venue_key IS NOT NULL);

-- Index to back the venue overlap checks.
CREATE INDEX IF NOT EXISTS idx_bookings_venue_collision
  ON public.bookings (venue_key, check_in, check_out);
