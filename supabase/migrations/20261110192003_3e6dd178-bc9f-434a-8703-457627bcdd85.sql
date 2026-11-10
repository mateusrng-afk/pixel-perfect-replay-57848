revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
revoke execute on function public.get_busy_times(uuid, date) from public;
grant execute on function public.get_busy_times(uuid, date) to anon, authenticated;