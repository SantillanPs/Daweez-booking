-- Restaurant → History (Sebastian, 2026-11-05, task #2: "track orders, and serves, the sent to front desk,
-- and sent to room"). Chosen from the mock as "E · Slip steps": each order slip opens to what happened
-- to it, latest first.
--
-- A slip's lines keep only how many were ordered, cooked and served, never when, so the steps are
-- written down as they happen, by triggers on `tab_lines` and `tabs`. Triggers rather than the app or
-- the order functions: every way a dish, a serve or a bill is written (apply_order_changes,
-- mark_order_lines_served, billOutTab, billToRoom, sendBackTab) is caught without touching them.
--
-- Taps close together are one step: an order tapped in over a few calls, or dishes served one by one,
-- read as one "Ordered …" or "Served …" line while nothing else happened in between (five minutes).
-- A money-in sale written by hand in Cash Flow is not a restaurant order and is never logged.

CREATE TABLE IF NOT EXISTS public.tab_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No foreign key: a slip removed with its lines must not be refused over its history.
  -- Deleting a slip deletes its steps (`tab_events_forget`).
  tab_id uuid NOT NULL,
  -- order · served · removed · desk (sent to the front desk) · room (sent to a room's bill) · back (sent back by the desk)
  kind text NOT NULL CHECK (kind IN ('order', 'served', 'removed', 'desk', 'room', 'back')),
  -- [{ "qty": 2, "name": "Buttered Chicken" }, …] for order / served / removed
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount numeric NOT NULL DEFAULT 0,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tab_events_tab_idx ON public.tab_events (tab_id, at);

ALTER TABLE public.tab_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read tab_events" ON public.tab_events;
CREATE POLICY "public read tab_events" ON public.tab_events FOR SELECT USING (true);
GRANT SELECT ON public.tab_events TO anon, authenticated;

-- A hand-written sale from Cash Flow: a slip whose payments were all typed in by hand.
CREATE OR REPLACE FUNCTION public.is_hand_sale(p_tab_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM tabs t
     WHERE t.id = p_tab_id
       AND jsonb_typeof(t.payment_records) = 'array'
       AND jsonb_array_length(t.payment_records) > 0
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(t.payment_records) r
                        WHERE COALESCE((r->>'by_hand')::boolean, false) = false)
  );
$function$;

-- Writes one step, or adds a dish to the slip's last step when it is the same kind and close by.
CREATE OR REPLACE FUNCTION public.log_tab_event(p_tab_id uuid, p_kind text, p_qty numeric, p_name text, p_amount numeric, p_at timestamptz DEFAULT clock_timestamp())
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_last tab_events%ROWTYPE;
BEGIN
  IF p_name IS NOT NULL THEN
    SELECT * INTO v_last FROM tab_events WHERE tab_id = p_tab_id ORDER BY at DESC, id DESC LIMIT 1;
    IF FOUND AND v_last.kind = p_kind AND v_last.at >= p_at - interval '5 minutes' THEN
      UPDATE tab_events
         SET items = CASE
               WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(items) e WHERE e->>'name' = p_name)
               THEN (SELECT jsonb_agg(CASE WHEN e->>'name' = p_name
                                           THEN jsonb_set(e, '{qty}', to_jsonb((e->>'qty')::numeric + p_qty))
                                           ELSE e END ORDER BY o)
                       FROM jsonb_array_elements(items) WITH ORDINALITY AS x(e, o))
               ELSE items || jsonb_build_array(jsonb_build_object('qty', p_qty, 'name', p_name))
             END,
             amount = amount + COALESCE(p_amount, 0)
       WHERE id = v_last.id;
      RETURN;
    END IF;
  END IF;
  INSERT INTO tab_events (tab_id, kind, items, amount, at)
  VALUES (p_tab_id, p_kind,
          CASE WHEN p_name IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('qty', p_qty, 'name', p_name)) END,
          COALESCE(p_amount, 0), p_at);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.log_tab_event(uuid, text, numeric, text, numeric, timestamptz) FROM PUBLIC, anon, authenticated;

