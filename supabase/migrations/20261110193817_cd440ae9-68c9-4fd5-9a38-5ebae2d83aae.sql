INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE id = 'c3897a8d-6c57-4571-9598-68ac373fb5ef'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = 'c3897a8d-6c57-4571-9598-68ac373fb5ef' AND role = 'admin'
  );

REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.claim_first_admin();