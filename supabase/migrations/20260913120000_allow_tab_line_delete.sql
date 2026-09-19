-- Guest tabs (board card k69) — CHANGE OF RULE: a wrong line may now be REMOVED.
--
-- The owner changed the decision. The tab was append-only, and a mistake was
-- answered by a negative "correction" line. Staff would rather simply delete the
-- line — which is also how the app already treats a wrong payment ("remove it and
-- the balance recomputes itself"), so this makes one rule instead of two.
--
--   1. tab_lines gains a DELETE policy.
--   2. The correction link becomes ON DELETE CASCADE, so deleting a charge also
--      removes any correction that answered it — on its own, a correction is a
--      negative line with nothing left to correct.
--
-- The correction columns (kind / corrects_line_id / reason) are deliberately left
-- in place: they cost nothing, any row written before this change stays readable,
-- and no app code writes them any more.

DROP POLICY IF EXISTS "public delete tab_lines" ON public.tab_lines;
CREATE POLICY "public delete tab_lines" ON public.tab_lines FOR DELETE TO public USING (true);

-- Repoint the self-reference so a deleted charge takes its correction with it.
DO $$
DECLARE c text;
BEGIN
    SELECT conname INTO c FROM pg_constraint
     WHERE conrelid = 'public.tab_lines'::regclass
       AND contype = 'f'
       AND conkey = ARRAY[(
             SELECT attnum::smallint FROM pg_attribute
              WHERE attrelid = 'public.tab_lines'::regclass AND attname = 'corrects_line_id'
           )];
    IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.tab_lines DROP CONSTRAINT %I', c);
    END IF;
END $$;

ALTER TABLE public.tab_lines
    ADD CONSTRAINT tab_lines_corrects_line_id_fkey
    FOREIGN KEY (corrects_line_id) REFERENCES public.tab_lines(id) ON DELETE CASCADE;
