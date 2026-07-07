-- ==========================================
-- Agency & Partner Deals and Invoicing Schema
-- Supabase PostgreSQL Migration script
-- ==========================================

-- 1. Create Partner Deals Table
CREATE TABLE IF NOT EXISTS public.partner_deals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) DEFAULT 'company' NOT NULL CHECK (type IN ('agency', 'company', 'government', 'university', 'other')),
    tin VARCHAR(100) DEFAULT NULL,
    address TEXT DEFAULT NULL,
    contact_no VARCHAR(100) DEFAULT NULL,
    email VARCHAR(255) DEFAULT NULL,
    vehicle_plate VARCHAR(50) DEFAULT NULL,
    invoice_type VARCHAR(50) DEFAULT 'folio' NOT NULL CHECK (invoice_type IN ('folio', 'billing')),
    breakfast_default VARCHAR(50) DEFAULT 'w/o' NOT NULL CHECK (breakfast_default IN ('w/o', 'with')),
    contracted_rates JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add Partner Columns to Bookings Table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS partner_deal_id UUID REFERENCES public.partner_deals(id) ON DELETE SET NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100) UNIQUE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(50) DEFAULT NULL CHECK (invoice_type IN ('folio', 'billing')),
ADD COLUMN IF NOT EXISTS breakfast_included BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS contract_rate_override DECIMAL(10,2) DEFAULT NULL;

-- 3. Row-Level Security (RLS) Policies for Partner Deals
ALTER TABLE public.partner_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public full access to partner_deals" ON public.partner_deals;
CREATE POLICY "Allow public full access to partner_deals" ON public.partner_deals
    FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow manager full access to partner_deals" ON public.partner_deals;
CREATE POLICY "Allow manager full access to partner_deals" ON public.partner_deals
    FOR ALL TO authenticated USING (true);

-- 4. Enable Supabase Realtime for partner_deals
ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_deals;
