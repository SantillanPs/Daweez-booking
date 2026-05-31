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
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255) NOT NULL,
    guest_phone VARCHAR(50) NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    source booking_source DEFAULT 'website'::booking_source NOT NULL,
    status booking_status DEFAULT 'pending'::booking_status NOT NULL,
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
CREATE POLICY "Allow public read-only access to rooms" ON public.rooms
    FOR SELECT TO public USING (true);

CREATE POLICY "Allow manager write access to rooms" ON public.rooms
    FOR ALL TO authenticated USING (true);

-- Bookings RLS: Public Insert & Read (so guests can check availability), but Manager full access
CREATE POLICY "Allow public select of bookings for collision check" ON public.bookings
    FOR SELECT TO public USING (true);

CREATE POLICY "Allow public inserts of website pending bookings" ON public.bookings
    FOR INSERT TO public WITH CHECK (status = 'pending');

CREATE POLICY "Allow manager full access to bookings" ON public.bookings
    FOR ALL TO authenticated USING (true);

-- iCal Feeds RLS: Locked to Authenticated Manager Only
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
(1, 'Full Double Deluxe', 6000.00, 2, 'A spacious and luxurious boutique deluxe room featuring a premium double bed, lounge seating, fine champagne accents, and a private balcony overlooking the Bonifacio Global City (BGC) skyline.', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'),
(2, 'Full Double', 4500.00, 2, 'Elegant executive room with a full double bed, modern working desk, minimalist styling, and deep plum velvet finishes. Perfect for business travelers visiting Makati City.', 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80'),
(3, 'Full Double', 4500.00, 2, 'Quiet interior-facing executive sanctuary. Full double bed, luxury plum linen sheets, and warm gold ambient lighting. Located in the heart of Ortigas Center, Manila.', 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80'),
(4, 'Full Double', 4500.00, 2, 'High-floor executive room featuring a double bed, designer concrete finishes, champagne detailing, and custom climate control, offering a stunning view of Manila Bay.', 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=800&q=80'),
(5, 'Matrimonial', 5000.00, 2, 'Perfect for couples. Features a premium queen matrimonial bed, sensory dimmable lights, standalone golden tub, and complementary lounge access at our Metro Manila premier resort.', 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80'),
(6, 'Family Room', 7500.00, 5, 'Grand family suite configured with two interconnected double beds, one single roll-away bed, dining table, and premium multimedia setups. Ideal for staycations in Tagaytay.', 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80'),
(7, 'Bunk Bed 3', 2000.00, 3, 'Premium boutique hostel experience. Triple stacked custom bunk pods, privacy curtains, integrated lockers, and individual charging zones. Popular with backpackers in Boracay.', 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80'),
(8, 'Double', 3500.00, 2, 'Comfortable minimalist studio. Standard double bed with plush cushions, compact bathroom, and large bright windows facing the Cebu IT Park business hub.', 'https://images.unsplash.com/photo-1611891404724-5f9a241e243b?auto=format&fit=crop&w=800&q=80'),
(9, 'Bunk Bed 2', 1500.00, 2, 'Cozy shared space with two parallel bunk cabins, warm reading spots, and access to the executive wellness spa. Located near key transit spots in Pasay City.', 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80'),
(10, 'Bunk Bed 6', 2800.00, 6, 'Excellent block-booking bunk suite. Custom 6-sleeper modular bunk complex, dedicated central lounge area, and double private bathrooms. Ideal for group excursions in El Nido, Palawan.', 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80')
ON CONFLICT (room_number) DO NOTHING;
