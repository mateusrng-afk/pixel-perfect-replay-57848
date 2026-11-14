import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check, ChevronLeft, ChevronRight, MessageCircle, Pencil, Phone, Trash2, UserCheck, X } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EditAppointmentDialog } from "@/components/admin/EditAppointmentDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageTitle, StatusBadge, useDeleteAppointment, useSetStatus } from "@/components/admin/shared";
import { appointmentsQuery, barbersQuery } from "@/lib/booking/queries";
import { fromDateKey, toDateKey } from "@/lib/booking/schedule";
import type { Appointment, AppointmentStatus } from "@/lib/booking/types";
import { brl, capitalize, whatsappLink } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Agendamentos · Painel Genario Souza" },
      { name: "description", content: "Veja os agendamentos por dia, edite, confirme, cancele e marque clientes como atendidos." },
      { property: "og:title", content: "Agendamentos · Painel Genario Souza" },
      { property: "og:description", content: "Veja os agendamentos por dia, edite, confirme, cancele e marque clientes como atendidos." },
    ],
  }),
  component: AppointmentsPage,
});

type Range = "day" | "upcoming" | "all";

const STATUS_BORDER: Record<AppointmentStatus, string> = {
  pending: "border-l-warning",
  confirmed: "border-l-success",
  completed: "border-l-gold",
  cancelled: "border-l-destructive",
};

