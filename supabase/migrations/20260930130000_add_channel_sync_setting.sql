-- THE iCAL SWITCH (the owner's ruling, 2026-09-30: *"can we have a toggle to turn enable and disable ical
-- connections?"*, and on the two drawn switches: *"do it"*).
--
-- Two switches live in ONE setting, on purpose: a master one for the whole channel connection, and one per
-- room. `{ "enabled": true, "rooms": { "room-3": false } }` — a room that is absent from `rooms` is ON, so the
-- setting stays tiny and a new room is connected the moment it is added rather than silently off.
--
-- Why it has to exist: before this, the app fetched every feed on every open and every five minutes with no way
-- to stop it. The owner found nine feeds all pointing at the SAME Airbnb URL, which meant the same calendar was
-- downloaded nine times and every Airbnb event was imported **once per room** — one reservation became nine
-- bookings and blocked the whole hotel. A switch is the stop, and the per-room switch is for taking one room off
-- the channels without touching the rest.
--
-- `app_settings` is the right home: it is where the two other shared settings live (rate_config,
-- payment_accounts) and it is already read by the app **and** by the `sync-ical` edge function, which is the
-- piece that actually does the fetching — so the server honours the switch even if a stale browser tab asks it
-- to sync. That matters: a client-side check alone could be skipped by an old tab.
--
-- This migration only widens the whitelist. `set_app_setting` refuses any key it does not know (that is what
-- stops a stray call inventing a setting nothing reads), so the new key has to be named here or every save is
-- rejected with UNKNOWN_SETTING.
--
-- Idempotent: re-running replaces the same function with the same body.

create or replace function public.set_app_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
    if p_key is null or p_key not in ('rate_config', 'payment_accounts', 'channel_sync') then
        raise exception 'UNKNOWN_SETTING: %', coalesce(p_key, '(null)');
    end if;

    insert into public.app_settings (key, value, updated_at)
    values (p_key, p_value, now())
    on conflict (key) do update
       set value = excluded.value,
           updated_at = now();
end;
$function$;
