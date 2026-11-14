-- The front desk can switch the chat bot off (Sebastian, 2026-11-15: "add a way to disable the AI chatbot in the
-- front desk"). The switch is the app_settings row `chat_bot` ({"on": false}); no row is on. While it is off,
-- `whatsapp-bot` answers nothing and the staff reply in the page's inbox themselves.
create or replace function public.set_app_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
    if p_key is null or p_key not in ('rate_config', 'payment_accounts', 'channel_sync', 'front_desk', 'stock_in', 'chat_bot') then
        raise exception 'UNKNOWN_SETTING: %', coalesce(p_key, '(null)');
    end if;
    insert into public.app_settings (key, value, updated_at)
    values (p_key, p_value, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
end $function$;
