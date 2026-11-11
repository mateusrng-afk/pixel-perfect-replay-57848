-- ===== Staff identity =====
create table public.barber_accounts (
  barber_id uuid primary key references public.barbers(id) on delete cascade,
  user_id uuid not null unique,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.barber_accounts to authenticated;
grant all on public.barber_accounts to service_role;
alter table public.barber_accounts enable row level security;
create policy "Admin vê contas da equipe" on public.barber_accounts for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "Barbeiro vê a própria conta" on public.barber_accounts for select to authenticated
  using (user_id = auth.uid());
create policy "Admin cria contas da equipe" on public.barber_accounts for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin altera contas da equipe" on public.barber_accounts for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin remove contas da equipe" on public.barber_accounts for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create trigger barber_accounts_touch before update on public.barber_accounts
  for each row execute function public.touch_updated_at();

-- The barber record the signed-in user may act as (null when not an active, linked barber).
create or replace function public.current_barber_id()
returns uuid language sql stable set search_path = public as $$
  select ba.barber_id
  from public.barber_accounts ba
  join public.barbers b on b.id = ba.barber_id
  where ba.user_id = auth.uid()
    and ba.active
    and coalesce(b.active, true)
    and exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'barber')
  limit 1
$$;

create or replace function public.is_staff()
returns boolean language sql stable set search_path = public as $$
  select public.has_role(auth.uid(), 'admin') or public.current_barber_id() is not null
$$;

-- ===== Appointments: each barber only their own =====
create policy "Barbeiro vê os próprios agendamentos" on public.appointments for select to authenticated
  using (barber_id = public.current_barber_id());
create policy "Barbeiro atualiza os próprios agendamentos" on public.appointments for update to authenticated
  using (barber_id = public.current_barber_id()) with check (barber_id = public.current_barber_id());

-- Direct updates by a barber may change only the status; other edits go through staff_update_appointment.
create or replace function public.guard_appointment_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and not public.has_role(auth.uid(), 'admin') then
    if (new.id, new.barber_id, new.client_name, new.client_phone, new.selected_services,
        new.appointment_at, new.total_price, new.total_duration, new.created_at)
       is distinct from
       (old.id, old.barber_id, old.client_name, old.client_phone, old.selected_services,
        old.appointment_at, old.total_price, old.total_duration, old.created_at) then
      raise exception 'FORBIDDEN';
    end if;
  end if;
  return new;
end $$;
create trigger appointments_guard_update before update on public.appointments
  for each row execute function public.guard_appointment_update();

drop function if exists public.admin_update_appointment(uuid, uuid, date, text, uuid[]);

create or replace function public.staff_update_appointment(_id uuid, _barber_id uuid, _day date, _start_time text, _service_ids uuid[])
returns json language plpgsql security definer set search_path = public as $$
declare
  v_admin boolean := public.has_role(auth.uid(), 'admin');
  v_me uuid := public.current_barber_id();
  v_old public.appointments%rowtype;
  v_start_local time;
  v_start timestamptz;
  v_price numeric;
  v_duration integer;
  v_services jsonb;
begin
  if not v_admin and v_me is null then raise exception 'FORBIDDEN'; end if;

  select * into v_old from public.appointments where id = _id for update;
  if not found or (not v_admin and v_old.barber_id is distinct from v_me) then raise exception 'NOT_FOUND'; end if;
  if not v_admin and _barber_id is distinct from v_me then raise exception 'FORBIDDEN'; end if;
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

  if v_start <> v_old.appointment_at or _barber_id is distinct from v_old.barber_id
     or v_duration <> v_old.total_duration then
    if v_start <> v_old.appointment_at and v_start <= now() then raise exception 'SLOT_IN_PAST'; end if;
    perform public.assert_barber_slot(_barber_id, _day, v_start_local, v_duration);
  end if;

  begin
    update public.appointments
       set barber_id = _barber_id, appointment_at = v_start, selected_services = v_services,
           total_price = v_price, total_duration = v_duration
     where id = _id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;

  return json_build_object('id', _id, 'total_price', v_price, 'total_duration', v_duration);
end $$;

