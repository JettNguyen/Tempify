-- Allows authenticated users to delete their own account.
-- SECURITY DEFINER runs as the function owner (postgres superuser),
-- giving it permission to delete from auth.users.
CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.scores  WHERE user_id = auth.uid();
  DELETE FROM public.streaks WHERE user_id = auth.uid();
  DELETE FROM public.users   WHERE id      = auth.uid();
  DELETE FROM auth.users     WHERE id      = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
