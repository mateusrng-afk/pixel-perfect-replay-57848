alter table public.barbers add column if not exists whatsapp_phone text;

-- Visitors keep reading the public barber columns, never the WhatsApp number.
revoke select on public.barbers from anon;
grant select (id, name, photo_url, active, created_at) on public.barbers to anon;

create table public.whatsapp_notification_logs (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  status text not null default 'processing' check (status in ('processing', 'sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.whatsapp_notification_logs from anon, authenticated;
grant all on public.whatsapp_notification_logs to service_role;

alter table public.whatsapp_notification_logs enable row level security;

create trigger whatsapp_notification_logs_touch
before update on public.whatsapp_notification_logs
for each row execute function public.touch_updated_at();