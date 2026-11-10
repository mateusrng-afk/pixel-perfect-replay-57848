alter function public.admin_update_appointment(uuid, uuid, date, text, uuid[]) security invoker;
grant execute on function public.appointment_quote(uuid, uuid[]) to authenticated;
grant execute on function public.assert_barber_slot(uuid, date, time, integer) to authenticated;