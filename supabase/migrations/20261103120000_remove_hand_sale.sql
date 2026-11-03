-- A payment written by hand in Cash Flow → Money in is a slip of its own with nothing else on it, so
-- removing that payment removes the slip (Sebastian, 2026-11-03: "staff should be able to delete a
-- payment in the money in when editing"). anon cannot delete from `tabs`, so this narrow writer does
-- it, and only for a slip with no room whose every payment was written by hand.
-- Applied to development and live 2026-11-03.

CREATE OR REPLACE FUNCTION public.remove_hand_sale(p_tab_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t tabs%ROWTYPE;
BEGIN
  SELECT * INTO t FROM tabs WHERE id = p_tab_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF t.booking_id IS NOT NULL
     OR jsonb_typeof(t.payment_records) IS DISTINCT FROM 'array'
     OR jsonb_array_length(t.payment_records) = 0
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(t.payment_records) r
       WHERE COALESCE((r->>'by_hand')::boolean, false) = false
     ) THEN
    RAISE EXCEPTION 'Only money written by hand in Cash Flow can be removed this way';
  END IF;
  DELETE FROM tab_lines WHERE tab_id = p_tab_id;
  DELETE FROM tabs WHERE id = p_tab_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.remove_hand_sale(uuid) TO anon, authenticated;
