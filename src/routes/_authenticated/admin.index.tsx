import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, MessageCircle, Phone, X } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageTitle, StatusBadge, useSetStatus } from "@/components/admin/shared";
import { appointmentsQuery, barbersQuery } from "@/lib/booking/queries";
import { fromDateKey, toDateKey } from "@/lib/booking/schedule";
import type { Appointment, AppointmentStatus } from "@/lib/booking/types";
import { brl, whatsappLink } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Agendamentos · Painel Genario Souza" },
      { name: "description", content: "Veja, confirme e cancele os agendamentos da barbearia." },
      { property: "og:title", content: "Agendamentos · Painel Genario Souza" },
      { property: "og:description", content: "Veja, confirme e cancele os agendamentos da barbearia." },
    ],
  }),
  component: AppointmentsPage,
});

type Range = "today" | "upcoming" | "all";

function AppointmentsPage() {
  const [range, setRange] = useState<Range>("upcoming");
  const [status, setStatus] = useState<AppointmentStatus | "all">("all");
  const [barberId, setBarberId] = useState<string>("all");

  const today = toDateKey(new Date());
  const appts = useQuery(appointmentsQuery());
  const barbers = useQuery(barbersQuery);

  const barberName = (id: string) => barbers.data?.find((b) => b.id === id)?.name ?? "—";

  const all = appts.data ?? [];
  const todays = all.filter((a) => a.date === today && a.status !== "cancelled");
  const pending = all.filter((a) => a.date >= today && a.status === "pending");
  const revenueToday = todays.reduce((s, a) => s + a.total_price, 0);

  const filtered = useMemo(
    () =>
      all.filter(
        (a) =>
          (range === "all" || (range === "today" ? a.date === today : a.date >= today)) &&
          (status === "all" || a.status === status) &&
          (barberId === "all" || a.barber_id === barberId),
      ),
    [all, range, status, barberId, today],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of filtered) map.set(a.date, [...(map.get(a.date) ?? []), a]);
    return [...map.entries()];
  }, [filtered]);

  return (
    <>
      <PageTitle title="Agendamentos" subtitle="Confirme ou cancele as reservas dos clientes." />

      <div className="mb-8 grid grid-cols-3 gap-3">
        <Stat label="Hoje" value={String(todays.length)} />
        <Stat label="Pendentes" value={String(pending.length)} highlight={pending.length > 0} />
        <Stat label="Previsto hoje" value={brl(revenueToday)} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border bg-card p-1">
          {(
            [
              ["today", "Hoje"],
              ["upcoming", "Próximos"],
              ["all", "Todos"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setRange(v)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                range === v ? "bg-gradient-gold text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-40 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="confirmed">Confirmados</SelectItem>
            <SelectItem value="completed">Concluídos</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={barberId} onValueChange={setBarberId}>
          <SelectTrigger className="w-40 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos barbeiros</SelectItem>
            {barbers.data?.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {appts.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhum agendamento encontrado.
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-3 flex items-center gap-3 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                {date === today ? "Hoje · " : ""}
                {format(fromDateKey(date), "EEEE, dd/MM", { locale: ptBR })}
                <span className="gold-rule flex-1" />
              </h2>
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
    <div className={cn("rounded-xl border bg-card p-4 shadow-card", highlight && "border-gold/50")}>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-gold sm:text-3xl">{value}</p>
    </div>
  );
}

function AppointmentCard({ appt, barber, services }: { appt: Appointment; barber: string; services: string }) {
  const setStatus = useSetStatus();
  const muted = appt.status === "cancelled";
  return (
    <article className={cn("rounded-xl border bg-card p-4 shadow-card", muted && "opacity-60")}>
      <div className="flex items-start gap-4">
        <div className="text-center">
          <p className="font-display text-2xl font-bold leading-none text-gold tabular-nums">{appt.start_time}</p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">{appt.end_time}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{appt.client_name}</p>
            <StatusBadge status={appt.status} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            com <span className="text-foreground">{barber}</span> · {services}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
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
        <p className="font-display text-xl font-bold">{brl(appt.total_price)}</p>
      </div>

      {(appt.status === "pending" || appt.status === "confirmed") && (
        <div className="mt-4 flex gap-2 border-t pt-3">
          {appt.status === "pending" && (
            <Button
              variant="gold"
              size="sm"
              className="flex-1"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ id: appt.id, status: "confirmed" })}
            >
              <Check /> Confirmar
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 bg-transparent">
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
        </div>
      )}
    </article>
  );
}
