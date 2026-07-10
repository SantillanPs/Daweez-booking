-- Add payment fields and venue excess hours to the bookings table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS venue_excess_hours INTEGER DEFAULT 0 NOT NULL;
