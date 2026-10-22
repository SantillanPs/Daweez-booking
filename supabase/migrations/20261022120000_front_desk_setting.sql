-- The Front desk's own settings (Sebastian, 2026-10-22): where a booking is rescheduled — on
-- the calendar, or on the billing statement (the staff asked for the bill). One `app_settings`
-- row, key `front_desk`, value `{ "reschedule": "calendar" | "bill" }`. A missing row means the
-- calendar, as before. The writer only takes keys it knows, so the new key is added to it.

create or replace function public.set_app_setting(p_key text, p_value jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
    if p_key is null or p_key not in ('rate_config', 'payment_accounts', 'channel_sync', 'front_desk') then
        raise exception 'UNKNOWN_SETTING: %', coalesce(p_key, '(null)');
    end if;

    insert into public.app_settings (key, value, updated_at)
    values (p_key, p_value, now())
    on conflict (key) do update
       set value = excluded.value,
           updated_at = now();
end;
$function$;
