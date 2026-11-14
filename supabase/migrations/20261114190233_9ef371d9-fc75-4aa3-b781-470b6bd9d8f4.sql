create or replace function public.staff_delete_appointment(_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_admin boolean := public.has_role(auth.uid(), 'admin');
  v_me uuid := public.current_barber_id();
  v_appointment_barber uuid;
begin
  if not v_admin and v_me is null then raise exception 'FORBIDDEN'; end if;
  select barber_id into v_appointment_barber from public.appointments where id = _id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not v_admin and v_appointment_barber is distinct from v_me then raise exception 'FORBIDDEN'; end if;
  delete from public.appointments where id = _id;
end;
$$;
revoke all on function public.staff_delete_appointment(uuid) from public, anon;
grant execute on function public.staff_delete_appointment(uuid) to authenticated, service_role;