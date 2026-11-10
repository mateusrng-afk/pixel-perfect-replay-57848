-- 1) Lunch break per barber
create table public.barber_breaks (
  barber_id uuid primary key references public.barbers(id) on delete cascade,
  start_time time not null,
  end_time time not null,
  updated_at timestamptz not null default now(),
  constraint barber_breaks_valid check (end_time > start_time)
);

grant select, insert, update, delete on public.barber_breaks to authenticated;
grant all on public.barber_breaks to service_role;

alter table public.barber_breaks enable row level security;

create policy "Admin vê almoços" on public.barber_breaks
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admin cria almoços" on public.barber_breaks
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin edita almoços" on public.barber_breaks
  for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin remove almoços" on public.barber_breaks
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger barber_breaks_touch before update on public.barber_breaks
  for each row execute function public.touch_updated_at();

-- 2) Internal helpers (not callable through the API)
create or replace function public.appointment_quote(_barber_id uuid, _service_ids uuid[])
returns table(price numeric, duration integer, services jsonb)
language plpgsql stable set search_path = public as $$
declare
  v_wanted integer;
  v_count integer;
begin
  select count(distinct x) into v_wanted from unnest(coalesce(_service_ids, '{}')) x;
  if v_wanted = 0 then raise exception 'INVALID_SERVICES'; end if;

  -- A service with no barber links is offered by every barber.
  select count(*), coalesce(sum(s.price), 0), coalesce(sum(s.duration_minutes), 0),
         coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'price', s.price,
                                               'duration_minutes', s.duration_minutes)
                            order by s.price, s.name), '[]'::jsonb)
    into v_count, price, duration, services
  from public.services s
  where s.id = any(_service_ids)
    and s.active
    and (not exists (select 1 from public.barber_services bs where bs.service_id = s.id)
         or exists (select 1 from public.barber_services bs
                    where bs.service_id = s.id and bs.barber_id = _barber_id));
  if v_count <> v_wanted or duration <= 0 then raise exception 'INVALID_SERVICES'; end if;
  return next;
end $$;

-- Raises OUTSIDE_HOURS or LUNCH_BREAK when [start, start+duration) does not fit the barber's day.
create or replace function public.assert_barber_slot(_barber_id uuid, _day date, _start time, _duration integer)
returns void
language plpgsql stable set search_path = public as $$
declare
  v_open time;
  v_close time;
  v_closed boolean;
  v_start_min integer := extract(hour from _start)::int * 60 + extract(minute from _start)::int;
begin
  select h.opening_time, h.closing_time, coalesce(h.is_closed, false)
    into v_open, v_close, v_closed
  from public.business_hours h
  where h.weekday = extract(dow from _day)::int
    and (h.barber_id = _barber_id or h.barber_id is null)
  order by (h.barber_id is null)
  limit 1;

  if not found or v_closed or v_open is null or v_close is null
     or _start < v_open
     or v_start_min + _duration > extract(hour from v_close)::int * 60 + extract(minute from v_close)::int then
    raise exception 'OUTSIDE_HOURS';
  end if;

  if exists (
    select 1 from public.barber_breaks b
    where b.barber_id = _barber_id
      and v_start_min < extract(hour from b.end_time)::int * 60 + extract(minute from b.end_time)::int
      and extract(hour from b.start_time)::int * 60 + extract(minute from b.start_time)::int < v_start_min + _duration
  ) then
    raise exception 'LUNCH_BREAK';
  end if;
end $$;

revoke all on function public.appointment_quote(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.assert_barber_slot(uuid, date, time, integer) from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- 3) Public booking now also respects the lunch break
create or replace function public.book_appointment(_barber_id uuid, _client_name text, _client_phone text, _day date, _start_time text, _service_ids uuid[])
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(_client_name, ''));
  v_phone text := btrim(coalesce(_client_phone, ''));
  v_start_local time;
  v_start timestamptz;
  v_price numeric;
  v_duration integer;
  v_services jsonb;
  v_start_min integer;
  v_id uuid;