-- ===== Lunch: barber manages own =====
create policy "Barbeiro vê o próprio almoço" on public.barber_breaks for select to authenticated
  using (barber_id = public.current_barber_id());
create policy "Barbeiro cria o próprio almoço" on public.barber_breaks for insert to authenticated
  with check (barber_id = public.current_barber_id());
create policy "Barbeiro edita o próprio almoço" on public.barber_breaks for update to authenticated
  using (barber_id = public.current_barber_id()) with check (barber_id = public.current_barber_id());
create policy "Barbeiro remove o próprio almoço" on public.barber_breaks for delete to authenticated
  using (barber_id = public.current_barber_id());

-- ===== Working hours: barber edits own =====
create policy "Barbeiro edita os próprios horários" on public.business_hours for update to authenticated
  using (barber_id = public.current_barber_id()) with check (barber_id = public.current_barber_id());

-- ===== Admin can register a new barber =====
grant insert on public.barbers to authenticated;
grant insert on public.business_hours to authenticated;
create policy "Admin cadastra barbeiros" on public.barbers for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin cria horários" on public.business_hours for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.admin_create_barber(_name text)
returns uuid language plpgsql set search_path = public as $$
declare
  v_name text := btrim(coalesce(_name, ''));
  v_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'FORBIDDEN'; end if;
  if length(v_name) < 2 or length(v_name) > 40 then raise exception 'INVALID_NAME'; end if;
  insert into public.barbers (name, active) values (v_name, true) returning id into v_id;
  insert into public.business_hours (barber_id, weekday, opening_time, closing_time, is_closed)
  select v_id, d,
         case when d = 0 then null else '08:00'::time end,
         case when d = 0 then null else '19:00'::time end,
         d = 0
  from generate_series(0, 6) d;
  return v_id;
end $$;

-- ===== Clients =====
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  phone_digits text generated always as (regexp_replace(phone, '\D', '', 'g')) stored,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_name_len check (char_length(btrim(name)) between 2 and 80),
  constraint clients_phone_len check (char_length(phone) <= 20 and char_length(regexp_replace(phone, '\D', '', 'g')) >= 10),
  constraint clients_notes_len check (notes is null or char_length(notes) <= 500)
);
create unique index clients_phone_digits_key on public.clients (phone_digits);
grant select, insert, update on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;
create policy "Equipe vê clientes" on public.clients for select to authenticated using (public.is_staff());
create policy "Equipe cadastra clientes" on public.clients for insert to authenticated with check (public.is_staff());
create policy "Equipe edita clientes" on public.clients for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

-- Fill the client book from existing bookings (appointments themselves are untouched).
insert into public.clients (name, phone, created_by, created_at)
select distinct on (regexp_replace(a.client_phone, '\D', '', 'g'))
       btrim(a.client_name), btrim(a.client_phone), null, coalesce(a.created_at, now())
from public.appointments a
where char_length(regexp_replace(a.client_phone, '\D', '', 'g')) >= 10
  and char_length(btrim(a.client_phone)) <= 20
  and char_length(btrim(a.client_name)) between 2 and 80
order by regexp_replace(a.client_phone, '\D', '', 'g'), a.appointment_at desc
on conflict (phone_digits) do nothing;

-- New bookings add the client to the book automatically.
create or replace function public.remember_client()
returns trigger language plpgsql set search_path = public as $$
begin
  begin
    insert into public.clients (name, phone, created_by)
    values (btrim(new.client_name), btrim(new.client_phone), auth.uid())
    on conflict (phone_digits) do nothing;
  exception when check_violation then
    null;
  end;
  return new;
end $$;
create trigger appointments_remember_client after insert on public.appointments
  for each row execute function public.remember_client();

-- ===== Function access =====
revoke execute on function public.current_barber_id() from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.staff_update_appointment(uuid, uuid, date, text, uuid[]) from public, anon;
revoke execute on function public.admin_create_barber(text) from public, anon;
grant execute on function public.current_barber_id() to authenticated, service_role;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.staff_update_appointment(uuid, uuid, date, text, uuid[]) to authenticated, service_role;
grant execute on function public.admin_create_barber(text) to authenticated, service_role;