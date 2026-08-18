DROP FUNCTION IF EXISTS public.delete_booking(uuid);
DROP FUNCTION IF EXISTS public.confirm_booking(uuid);
GRANT EXECUTE ON FUNCTION public.delete_booking(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_booking(text) TO anon, authenticated;
