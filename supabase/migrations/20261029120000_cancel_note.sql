-- Why a booking was cancelled (Sebastian, 2026-10-29): the cancel ask takes a quick
-- reason and/or a note, and the bill shows it under its CANCELLED stamp.
-- update_booking does not know this column, so saving the bill never wipes it.
alter table public.bookings add column if not exists cancel_note text;

drop function if exists public.cancel_booking(text);
create or replace function public.cancel_booking(p_booking_id text, p_note text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_row jsonb;
begin
  update public.bookings
     set status = 'cancelled', cancelled_at = now(), expires_at = null,
         cancel_note = nullif(btrim(p_note), '')
   where id = p_booking_id
  returning to_jsonb(bookings.*) into v_row;

  if v_row is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  return v_row;
end;
$function$;

grant execute on function public.cancel_booking(text, text) to anon, authenticated;
