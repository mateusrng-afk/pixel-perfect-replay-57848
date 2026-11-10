-- Needed for the "no overlapping appointments" rule
create extension if not exists btree_gist with schema extensions;

-- ===== Admin roles =====
create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Ver o próprio papel" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- The very first signed-in account can claim the admin role; afterwards nobody else can.
create or replace function public.claim_first_admin()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  perform pg_advisory_xact_lock(hashtext('claim_first_admin'));
  if exists (select 1 from public.user_roles where role = 'admin') then
    return exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin');
  return true;
end $$;
revoke execute on function public.claim_first_admin() from public, anon;
grant execute on function public.claim_first_admin() to authenticated;

-- ===== Double-booking lock =====
-- Minute-only intervals never depend on the time zone, so this is safe to mark immutable.
create or replace function public.appointment_period(_start timestamptz, _minutes integer)
returns tstzrange language sql immutable set search_path = public as $$
  select tstzrange(_start, _start + make_interval(mins => _minutes), '[)')
$$;

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    barber_id with =,
    public.appointment_period(appointment_at, total_duration) with &&
  ) where (status <> 'cancelled');

-- Clients now book only through book_appointment (prices and duration computed by the database).
drop policy if exists "Criar agendamento" on public.appointments;

-- Busy times for one barber/day, without exposing client data.
create or replace function public.get_busy_times(_barber_id uuid, _day date)
returns table (start_time text, end_time text)
language sql stable security definer set search_path = public as $$
  select to_char(a.appointment_at at time zone 'America/Maceio', 'HH24:MI'),
         to_char((a.appointment_at + make_interval(mins => a.total_duration)) at time zone 'America/Maceio', 'HH24:MI')
  from public.appointments a
  where a.barber_id = _barber_id
    and a.status <> 'cancelled'
    and (a.appointment_at at time zone 'America/Maceio')::date = _day
  order by a.appointment_at
$$;
grant execute on function public.get_busy_times(uuid, date) to anon, authenticated;

create or replace function public.book_appointment(
  _barber_id uuid,
  _client_name text,
  _client_phone text,
  _day date,
  _start_time text,
  _service_ids uuid[]
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(_client_name, ''));
  v_phone text := btrim(coalesce(_client_phone, ''));
  v_start_local time;
  v_start timestamptz;
  v_count integer;
  v_wanted integer;
  v_price numeric;
  v_duration integer;
  v_services jsonb;
  v_open time;
  v_close time;
  v_closed boolean;
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

  select count(distinct x) into v_wanted from unnest(coalesce(_service_ids, '{}')) x;
  if v_wanted = 0 then raise exception 'INVALID_SERVICES'; end if;

  -- A service with no barber links is offered by every barber.
  select count(*), coalesce(sum(s.price), 0), coalesce(sum(s.duration_minutes), 0),
         coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'price', s.price,
                                               'duration_minutes', s.duration_minutes)
                            order by s.price, s.name), '[]'::jsonb)
    into v_count, v_price, v_duration, v_services
  from public.services s
  where s.id = any(_service_ids)
    and s.active
    and (not exists (select 1 from public.barber_services bs where bs.service_id = s.id)
         or exists (select 1 from public.barber_services bs
                    where bs.service_id = s.id and bs.barber_id = _barber_id));
  if v_count <> v_wanted or v_duration <= 0 then raise exception 'INVALID_SERVICES'; end if;

  begin
    v_start_local := _start_time::time;
  exception when others then
    raise exception 'OUTSIDE_HOURS';
  end;
  v_start := (_day + v_start_local) at time zone 'America/Maceio';
  if v_start <= now() then raise exception 'SLOT_IN_PAST'; end if;

  select h.opening_time, h.closing_time, coalesce(h.is_closed, false)
    into v_open, v_close, v_closed
  from public.business_hours h
  where h.weekday = extract(dow from _day)::int
    and (h.barber_id = _barber_id or h.barber_id is null)
  order by (h.barber_id is null)
  limit 1;

  v_start_min := extract(hour from v_start_local)::int * 60 + extract(minute from v_start_local)::int;
  if not found or v_closed or v_open is null or v_close is null
     or v_start_local < v_open
     or v_start_min + v_duration > extract(hour from v_close)::int * 60 + extract(minute from v_close)::int then
    raise exception 'OUTSIDE_HOURS';
  end if;

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
revoke execute on function public.book_appointment(uuid, text, text, date, text, uuid[]) from public;
grant execute on function public.book_appointment(uuid, text, text, date, text, uuid[]) to anon, authenticated;

-- ===== Admin access to the existing tables =====
grant select, insert, update, delete on public.appointments, public.services, public.barbers,
  public.barber_services, public.business_hours to authenticated;

create policy "Admin vê agendamentos" on public.appointments
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admin atualiza agendamentos" on public.appointments
  for update to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admin vê todos os serviços" on public.services
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admin cria serviços" on public.services
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin edita serviços" on public.services
  for update to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admin vê todos os barbeiros" on public.barbers
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Admin vincula serviços" on public.barber_services
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin desvincula serviços" on public.barber_services
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Admin edita horários" on public.business_hours
  for update to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));