-- A guest who leaves before their check-out day frees the room from then on, and still pays for the
-- whole stay (Sebastian, 2026-10-31: "they should still pay for the entire stay, but the calendar
-- should adjust based on when the guest checked out"). check_in and check_out stay as booked, since
-- the bill is priced from them; a noted check-out earlier than check_out ends the halves the stay
-- holds. Mirrored by `bookingHalves` in src/utils/halfDays.ts — change both together.
--
-- book_booking and update_booking are rewritten from the definition the database holds, not from
-- an older file: the migration files have drifted from live.

ALTER TABLE public.bookings DROP CONSTRAINT no_overlap_room;
ALTER TABLE public.bookings DROP CONSTRAINT no_overlap_venue;

CREATE FUNCTION public.booking_halves(p_check_in date, p_check_out date, p_hours numeric, p_half smallint, p_in timestamp with time zone, p_late integer, p_out timestamp with time zone)
 RETURNS int4range
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE WHEN COALESCE(p_hours, 0) = 0
    -- Left on an earlier day: the morning of that day is the last half, or the arrival afternoon
    -- when they left the day they came. A check-out on or after check_out changes nothing.
    THEN int4range((p_check_in - date '2000-01-01') * 2 + 1,
      CASE WHEN (p_out AT TIME ZONE 'Asia/Manila')::date < p_check_out
        THEN greatest((p_check_in - date '2000-01-01') * 2 + 2, ((p_out AT TIME ZONE 'Asia/Manila')::date - date '2000-01-01') * 2 + 1)
        ELSE (p_check_out - date '2000-01-01') * 2 + 1
      END)
    ELSE int4range(s, greatest(s + n, COALESCE(e, 0)))
  END
  FROM (
    SELECT (p_check_in - date '2000-01-01') * 2 + COALESCE(p_half, 1) AS s,
           CASE WHEN p_hours < 12 THEN 1 WHEN p_hours > 12 AND COALESCE(p_half, 1) = 0 THEN 3 ELSE 2 END AS n,
           (SELECT (l::date - date '2000-01-01') * 2 + (extract(hour FROM l) >= 12)::int + 1
              FROM (SELECT (p_in AT TIME ZONE 'Asia/Manila')
                           + make_interval(secs => ((p_hours + COALESCE(p_late, 0)) * 3600 - 1)::double precision) AS l) x
             WHERE p_in IS NOT NULL) AS e
  ) t
$function$;

DO $$
DECLARE
  v_book text := pg_get_functiondef('public.book_booking'::regproc);
  v_update text := pg_get_functiondef('public.update_booking'::regproc);
  v_others constant text := 'b.actual_check_in, b.late_check_out_hours)';
  v_book_span constant text := '(p_booking->>''late_check_out_hours'')::integer)';
  v_update_span constant text := 'COALESCE((p_booking->>''late_check_out_hours'')::integer, v_old.late_check_out_hours))';
BEGIN
  IF position(v_others IN v_book) = 0 OR position(v_book_span IN v_book) = 0
    OR position(v_others IN v_update) = 0 OR position(v_update_span IN v_update) = 0 THEN
    RAISE EXCEPTION 'book_booking or update_booking does not read as expected: nothing was changed.';
  END IF;
  v_book := replace(v_book, v_others, 'b.actual_check_in, b.late_check_out_hours, b.actual_check_out)');
  v_book := replace(v_book, v_book_span, '(p_booking->>''late_check_out_hours'')::integer, (p_booking->>''actual_check_out'')::timestamptz)');
  v_update := replace(v_update, v_others, 'b.actual_check_in, b.late_check_out_hours, b.actual_check_out)');
  v_update := replace(v_update, v_update_span, 'COALESCE((p_booking->>''late_check_out_hours'')::integer, v_old.late_check_out_hours), COALESCE((p_booking->>''actual_check_out'')::timestamptz, v_old.actual_check_out))');
  EXECUTE v_book;
  EXECUTE v_update;
END $$;

ALTER TABLE public.bookings ADD CONSTRAINT no_overlap_room EXCLUDE USING gist (room_id WITH =, public.booking_halves(check_in, check_out, stay_hours, stay_half, actual_check_in, late_check_out_hours, actual_check_out) WITH &&) WHERE (((room_id IS NOT NULL) AND (status <> 'cancelled'::booking_status)));
ALTER TABLE public.bookings ADD CONSTRAINT no_overlap_venue EXCLUDE USING gist (venue_key WITH =, public.booking_halves(check_in, check_out, stay_hours, stay_half, actual_check_in, late_check_out_hours, actual_check_out) WITH &&) WHERE (((venue_key IS NOT NULL) AND (status <> 'cancelled'::booking_status)));

DROP FUNCTION public.booking_halves(date, date, numeric, smallint, timestamp with time zone, integer);
