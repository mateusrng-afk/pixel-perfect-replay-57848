import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageTitle, StatusBadge } from "@/components/admin/shared";
import { appointmentsQuery, barbersQuery, businessHoursQuery, servicesQuery } from "@/lib/booking/queries";
import { hoursForDate, minutesToTime, timeToMinutes, toDateKey, SLOT_STEP_MINUTES } from "@/lib/booking/schedule";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda dos barbeiros · Painel Genario Souza" },
      { name: "description", content: "Agenda individual de cada barbeiro, dia a dia." },
      { property: "og:title", content: "Agenda dos barbeiros · Painel Genario Souza" },
      { property: "og:description", content: "Agenda individual de cada barbeiro, dia a dia." },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  const barbers = useQuery(barbersQuery);
  const hours = useQuery(businessHoursQuery);
  const services = useQuery(servicesQuery);
  const [barberId, setBarberId] = useState<string>();
  const [date, setDate] = useState(() => new Date());

  useEffect(() => {
    if (!barberId && barbers.data?.length) setBarberId(barbers.data[0].id);
  }, [barbers.data, barberId]);

  const dateKey = toDateKey(date);
  const appts = useQuery({ ...appointmentsQuery({ barberId, date: dateKey }), enabled: Boolean(barberId) });
  const active = (appts.data ?? []).filter((a) => a.status !== "cancelled");
  const day = hours.data ? hoursForDate(hours.data, date) : undefined;

  const rows = useMemo(() => {
    if (!day || day.is_closed) return [];
    const out: { time: string; appt?: (typeof active)[number]; continued?: boolean }[] = [];
    for (let t = timeToMinutes(day.open_time); t < timeToMinutes(day.close_time); t += SLOT_STEP_MINUTES) {
      const startAppt = active.find((a) => {
        const s = timeToMinutes(a.start_time);
        return s >= t && s < t + SLOT_STEP_MINUTES;
      });
      const covering = active.find((a) => timeToMinutes(a.start_time) < t && timeToMinutes(a.end_time) > t);
      out.push({ time: minutesToTime(t), appt: startAppt, continued: !startAppt && Boolean(covering) });
    }
    return out;
  }, [day, active]);

  const serviceNames = (ids: string[]) =>
    ids.map((id) => services.data?.find((s) => s.id === id)?.name ?? "?").join(", ");
  const dayTotal = active.reduce((s, a) => s + a.total_price, 0);

  return (
    <>
      <PageTitle title="Agenda" subtitle="Veja o dia de cada barbeiro." />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {barbers.data?.map((b) => (
          <button
            key={b.id}
            onClick={() => setBarberId(b.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
              b.id === barberId ? "border-transparent bg-gradient-gold text-primary-foreground" : "bg-card hover:border-gold/50",
            )}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Button variant="outline" size="icon" className="bg-card" aria-label="Dia anterior" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex-1 justify-center bg-card capitalize sm:flex-none sm:min-w-64">
              <CalendarDays className="text-gold" />
              {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar mode="single" locale={ptBR} selected={date} onSelect={(d) => d && setDate(d)} className="pointer-events-auto p-3" />
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" className="bg-card" aria-label="Próximo dia" onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDate(new Date())}>Hoje</Button>
      </div>

      <div className="mb-4 flex gap-6 text-sm">
        <p><span className="text-muted-foreground">Atendimentos:</span> <strong>{active.length}</strong></p>
        <p><span className="text-muted-foreground">Previsto:</span> <strong className="text-gold">{brl(dayTotal)}</strong></p>
      </div>

      {!day || day.is_closed ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Barbearia fechada neste dia.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          {rows.map((r) => (
            <div key={r.time} className="flex min-h-12 items-stretch border-b last:border-b-0">
              <div className="w-16 shrink-0 border-r py-3 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                {r.time}
              </div>
              <div className="flex-1 p-1.5">
                {r.appt ? (
                  <div className="flex h-full items-center justify-between gap-3 rounded-md border-l-2 border-gold bg-accent px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {r.appt.start_time}–{r.appt.end_time} · {r.appt.client_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{serviceNames(r.appt.service_ids)}</p>
                    </div>
                    <StatusBadge status={r.appt.status} />
                  </div>
                ) : r.continued ? (
                  <div className="h-full rounded-md border-l-2 border-gold/40 bg-accent/50" />
                ) : (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground/60">Livre</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