-- A dish ordered, more of it, fewer of it, served, or taken off.
CREATE OR REPLACE FUNCTION public.tab_lines_log_step()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tab uuid := COALESCE(NEW.tab_id, OLD.tab_id);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tabs WHERE id = v_tab) OR is_hand_sale(v_tab) THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM log_tab_event(NEW.tab_id, 'order', NEW.qty, NEW.description, NEW.amount);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_tab_event(OLD.tab_id, 'removed', OLD.qty, OLD.description, -OLD.amount);
  ELSE
    IF NEW.qty > OLD.qty THEN
      PERFORM log_tab_event(NEW.tab_id, 'order', NEW.qty - OLD.qty, NEW.description, (NEW.qty - OLD.qty) * NEW.unit_price);
    ELSIF NEW.qty < OLD.qty THEN
      PERFORM log_tab_event(NEW.tab_id, 'removed', OLD.qty - NEW.qty, NEW.description, -(OLD.qty - NEW.qty) * NEW.unit_price);
    END IF;
    -- A charge (corkage, a take-out box) is saved already served: it never went to the table.
    IF NOT COALESCE(NEW.other_charge, false) AND COALESCE(NEW.served_qty, 0) > COALESCE(OLD.served_qty, 0) THEN
      PERFORM log_tab_event(NEW.tab_id, 'served', NEW.served_qty - COALESCE(OLD.served_qty, 0), NEW.description, NULL);
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS tab_lines_log_step ON public.tab_lines;
CREATE TRIGGER tab_lines_log_step AFTER INSERT OR UPDATE OF qty, served_qty OR DELETE ON public.tab_lines
  FOR EACH ROW EXECUTE FUNCTION public.tab_lines_log_step();

-- The bill sent to the front desk or onto a room, or sent back to the restaurant.
CREATE OR REPLACE FUNCTION public.tabs_log_step()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM tab_events WHERE tab_id = OLD.id;
    RETURN NULL;
  END IF;
  IF is_hand_sale(NEW.id) THEN
    RETURN NULL;
  END IF;
  IF OLD.billed_at IS NULL AND NEW.billed_at IS NOT NULL THEN
    PERFORM log_tab_event(NEW.id, CASE WHEN NEW.booking_id IS NOT NULL THEN 'room' ELSE 'desk' END, NULL, NULL,
                          (SELECT COALESCE(sum(amount), 0) FROM tab_lines WHERE tab_id = NEW.id));
  ELSIF OLD.billed_at IS NOT NULL AND NEW.billed_at IS NULL THEN
    PERFORM log_tab_event(NEW.id, 'back', NULL, NULL, NULL);
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS tabs_log_step ON public.tabs;
CREATE TRIGGER tabs_log_step AFTER UPDATE OF billed_at ON public.tabs
  FOR EACH ROW EXECUTE FUNCTION public.tabs_log_step();
DROP TRIGGER IF EXISTS tab_events_forget ON public.tabs;
CREATE TRIGGER tab_events_forget AFTER DELETE ON public.tabs
  FOR EACH ROW EXECUTE FUNCTION public.tabs_log_step();

-- The slips from before today: what was ordered (each line at the time it was first put on, at the
-- count it ended on) and where the bill went. When a dish was served was never kept, so older slips
-- have no "Served" step.
DO $backfill$
DECLARE
  r record;
BEGIN
  IF EXISTS (SELECT 1 FROM tab_events) THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT * FROM (
      SELECT l.tab_id, 'order' AS kind, l.qty, l.description AS name, l.amount, l.created_at AS at, 0 AS ord
        FROM tab_lines l
       WHERE l.kind = 'charge'
      UNION ALL
      SELECT t.id, CASE WHEN t.booking_id IS NOT NULL THEN 'room' ELSE 'desk' END, NULL, NULL,
             (SELECT COALESCE(sum(amount), 0) FROM tab_lines WHERE tab_id = t.id), t.billed_at, 1
        FROM tabs t
       WHERE t.billed_at IS NOT NULL
    ) s
     WHERE NOT is_hand_sale(s.tab_id)
     ORDER BY s.tab_id, s.at, s.ord
  LOOP
    PERFORM log_tab_event(r.tab_id, r.kind, r.qty, r.name, r.amount, r.at);
  END LOOP;
END
$backfill$;
