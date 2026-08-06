-- Add guest demographic/address fields and invoice type to bookings, and create venues table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS guest_gender VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS guest_nationality VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS guest_address TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(50) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.venues (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    capacity INT NOT NULL,
    description TEXT,
    image_url TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-only access to venues" ON public.venues;
CREATE POLICY "Allow public read-only access to venues" ON public.venues
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow manager write access to venues" ON public.venues;
CREATE POLICY "Allow manager write access to venues" ON public.venues
    FOR ALL TO authenticated USING (true);

INSERT INTO public.venues (id, name, base_price, capacity, description, image_url, details)
VALUES
('venue-gazebo', 'Gazebo', 5000.00, 50, 'A beautiful open-air gazebo. Includes 50 chairs, 9 tables, a speaker, and a water dispenser. Great for small parties and celebrations.', 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80', '{"chairs": 50, "tables": 9, "extras": ["Bluetooth Speaker", "Water Dispenser"]}'::jsonb),
('venue-vacation', 'Vacation House', 15000.00, 50, 'A fully furnished house for staycations. Includes 50 chairs, 10 tables, and a large outdoor tent to protect against rain or sun.', 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80', '{"chairs": 50, "extras": ["Fully Furnished Interior", "Big Weather-proof Tent"], "tables": 10}'::jsonb),
('venue-garden', 'Garden Area', 7500.00, 50, 'A green garden lawn with lovely hanging lights. Includes 50 chairs, 10 tables, and a large canopy tent.', 'https://images.unsplash.com/photo-1545232979-8bf34eb9757b?auto=format&fit=crop&w=800&q=80', '{"chairs": 50, "extras": ["Outdoor string lights", "Big Canopy Tent"], "tables": 10}'::jsonb)
ON CONFLICT (id) DO NOTHING;
