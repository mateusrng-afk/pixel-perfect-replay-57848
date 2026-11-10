import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  appointmentsQuery,
  barberBreaksQuery,
  barberServicesQuery,
  barbersQuery,
  businessHoursQuery,
  servicesQuery,
} from "@/lib/booking/queries";
import { updateAppointment } from "@/lib/booking/repo";
import {
  availableSlots,
  busyForEdit,
  fromDateKey,
  hoursForBarber,
  isClosedOn,
  servicesForBarber,
  toDateKey,
  totalDuration,
  totalPrice,
} from "@/lib/booking/schedule";
import type { Appointment } from "@/lib/booking/types";
import { brl, capitalize, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export function EditAppointmentDialog({
  appt,
  open,
  onOpenChange,
}: {
  appt: Appointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">Editar agendamento</DialogTitle>
          <DialogDescription>
            {appt.client_name} · {appt.client_phone}
          </DialogDescription>
        </DialogHeader>
        {open && <EditForm appt={appt} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ appt, onDone }: { appt: Appointment; onDone: () => void }) {
  const qc = useQueryClient();
  const [barberId, setBarberId] = useState(appt.barber_id);
  const [date, setDate] = useState(() => fromDateKey(appt.date));
  const [time, setTime] = useState<string | undefined>(appt.start_time);
  const [serviceIds, setServiceIds] = useState<string[]>(appt.service_ids);

  const barbers = useQuery(barbersQuery);
  const services = useQuery(servicesQuery);
  const links = useQuery(barberServicesQuery);
  const hours = useQuery(businessHoursQuery);
  const breaks = useQuery(barberBreaksQuery);
  const dateKey = toDateKey(date);
  const dayAppts = useQuery(appointmentsQuery({ barberId, date: dateKey }));

  const offered = useMemo(
    () => servicesForBarber((services.data ?? []).filter((s) => s.active), links.data ?? [], barberId),
    [services.data, links.data, barberId],
  );
  const selected = offered.filter((s) => serviceIds.includes(s.id));
  const duration = totalDuration(selected);
  const price = totalPrice(selected);
  const barberHours = hours.data ? hoursForBarber(hours.data, barberId) : [];

  const slots = useMemo(() => {
    if (!hours.data || !dayAppts.data || !breaks.data) return [];
    const list = availableSlots({
      date,
      hours: hoursForBarber(hours.data, barberId),
      appointments: busyForEdit({ appointments: dayAppts.data, breaks: breaks.data, barberId, excludeId: appt.id }),
      duration,
    });
    // Keeping the current time is always allowed (the database re-checks anything that changed).
    if (barberId === appt.barber_id && dateKey === appt.date && !list.includes(appt.start_time)) {
      return [...list, appt.start_time].sort();
    }
    return list;
  }, [hours.data, dayAppts.data, breaks.data, date, dateKey, barberId, duration, appt]);

  const loadingSlots = dayAppts.isLoading || hours.isLoading || breaks.isLoading;

  useEffect(() => {
    if (time && !loadingSlots && !slots.includes(time)) setTime(undefined);
  }, [slots, time, loadingSlots]);

  const save = useMutation({
    mutationFn: () =>
      updateAppointment({ id: appt.id, barber_id: barberId, date: dateKey, start_time: time!, service_ids: selected.map((s) => s.id) }),
    onSuccess: () => {
      toast.success("Agendamento atualizado");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["busy"] });
      onDone();
    },
    onError: (e) => {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível salvar.");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  function pickBarber(id: string) {
    setBarberId(id);
    const stillOffered = servicesForBarber(offered, links.data ?? [], id).map((s) => s.id);
    setServiceIds((prev) => prev.filter((x) => stillOffered.includes(x)));
  }

  const toggle = (id: string) =>
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="space-y-6">
      <Field label="Barbeiro">
        <div className="flex flex-wrap gap-2">
          {barbers.data?.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => pickBarber(b.id)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                b.id === barberId ? "border-transparent bg-gradient-gold text-primary-foreground" : "bg-card hover:border-gold/50",
              )}
            >
              {b.name}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Procedimentos">
        <div className="grid gap-2">
          {offered.map((s) => {
            const on = serviceIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                aria-pressed={on}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  on ? "border-gold bg-gold/10" : "bg-card hover:border-gold/50",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn("flex size-5 items-center justify-center rounded border", on && "border-gold bg-gold text-primary-foreground")}>
                    {on && <Check className="size-3.5" />}
                  </span>
                  <span className="font-medium">{s.name}</span>
                </span>
                <span className="text-muted-foreground">
                  {formatDuration(s.duration_minutes)} · <span className="text-foreground">{brl(s.price)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Data">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start bg-card">
              <CalendarDays className="text-gold" />
              {capitalize(format(date, "EEEE, d 'de' MMMM", { locale: ptBR }))}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              locale={ptBR}
              selected={date}
              onSelect={(d) => d && setDate(d)}
              disabled={(d) => isClosedOn(barberHours, d)}
              className="pointer-events-auto p-3"
            />
          </PopoverContent>
        </Popover>
      </Field>

      <Field label="Horário">
        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground">Escolha ao menos um procedimento.</p>
        ) : loadingSlots ? (
          <p className="text-sm text-muted-foreground">Carregando horários...</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum horário livre nesse dia para esse barbeiro.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {slots.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTime(t)}
                className={cn(
                  "rounded-md border py-2 text-sm font-semibold tabular-nums transition-colors",
                  t === time ? "border-transparent bg-gradient-gold text-primary-foreground" : "bg-card hover:border-gold/50",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </Field>

      <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-between gap-3 border-t bg-background px-6 py-4">
        <div>
          <p className="font-display text-2xl font-bold text-gold">{brl(price)}</p>
          <p className="text-xs text-muted-foreground">{duration ? formatDuration(duration) : "—"}</p>
        </div>
        <Button variant="gold" disabled={!time || selected.length === 0 || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Check />} Salvar alterações
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
