-- ==========================================
-- Add explicit promo price per room/venue
--
-- The paper rate card has a Regular Price and a
-- Promo Price per unit (e.g. Room 1: 1,400 / 1,050).
-- Previously the app derived a "promo" by doing
-- base_price * 0.8 in code; now we store both numbers
-- and the nightly rate is chosen explicitly:
--   regular (base_price) normally,
--   promo_price when a sale is ON.
--
-- Realtime pushes keep the React Query cache fresh
-- (see useBookings realtime invalidation).
-- ==========================================

-- 1) Extend rooms + venues with a nullable promo_price
ALTER TABLE public.rooms  ADD COLUMN IF NOT EXISTS promo_price DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS promo_price DECIMAL(10,2) DEFAULT NULL;

-- 2) Seed rooms promo_price = exact sheet promo prices,
--    and correct base_price to the sheet REGULAR prices.
--    Idempotent: only touches rows whose room_number matches.
UPDATE public.rooms SET base_price = 1400.00, promo_price = 1050.00 WHERE room_number = 1;
UPDATE public.rooms SET base_price = 1250.00, promo_price =  950.00 WHERE room_number = 2;
UPDATE public.rooms SET base_price = 1250.00, promo_price =  950.00 WHERE room_number = 3;
UPDATE public.rooms SET base_price = 1250.00, promo_price =  950.00 WHERE room_number = 4;
UPDATE public.rooms SET base_price = 1600.00, promo_price = 1200.00 WHERE room_number = 5;
UPDATE public.rooms SET base_price = 2350.00, promo_price = 1800.00 WHERE room_number = 6;
UPDATE public.rooms SET base_price = 1450.00, promo_price = 1100.00 WHERE room_number = 7;
UPDATE public.rooms SET base_price = 1100.00, promo_price =  850.00 WHERE room_number = 8;
UPDATE public.rooms SET base_price = 1150.00, promo_price =  900.00 WHERE room_number = 9;
UPDATE public.rooms SET base_price = 3100.00, promo_price = 2400.00 WHERE room_number = 10;

-- Keep venues' regular prices as-is for now; owner will
-- send Gazebo / Vacation House / Garden Area promo numbers
-- in a follow-up. venue-gazebo promo will be added then.

-- 3) Realtime pushes for rooms + venues columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rooms'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venues')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'venues'
     )
  THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.venues';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
