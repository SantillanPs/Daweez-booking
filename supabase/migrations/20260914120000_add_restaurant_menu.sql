-- The restaurant menu (board card k70) moves into the database.
--
-- Until now the menu lived in the browser, so two tablets showed two menus and a
-- price change lived on one device only. The hotel's own menu — 61 items in 15
-- groups, typed off the laminated card — is seeded below so every device starts
-- from the same list, and the kitchen can be edited from one place later.

-- 1. Tables -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id text PRIMARY KEY,               -- readable slug, e.g. 'beer-spirits'
    name text NOT NULL,
    note text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.menu_items (
    id text PRIMARY KEY,
    category_id text NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
    name text NOT NULL,
    price numeric NOT NULL,
    note text,                          -- the cooking choices a dish comes with
    sort_order integer DEFAULT 0 NOT NULL,
    -- An item is retired, never deleted, so a past order still reads correctly.
    active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS menu_items_category_idx ON public.menu_items (category_id, sort_order);

-- 2. Access -------------------------------------------------------------------
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- The menu is configuration, like the inventory and the cleaning list, so the
-- anon-key dashboard gets full access the same way those do. (Money never works
-- this way — bookings and tab lines go through their own rules.)
DROP POLICY IF EXISTS "public all menu_categories" ON public.menu_categories;
CREATE POLICY "public all menu_categories" ON public.menu_categories FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "public all menu_items" ON public.menu_items;
CREATE POLICY "public all menu_items" ON public.menu_items FOR ALL TO public USING (true) WITH CHECK (true);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. The hotel's menu ---------------------------------------------------------
INSERT INTO public.menu_categories (id, name, note, sort_order) VALUES
    ('breakfast',       'Breakfast',          '6–10am',                  1),
    ('value-meals',     'Value Meals',        'with rice + swakto soda', 2),
    ('rice',            'Rice',                NULL,                     3),
    ('appetizers',      'Appetizers',          NULL,                     4),
    ('chicken',         'Chicken',             NULL,                     5),
    ('pork',            'Pork',                NULL,                     6),
    ('beef',            'Beef',                NULL,                     7),
    ('seafood',         'Seafood',             NULL,                     8),
    ('noodles',         'Noodles',             NULL,                     9),
    ('vegetables',      'Vegetables',          NULL,                    10),
    ('salad',           'Salad',               NULL,                    11),
    ('snacks',          'Snacks',              NULL,                    12),
    ('desserts-shakes', 'Desserts & Shakes',   NULL,                    13),
    ('drinks',          'Drinks',             'non-alcoholic',          14),
    ('beer-spirits',    'Beer & Spirits',      NULL,                    15)
ON CONFLICT (id) DO NOTHING;

-- Item ids are derived the same way the app derives them (a readable slug), so
-- the database rows and the offline fallback list never disagree about identity.
INSERT INTO public.menu_items (id, category_id, name, price, note, sort_order)
SELECT c.id || '-' || left(btrim(lower(regexp_replace(v.item, '[^a-zA-Z0-9]+', '-', 'g')), '-'), 40),
       c.id, v.item, v.price, v.note, v.ord
FROM public.menu_categories c
JOIN (VALUES
    -- Breakfast
    ('breakfast', 'Cornsilog', 200::numeric, NULL::text, 1),
    ('breakfast', 'Hotsilog', 200, NULL, 2),
    ('breakfast', 'Porksilog', 200, NULL, 3),
    ('breakfast', 'Bangsilog', 200, NULL, 4),
    ('breakfast', 'Lumpiasilog', 200, NULL, 5),
    ('breakfast', 'Beefsilog', 210, NULL, 6),
    -- Value meals
    ('value-meals', 'Sizzling Sisig Meal', 210, NULL, 1),
    ('value-meals', 'Lechon Kawali Meal', 200, NULL, 2),
    ('value-meals', 'Beef Steak Meal', 250, NULL, 3),
    -- Rice
    ('rice', 'Cup rice', 20, NULL, 1),
    ('rice', 'Platter rice', 100, NULL, 2),
    ('rice', 'Fried rice', 180, NULL, 3),
    ('rice', 'Java rice', 170, NULL, 4),
    -- Appetizers
    ('appetizers', 'Calamares', 280, NULL, 1),
    ('appetizers', 'Shrimp Tempura', 270, NULL, 2),
    ('appetizers', 'Pork Lumpia (12 pcs)', 210, NULL, 3),
    -- Chicken
    ('chicken', 'Whole Fried Chicken', 490, NULL, 1),
    ('chicken', 'Half Fried Chicken', 290, NULL, 2),
    ('chicken', 'Buttered Chicken', 290, NULL, 3),
    -- Pork
    ('pork', 'Sizzling Sisig', 310, NULL, 1),
    ('pork', 'Lechon Kawali', 340, NULL, 2),
    ('pork', 'Crispy Pata', 650, NULL, 3),
    -- Beef
    ('beef', 'Beef Steak', 350, NULL, 1),
    ('beef', 'Beef with Broccoli', 360, NULL, 2),
    ('beef', 'Beef with Mushroom', 360, NULL, 3),
    -- Seafood
    ('seafood', 'Shrimp', 300, 'Buttered | Sinagang | Tinola', 1),
    ('seafood', 'Tuna', 300, 'Filipino | Kinilaw | Sinagang | Tinola', 2),
    ('seafood', 'Tuna Belly', 480, NULL, 3),
    ('seafood', 'Pampano', 480, 'Sinagang | Tinola | Fried', 4),
    -- Noodles
    ('noodles', 'Bam-i', 200, NULL, 1),
    ('noodles', 'Bihon', 200, NULL, 2),
    ('noodles', 'Canton Guisado', 200, NULL, 3),
    ('noodles', 'Sotanghon', 220, NULL, 4),
    -- Vegetables & salad
    ('vegetables', 'Chopsuey', 250, NULL, 1),
    ('salad', 'Mix Vegetable', 480, 'cucumber, onion, tomato, chick peas, carrots', 1),
    -- Snacks
    ('snacks', 'Burger', 75, 'chicken or beef patty', 1),
    ('snacks', 'Burger with cheese', 85, NULL, 2),
    ('snacks', 'Double Stacker Burger', 150, NULL, 3),
    ('snacks', 'Regular Burger with Fries', 100, NULL, 4),
    ('snacks', 'French Fries 200g', 150, NULL, 5),
    -- Desserts & shakes
    ('desserts-shakes', 'Halo-halo', 135, NULL, 1),
    ('desserts-shakes', 'Mango Shake', 140, NULL, 2),
    ('desserts-shakes', 'Ice Cream Scoops', 50, NULL, 3),
    ('desserts-shakes', 'Avocado Shake', 150, NULL, 4),
    ('desserts-shakes', 'Durian Shake', 200, NULL, 5),
    ('desserts-shakes', 'Banana Shake', 100, NULL, 6),
    ('desserts-shakes', 'Buko Shake', 150, NULL, 7),
    -- Drinks
    ('drinks', 'Coke / Royal / Sprite', 15, NULL, 1),
    ('drinks', 'Coke / Royal / Sprite 1.25L', 100, NULL, 2),
    ('drinks', 'Kopiko Brown 3-in-1', 25, NULL, 3),
    ('drinks', 'Coffee Stick with Cream', 25, NULL, 4),
    ('drinks', 'Iced Coffee', 70, NULL, 5),
    ('drinks', 'Iced Milo', 75, NULL, 6),
    ('drinks', 'Hot Milo', 25, NULL, 7),
    ('drinks', 'Bottled Water 500ml', 20, NULL, 8),
    ('drinks', 'Iced Tea 1L Pitcher', 120, NULL, 9),
    -- Beer & spirits
    ('beer-spirits', 'San Mig Flavoured Beer (Apple)', 70, NULL, 1),
    ('beer-spirits', 'San Mig Light', 70, NULL, 2),
    ('beer-spirits', 'Red Horse Stallion', 70, NULL, 3),
    ('beer-spirits', 'Red Horse 1 Litro', 160, NULL, 4),
    ('beer-spirits', 'Pilsen', 70, NULL, 5)
) AS v(cat, item, price, note, ord) ON v.cat = c.id
ON CONFLICT (id) DO NOTHING;
