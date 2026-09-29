-- Stop the database refusing the readable ids the app makes.
--
-- FOUND 2026-09-28, the owner's report: "adding new agency deal" → 400,
-- `22P02 invalid input syntax for type uuid: "partner-1i6gasl4…"`.
--
-- The app has always invented READABLE ids — `partner-…`, `inv-…`, `clean-…`,
-- `exp-…`, `cat-…` — and six of these columns were `uuid`, so every one of those
-- writes was rejected. The same fault as the room-price writers, mirrored: there
-- a text id went through a uuid cast, here it goes straight into a uuid column.
--
-- The owner ruled (2026-09-28): the COLUMNS become TEXT, not the app. That is
-- what the rest of the database already does — `rooms`, `bookings`, `venues`,
-- `ical_feeds` and the menu all store readable text ids, and the menu migration
-- deliberately derives in SQL the same slug the app derives. One migration, no
-- app change, nothing to miss.
--
-- `uuid → text` is lossless: an existing uuid simply becomes its own text form,
-- so the agency already stored and the seven bookings pointing at it keep
-- working, and the two relationships are re-created unchanged.
--
-- Safe to run twice: the foreign keys are dropped before they are re-added.

-- ── the two relationships that span the type change ─────────────────────────
alter table public.bookings drop constraint if exists bookings_partner_deal_id_fkey;
alter table public.expenses drop constraint if exists expenses_category_id_fkey;

-- ── the columns ─────────────────────────────────────────────────────────────
alter table public.partner_deals      alter column id          type text;
alter table public.inventory_items    alter column id          type text;
alter table public.cleaning_checklist alter column id          type text;
alter table public.expense_categories alter column id          type text;
alter table public.expenses           alter column id          type text;
alter table public.expenses           alter column category_id type text;
alter table public.bookings           alter column partner_deal_id type text;

-- ── keep the auto-id default working now that the column is text ────────────
alter table public.partner_deals      alter column id set default gen_random_uuid()::text;
alter table public.inventory_items    alter column id set default gen_random_uuid()::text;
alter table public.cleaning_checklist alter column id set default gen_random_uuid()::text;
alter table public.expense_categories alter column id set default gen_random_uuid()::text;
alter table public.expenses           alter column id set default gen_random_uuid()::text;

-- ── put the relationships back, exactly as they were ────────────────────────
alter table public.bookings add constraint bookings_partner_deal_id_fkey
    foreign key (partner_deal_id) references public.partner_deals(id) on delete set null;

alter table public.expenses add constraint expenses_category_id_fkey
    foreign key (category_id) references public.expense_categories(id) on delete restrict;
