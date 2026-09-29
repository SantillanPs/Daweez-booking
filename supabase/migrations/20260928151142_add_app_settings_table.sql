-- Where the SHARED staff settings live.
--
-- Two of them existed only in one browser's localStorage until 2026-09-28:
--
--   * the shared rates (`l_etoile_rates_db`) — venue hourly, the early/late
--     charge, the breakfast menu, extras & rentals, the security deposit and the
--     standard check-in/out times
--   * where guests pay (`l_etoile_payment_accounts_db`) — the GCash number and
--     BOTH bank accounts printed on the bill
--
-- so a second PC showed the factory defaults, and the account a guest was told to
-- pay into could differ from the one on their printed bill. The app now keeps no
-- browser copy of either (`hydrateRateConfig` / `hydratePaymentAccounts` read
-- them once before any route renders).
--
-- One key/value table rather than a column per setting: the app reads and writes
-- each as a single object, and the shape of each already lives in the
-- `RateConfig` / `PaymentAccounts` types. The key is whitelisted in the writer so
-- a stray call cannot invent a setting nothing reads.
--
-- Safe to run twice.

create table if not exists public.app_settings (
    key        text primary key,
    value      jsonb not null,
    updated_at timestamptz not null default now()
);

comment on table public.app_settings is
    'Shared staff settings as one JSON object per key: rate_config (venue hourly, early/late, breakfast menu, extras, deposit, standard times) and payment_accounts (GCash + both banks). Written only through set_app_setting().';

alter table public.app_settings enable row level security;

-- Same shape as `rooms`: everyone may read, only the SECURITY DEFINER writer may
-- change anything, and authenticated managers get full access. These settings are
-- money-adjacent, so they are treated like a rate rather than like the menu.
drop policy if exists "Allow public read-only access to app_settings" on public.app_settings;
create policy "Allow public read-only access to app_settings"
    on public.app_settings for select to public using (true);

drop policy if exists "Allow manager write access to app_settings" on public.app_settings;
create policy "Allow manager write access to app_settings"
    on public.app_settings for all to authenticated using (true);

grant select on public.app_settings to anon, authenticated;

create or replace function public.set_app_setting(
    p_key   text,
    p_value jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_key is null or p_key not in ('rate_config', 'payment_accounts') then
        raise exception 'UNKNOWN_SETTING: %', coalesce(p_key, '(null)');
    end if;

    insert into public.app_settings (key, value, updated_at)
    values (p_key, p_value, now())
    on conflict (key) do update
       set value = excluded.value,
           updated_at = now();
end;
$$;

revoke all on function public.set_app_setting(text, jsonb) from public;
grant execute on function public.set_app_setting(text, jsonb) to anon, authenticated;