function AppointmentsPage() {
  const [range, setRange] = useState<Range>("day");
  const [day, setDay] = useState(() => new Date());
  const [status, setStatus] = useState<AppointmentStatus | "all">("all");
  const [barberId, setBarberId] = useState<string>("all");

  const today = toDateKey(new Date());
  const dayKey = toDateKey(day);
  const appts = useQuery(appointmentsQuery());
  const barbers = useQuery(barbersQuery);

  const barberName = (id: string) => barbers.data?.find((b) => b.id === id)?.name ?? "—";

  const all = appts.data ?? [];
  const statsDay = range === "day" ? dayKey : today;
  const ofDay = all.filter(
    (a) => a.date === statsDay && a.status !== "cancelled" && (barberId === "all" || a.barber_id === barberId),
  );
  const pending = all.filter((a) => a.date >= today && a.status === "pending");
  const revenueDay = ofDay.reduce((s, a) => s + a.total_price, 0);
  const dayLabel = statsDay === today ? "hoje" : "no dia";

  const filtered = useMemo(
    () =>
      all.filter(
        (a) =>
          (range === "all" || (range === "day" ? a.date === dayKey : a.date >= today)) &&
          (status === "all" || a.status === status) &&
          (barberId === "all" || a.barber_id === barberId),
      ),
    [all, range, status, barberId, today, dayKey],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of filtered) map.set(a.date, [...(map.get(a.date) ?? []), a]);
    return [...map.entries()];
  }, [filtered]);

  return (
    <>
      <PageTitle title="Agendamentos" subtitle="Confirme, edite, cancele ou marque o cliente como atendido." />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label={`Clientes ${dayLabel}`} value={String(ofDay.length)} />
        <Stat label="Pendentes" value={String(pending.length)} highlight={pending.length > 0} />
        <Stat label={`Previsto ${dayLabel}`} value={brl(revenueDay)} />
      </div>

      <div className="mb-4 flex rounded-lg border bg-card p-1 sm:inline-flex">
        {(
          [
            ["day", "Por dia"],
            ["upcoming", "Próximos"],
            ["all", "Todos"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setRange(v)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
              range === v ? "bg-gradient-gold text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {range === "day" && (
        <div className="mb-4 flex items-center gap-2">
          <Button variant="outline" size="icon" className="shrink-0 bg-card" aria-label="Dia anterior" onClick={() => setDay(addDays(day, -1))}>
            <ChevronLeft />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-0 flex-1 justify-center bg-card sm:flex-none sm:min-w-64">
                <CalendarDays className="text-gold" />
                <span className="truncate">{capitalize(format(day, "EEEE, d 'de' MMMM", { locale: ptBR }))}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar mode="single" locale={ptBR} selected={day} onSelect={(d) => d && setDay(d)} className="pointer-events-auto p-3" />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" className="shrink-0 bg-card" aria-label="Próximo dia" onClick={() => setDay(addDays(day, 1))}>
            <ChevronRight />
          </Button>
          {dayKey !== today && (
            <Button variant="ghost" size="sm" onClick={() => setDay(new Date())}>Hoje</Button>
          )}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:flex">
        <Select value={barberId} onValueChange={setBarberId}>
          <SelectTrigger className="bg-card sm:w-44" aria-label="Filtrar por barbeiro"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos barbeiros</SelectItem>
            {barbers.data?.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="bg-card sm:w-44" aria-label="Filtrar por status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="confirmed">Confirmados</SelectItem>
            <SelectItem value="completed">Concluídos</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {appts.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {range === "day" ? "Nenhum agendamento neste dia." : "Nenhum agendamento encontrado."}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(([date, items]) => (
            <section key={date}>
              {range !== "day" && (
                <h2 className="mb-3 flex items-center gap-3 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                  {date === today ? "Hoje · " : ""}
                  {format(fromDateKey(date), "EEEE, dd/MM", { locale: ptBR })}
                  <span className="gold-rule flex-1" />
                </h2>
              )}
              <div className="grid gap-3 lg:grid-cols-2">
                {items.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appt={a}
                    barber={barberName(a.barber_id)}
                    services={a.service_names.join(", ")}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-card p-3 shadow-card sm:p-4", highlight && "border-gold/50")}>
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground sm:text-[0.65rem]">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-gold sm:text-3xl">{value}</p>
    </div>
  );
}

function AppointmentCard({ appt, barber, services }: { appt: Appointment; barber: string; services: string }) {
  const setStatus = useSetStatus();
  const remove = useDeleteAppointment();
  const [editing, setEditing] = useState(false);
  const muted = appt.status === "cancelled";
  const open = appt.status === "pending" || appt.status === "confirmed";
  return (
    <article className={cn("rounded-xl border border-l-4 bg-card p-4 shadow-card", STATUS_BORDER[appt.status], muted && "opacity-60")}>
      <div className="flex items-start gap-3">
        <div className="w-14 shrink-0 text-center">
          <p className="font-display text-2xl font-bold leading-none text-gold tabular-nums">{appt.start_time}</p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">até {appt.end_time}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{appt.client_name}</p>
            <StatusBadge status={appt.status} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            com <span className="text-foreground">{barber}</span>
          </p>
          <p className="text-sm text-muted-foreground">{services || "—"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <a href={`tel:${appt.client_phone.replace(/\D/g, "")}`} className="flex items-center gap-1 text-muted-foreground hover:text-gold">
              <Phone className="size-3.5" /> {appt.client_phone}
            </a>
            <a
              href={whatsappLink(appt.client_phone, `Olá ${appt.client_name.split(" ")[0]}, aqui é da Barbearia Genario Souza.`)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-gold"
            >
              <MessageCircle className="size-3.5" /> WhatsApp
            </a>
          </div>
        </div>
        <p className="shrink-0 font-display text-xl font-bold">{brl(appt.total_price)}</p>
      </div>

      {appt.status !== "cancelled" && (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 sm:flex">
          {appt.status === "pending" && (
            <Button
              variant="gold"
              size="sm"
              className="sm:flex-1"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ id: appt.id, status: "confirmed" })}
            >
              <Check /> Confirmar
            </Button>
          )}
          {open && (
            <Button
              variant={appt.status === "confirmed" ? "gold" : "goldOutline"}
              size="sm"
              className="sm:flex-1"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ id: appt.id, status: "completed" })}
            >
              <UserCheck /> Atendido
            </Button>
          )}
          <Button variant="outline" size="sm" className="bg-transparent sm:flex-1" onClick={() => setEditing(true)}>
            <Pencil /> Editar
          </Button>
          {open && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="bg-transparent text-destructive hover:text-destructive sm:flex-1">
                  <X /> Cancelar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {appt.client_name} às {appt.start_time}. O horário volta a ficar livre para outros clientes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => setStatus.mutate({ id: appt.id, status: "cancelled" })}
                  >
                    Cancelar agendamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
      <div className={cn("flex justify-end", appt.status === "cancelled" ? "mt-3 border-t pt-2" : "mt-2")}>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={remove.isPending}>
              <Trash2 /> Excluir definitivamente
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir definitivamente?</AlertDialogTitle>
              <AlertDialogDescription>
                O agendamento de {appt.client_name} em {format(fromDateKey(appt.date), "dd/MM")} às {appt.start_time} será
                apagado e não poderá ser recuperado. O cadastro do cliente continua salvo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => remove.mutate(appt.id)}
              >
                Excluir definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <EditAppointmentDialog appt={appt} open={editing} onOpenChange={setEditing} />
    </article>
  );
}
