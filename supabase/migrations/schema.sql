-- ==========================================
-- L'Etoile Central Channel Manager Schema
-- Supabase PostgreSQL Migration script
-- ==========================================

-- 1. Create Rooms Table
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_number INT UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    capacity INT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Bookings Table
CREATE TYPE booking_source AS ENUM ('website', 'airbnb', 'booking_com', 'facebook', 'google_maps', 'manual');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'blocked');

CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE, -- Nullable if booking a venue
    venue_id VARCHAR(255) DEFAULT NULL, -- Nullable if booking a room
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255) NOT NULL,
    guest_phone VARCHAR(50) NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    source booking_source DEFAULT 'website'::booking_source NOT NULL,
    status booking_status DEFAULT 'pending'::booking_status NOT NULL,
    downpayment_paid DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
    payment_method VARCHAR(50) DEFAULT NULL,
    payment_reference VARCHAR(255) DEFAULT NULL,
    balance_due DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
    security_deposit DECIMAL(10,2) DEFAULT 500.00 NOT NULL,
    breakfast_orders JSONB DEFAULT NULL,
    equipment_rentals JSONB DEFAULT NULL,
    event_addons JSONB DEFAULT NULL,
    companions JSONB DEFAULT NULL,
    venue_excess_hours INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE, -- 30-min locks
    CONSTRAINT check_dates CHECK (check_in < check_out)
);

-- 3. Create iCal Subscription Feeds Table
CREATE TYPE sync_channel AS ENUM ('airbnb', 'booking_com');

CREATE TABLE IF NOT EXISTS public.ical_feeds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    channel sync_channel NOT NULL,
    url TEXT NOT NULL,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(room_id, channel)
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ical_feeds ENABLE ROW LEVEL SECURITY;

-- Rooms RLS: Public Read, Authenticated Write (Manager only)
DROP POLICY IF EXISTS "Allow public read-only access to rooms" ON public.rooms;
CREATE POLICY "Allow public read-only access to rooms" ON public.rooms
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow manager write access to rooms" ON public.rooms;
CREATE POLICY "Allow manager write access to rooms" ON public.rooms
    FOR ALL TO authenticated USING (true);

-- Bookings RLS: Public SELECT, INSERT, UPDATE, DELETE access (required since dashboard operates with public/anon key)
DROP POLICY IF EXISTS "Allow public select of bookings for collision check" ON public.bookings;
CREATE POLICY "Allow public select of bookings for collision check" ON public.bookings
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow public full access to bookings" ON public.bookings;
CREATE POLICY "Allow public full access to bookings" ON public.bookings
    FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow manager full access to bookings" ON public.bookings;
CREATE POLICY "Allow manager full access to bookings" ON public.bookings
    FOR ALL TO authenticated USING (true);

-- iCal Feeds RLS: Grant public full access (since dashboard operates with public/anon key)
DROP POLICY IF EXISTS "Allow public full access to feeds" ON public.ical_feeds;
CREATE POLICY "Allow public full access to feeds" ON public.ical_feeds
    FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow manager full access to feeds" ON public.ical_feeds;
CREATE POLICY "Allow manager full access to feeds" ON public.ical_feeds
    FOR ALL TO authenticated USING (true);

-- ==========================================
-- INDEX PERFORMANCE OPTIMIZATIONS
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_bookings_collision ON public.bookings(room_id, check_in, check_out) WHERE (status != 'blocked' OR source = 'manual');
CREATE INDEX IF NOT EXISTS idx_pending_expirations ON public.bookings(expires_at) WHERE (status = 'pending');

-- ==========================================
-- DEFAULT BOUTIQUE SEED DATA
-- ==========================================
INSERT INTO public.rooms (room_number, name, base_price, capacity, description, image_url)
VALUES
(1, 'Full Double Deluxe', 1755.00, 2, 'A spacious and luxurious boutique deluxe room featuring a premium double bed, lounge seating, fine champagne accents, and a private balcony overlooking the Bonifacio Global City (BGC) skyline.', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'),
(2, 'Full Double', 1625.00, 2, 'Elegant executive room with a full double bed, modern working desk, minimalist styling, and deep plum velvet finishes. Perfect for business travelers visiting Makati City.', 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80'),
(3, 'Full Double', 1625.00, 2, 'Quiet interior-facing executive sanctuary. Full double bed, luxury plum linen sheets, and warm gold ambient lighting. Located in the heart of Ortigas Center, Manila.', 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80'),
(4, 'Full Double', 1625.00, 2, 'High-floor executive room featuring a double bed, designer concrete finishes, champagne detailing, and custom climate control, offering a stunning view of Manila Bay.', 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=800&q=80'),
(5, 'Matrimonial', 1950.00, 2, 'Perfect for couples. Features a premium queen matrimonial bed, sensory dimmable lights, standalone golden tub, and complementary lounge access at our Metro Manila premier resort.', 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80'),
(6, 'Family Room', 2730.00, 5, 'Grand family suite configured with two interconnected double beds, one single roll-away bed, dining table, and premium multimedia setups. Ideal for staycations in Tagaytay.', 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80'),
(7, 'Bunk Bed 3', 2015.00, 3, 'Premium boutique hostel experience. Triple stacked custom bunk pods, privacy curtains, integrated lockers, and individual charging zones. Popular with backpackers in Boracay.', 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80'),
(8, 'Double', 1495.00, 2, 'Comfortable minimalist studio. Standard double bed with plush cushions, compact bathroom, and large bright windows facing the Cebu IT Park business hub.', 'https://images.unsplash.com/photo-1611891404724-5f9a241e243b?auto=format&fit=crop&w=800&q=80'),
(9, 'Bunk Bed 2', 1560.00, 2, 'Cozy shared space with two parallel bunk cabins, warm reading spots, and access to the executive wellness spa. Located near key transit spots in Pasay City.', 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80'),
(10, 'Bunk Bed 6', 4290.00, 6, 'Excellent block-booking bunk suite. Custom 6-sleeper modular bunk complex, dedicated central lounge area, and double private bathrooms. Ideal for group excursions in El Nido, Palawan.', 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80')
ON CONFLICT (room_number) DO NOTHING;

-- ==========================================
-- SUPABASE REALTIME
-- Enable realtime change events for bookings
-- so the frontend can subscribe via WebSocket
-- instead of polling every 5 seconds.
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

-- ==========================================
-- 4. Create Expense Categories Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 5. Create Expenses Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
    amount DECIMAL(10,2) NOT NULL,
    expense_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) FOR EXPENSES
-- ==========================================
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Expense Categories RLS
DROP POLICY IF EXISTS "Allow public full access to expense categories" ON public.expense_categories;
CREATE POLICY "Allow public full access to expense categories" ON public.expense_categories
    FOR ALL TO public USING (true) WITH CHECK (true);

-- Expenses RLS
DROP POLICY IF EXISTS "Allow public full access to expenses" ON public.expenses;
CREATE POLICY "Allow public full access to expenses" ON public.expenses
    FOR ALL TO public USING (true) WITH CHECK (true);

-- ==========================================
-- EXPENSES REALTIME
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