begin
  if length(v_name) < 2 or length(v_name) > 80 then raise exception 'INVALID_NAME'; end if;
  if length(regexp_replace(v_phone, '\D', '', 'g')) < 10 or length(v_phone) > 20 then
    raise exception 'INVALID_PHONE';
  end if;
  if not exists (select 1 from public.barbers where id = _barber_id and active) then
    raise exception 'INVALID_BARBER';
  end if;

  select q.price, q.duration, q.services into v_price, v_duration, v_services
  from public.appointment_quote(_barber_id, _service_ids) q;

  begin
    v_start_local := _start_time::time;
  exception when others then
    raise exception 'OUTSIDE_HOURS';
  end;
  v_start := (_day + v_start_local) at time zone 'America/Maceio';
  if v_start <= now() then raise exception 'SLOT_IN_PAST'; end if;

  perform public.assert_barber_slot(_barber_id, _day, v_start_local, v_duration);

  v_start_min := extract(hour from v_start_local)::int * 60 + extract(minute from v_start_local)::int;
  begin
    insert into public.appointments (barber_id, client_name, client_phone, selected_services,
                                     appointment_at, total_price, total_duration, status)
    values (_barber_id, v_name, v_phone, v_services, v_start, v_price, v_duration, 'pending')
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;

  return json_build_object(
    'id', v_id,
    'date', to_char(_day, 'YYYY-MM-DD'),
    'start_time', to_char(v_start_local, 'HH24:MI'),
    'end_time', lpad(((v_start_min + v_duration) / 60)::text, 2, '0') || ':' ||
                lpad(((v_start_min + v_duration) % 60)::text, 2, '0'),
    'total_price', v_price,
    'total_duration', v_duration
  );
end $$;

-- Busy times now include the barber's lunch break (times only, no client data)
create or replace function public.get_busy_times(_barber_id uuid, _day date)
returns table(start_time text, end_time text)
language sql stable security definer set search_path = public as $$
  select s, e from (
    select to_char(a.appointment_at at time zone 'America/Maceio', 'HH24:MI') as s,
           to_char((a.appointment_at + make_interval(mins => a.total_duration)) at time zone 'America/Maceio', 'HH24:MI') as e
    from public.appointments a
    where a.barber_id = _barber_id
      and a.status <> 'cancelled'
      and (a.appointment_at at time zone 'America/Maceio')::date = _day
    union all
    select to_char(b.start_time, 'HH24:MI'), to_char(b.end_time, 'HH24:MI')
    from public.barber_breaks b
    where b.barber_id = _barber_id
  ) t
  order by s
$$;

-- 4) Admin edits an appointment: date, time, barber and services
create or replace function public.admin_update_appointment(_id uuid, _barber_id uuid, _day date, _start_time text, _service_ids uuid[])
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_old public.appointments%rowtype;
  v_start_local time;
  v_start timestamptz;
  v_price numeric;
  v_duration integer;
  v_services jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'FORBIDDEN'; end if;

  select * into v_old from public.appointments where id = _id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_old.status = 'cancelled' then raise exception 'APPOINTMENT_CANCELLED'; end if;

  if not exists (select 1 from public.barbers where id = _barber_id and active) then
    raise exception 'INVALID_BARBER';
  end if;

  select q.price, q.duration, q.services into v_price, v_duration, v_services
  from public.appointment_quote(_barber_id, _service_ids) q;

  begin
    v_start_local := _start_time::time;
  exception when others then
    raise exception 'OUTSIDE_HOURS';
  end;
  v_start := (_day + v_start_local) at time zone 'America/Maceio';

  -- Only re-check the slot when something that affects it changed.
  if v_start <> v_old.appointment_at or _barber_id is distinct from v_old.barber_id
     or v_duration <> v_old.total_duration then
    if v_start <> v_old.appointment_at and v_start <= now() then raise exception 'SLOT_IN_PAST'; end if;
    perform public.assert_barber_slot(_barber_id, _day, v_start_local, v_duration);
  end if;

  begin
    update public.appointments
       set barber_id = _barber_id,
           appointment_at = v_start,
           selected_services = v_services,
           total_price = v_price,
           total_duration = v_duration
     where id = _id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;

  return json_build_object('id', _id, 'total_price', v_price, 'total_duration', v_duration);
end $$;

revoke all on function public.admin_update_appointment(uuid, uuid, date, text, uuid[]) from public, anon;
grant execute on function public.admin_update_appointment(uuid, uuid, date, text, uuid[]) to authenticated;