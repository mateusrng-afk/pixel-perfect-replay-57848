import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Scissors,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  appointmentsQuery,
  barberServicesQuery,
  barbersQuery,
  businessHoursQuery,
  servicesQuery,
} from "@/lib/booking/queries";
import { createAppointment, SlotUnavailableError } from "@/lib/booking/repo";
import {
  availableSlots,
  fromDateKey,
  isClosedOn,
  toDateKey,
  totalDuration,
  totalPrice,
} from "@/lib/booking/schedule";
import type { Appointment } from "@/lib/booking/types";
import { brl, formatDuration, maskPhone, phoneDigits } from "@/lib/format";

const STEPS = ["Barbeiro", "Serviços", "Data e horário", "Seus dados"] as const;
const MAX_DAYS_AHEAD = 60;

const clientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome")
    .max(80, "Nome muito longo"),
  phone: z
    .string()
    .refine((v) => phoneDigits(v).length >= 10, "Informe um telefone com DDD"),
});

export function BookingFlow() {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [barberId, setBarberId] = useState<string>();
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState<string>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [confirmed, setConfirmed] = useState<Appointment>();

  const barbers = useQuery(barbersQuery);
  const services = useQuery(servicesQuery);
  const links = useQuery(barberServicesQuery);
  const hours = useQuery(businessHoursQuery);

  const dateKey = date ? toDateKey(date) : undefined;
  const dayAppointments = useQuery({
    ...appointmentsQuery({ barberId, date: dateKey }),
    enabled: Boolean(barberId && dateKey),
  });

  const barber = barbers.data?.find((b) => b.id === barberId);

  const offered = useMemo(() => {
    const all = (services.data ?? []).filter((s) => s.active);
    if (!barberId || !links.data) return all;
    const ids = new Set(links.data.filter((l) => l.barber_id === barberId).map((l) => l.service_id));
    return ids.size ? all.filter((s) => ids.has(s.id)) : all;
  }, [services.data, links.data, barberId]);

  const selected = offered.filter((s) => serviceIds.includes(s.id));
  const total = totalPrice(selected);
  const duration = totalDuration(selected);

  const slots = useMemo(() => {
    if (!date || !hours.data || !dayAppointments.data) return [];
    return availableSlots({ date, hours: hours.data, appointments: dayAppointments.data, duration });
  }, [date, hours.data, dayAppointments.data, duration]);

  const book = useMutation({
    mutationFn: createAppointment,
    onSuccess: (appt) => {
      setConfirmed(appt);
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err) => {
      if (err instanceof SlotUnavailableError) {
        toast.error(err.message);
        setTime(undefined);
        setStep(2);
        qc.invalidateQueries({ queryKey: ["appointments"] });
      } else {
        toast.error("Não foi possível confirmar. Tente novamente.");
      }
    },
  });

  const canContinue = [
    Boolean(barberId),
    selected.length > 0,
    Boolean(date && time),
    true,
  ][step];

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setTime(undefined);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      document.getElementById("agendar")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const parsed = clientSchema.safeParse({ name, phone });
    if (!parsed.success) {
      const e: typeof errors = {};
      for (const issue of parsed.error.issues) e[issue.path[0] as "name" | "phone"] = issue.message;
      setErrors(e);
      return;
    }
    setErrors({});
    book.mutate({
      barber_id: barberId!,
      client_name: parsed.data.name,
      client_phone: maskPhone(phone),
      date: dateKey!,
      start_time: time!,
      service_ids: selected.map((s) => s.id),
    });
  }

  function reset() {
    setConfirmed(undefined);
    setStep(0);
    setBarberId(undefined);
    setServiceIds([]);
    setDate(undefined);
    setTime(undefined);
    setName("");
    setPhone("");
  }

  if (confirmed) {
    return (
      <SuccessCard
        appointment={confirmed}
        barberName={barber?.name ?? ""}
        serviceNames={selected.map((s) => s.name)}
        onReset={reset}
      />
    );
  }

  const today = startOfToday();
  const lastDay = addDays(today, MAX_DAYS_AHEAD);

  return (
    <div className="relative">
      {/* Stepper */}
      <ol className="mb-8 grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              className="group flex w-full flex-col gap-2 text-left disabled:cursor-default"
            >
              <span
                className={cn(
                  "h-0.5 w-full rounded-full transition-colors",
                  i <= step ? "bg-gradient-gold" : "bg-border",
                )}
              />
              <span
                className={cn(
                  "text-[0.65rem] font-semibold uppercase tracking-[0.14em] sm:text-xs",
                  i === step ? "text-gold" : i < step ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="hidden sm:inline">{i + 1}. </span>
                {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div key={step} className="animate-fade-up min-h-[320px]">
        {step === 0 && (
          <StepBlock title="Escolha seu barbeiro" subtitle="Quem vai cuidar do seu visual hoje?">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {barbers.isLoading && <LoadingRow />}
              {barbers.data?.map((b) => {
                const active = b.id === barberId;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setBarberId(b.id);
                      setTime(undefined);
                    }}
                    className={cn(
                      "group relative flex flex-col items-center gap-3 rounded-xl border bg-card p-5 shadow-card transition-all",
                      active ? "border-gold shadow-gold" : "hover:border-gold/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-16 items-center justify-center rounded-full border font-display text-3xl font-semibold transition-colors",
                        active
                          ? "border-transparent bg-gradient-gold text-primary-foreground"
                          : "border-gold/40 text-gold",
                      )}
                    >
                      {b.name.charAt(0)}
                    </span>
                    <span className="font-display text-xl font-semibold">{b.name}</span>
                    {active && (
                      <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-gold text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </StepBlock>
        )}

        {step === 1 && (
          <StepBlock title="Escolha os serviços" subtitle="Selecione um ou mais serviços.">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {services.isLoading && <LoadingRow />}
              {offered.map((s) => {
                const active = serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className={cn(
                      "flex items-center gap-4 rounded-xl border bg-card px-4 py-3.5 text-left transition-all",
                      active ? "border-gold bg-accent" : "hover:border-gold/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                        active ? "border-gold bg-gold text-primary-foreground" : "border-input",
                      )}
                    >
                      {active && <Check className="size-3.5" />}
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(s.duration_minutes)}
                      </span>
                    </span>
                    <span className="font-display text-xl font-semibold text-gold">
                      {brl(s.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </StepBlock>
        )}

        {step === 2 && (
          <StepBlock
            title="Data e horário"
            subtitle={`Horários livres com ${barber?.name ?? "o barbeiro"} para ${formatDuration(duration)} de atendimento.`}
          >
            <div className="grid gap-6 md:grid-cols-[auto_1fr]">
              <div className="rounded-xl border bg-card p-2 shadow-card">
                <Calendar
                  mode="single"
                  locale={ptBR}
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setTime(undefined);
                  }}
                  disabled={(d) =>
                    d < today || d > lastDay || (hours.data ? isClosedOn(hours.data, d) : true)
                  }
                  startMonth={today}
                  endMonth={lastDay}
                  className="pointer-events-auto mx-auto bg-transparent [--cell-size:2.6rem]"
                  classNames={{
                    today: "text-gold font-semibold rounded-md",
                  }}
                />
              </div>

              <div>
                {!date ? (
                  <EmptyHint icon={<CalendarDays className="size-5" />}>
                    Escolha uma data para ver os horários livres.
                  </EmptyHint>
                ) : dayAppointments.isLoading ? (
                  <LoadingRow />
                ) : slots.length === 0 ? (
                  <EmptyHint icon={<Clock className="size-5" />}>
                    Nenhum horário livre nesse dia. Tente outra data.
                  </EmptyHint>
                ) : (
                  <>
                    <p className="mb-3 text-sm capitalize text-muted-foreground">
                      {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {slots.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTime(t)}
                          className={cn(
                            "rounded-md border py-2.5 text-sm font-semibold tabular-nums transition-all",
                            t === time
                              ? "border-transparent bg-gradient-gold text-primary-foreground shadow-gold"
                              : "bg-card hover:border-gold/60",
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </StepBlock>
        )}

        {step === 3 && (
          <StepBlock title="Seus dados" subtitle="Confira o resumo e confirme seu horário.">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    placeholder="Seu nome completo"
                    value={name}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 bg-card"
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone / WhatsApp</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(82) 99999-9999"
                    value={maskPhone(phone)}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 bg-card"
                  />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                </div>
              </div>

              <div className="rounded-xl border border-gold/30 bg-card p-5 shadow-card">
                <p className="eyebrow mb-4">Resumo</p>
                <dl className="space-y-3 text-sm">
                  <SummaryRow icon={<User className="size-4" />} label="Barbeiro" value={barber?.name} />
                  <SummaryRow
                    icon={<CalendarDays className="size-4" />}
                    label="Data"
                    value={date ? format(date, "EEE, dd/MM/yyyy", { locale: ptBR }) : "-"}
                  />
                  <SummaryRow
                    icon={<Clock className="size-4" />}
                    label="Horário"
                    value={`${time} · ${formatDuration(duration)}`}
                  />
                </dl>
                <div className="gold-rule my-4" />
                <ul className="space-y-2 text-sm">
                  {selected.map((s) => (
                    <li key={s.id} className="flex justify-between gap-4">
                      <span className="flex items-center gap-2">
                        <Scissors className="size-3.5 text-gold" />
                        {s.name}
                      </span>
                      <span className="tabular-nums">{brl(s.price)}</span>
                    </li>
                  ))}
                </ul>
                <div className="gold-rule my-4" />
                <div className="flex items-baseline justify-between">
                  <span className="text-sm uppercase tracking-widest text-muted-foreground">Total</span>
                  <span className="font-display text-3xl font-bold text-gradient-gold">{brl(total)}</span>
                </div>
              </div>
            </div>
          </StepBlock>
        )}
      </div>

      {/* Action bar */}
      <div className="sticky bottom-0 z-20 -mx-5 mt-8 border-t bg-background/90 px-5 py-4 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex items-center gap-3">
          {step > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="size-12 shrink-0"
              aria-label="Voltar"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {selected.length
                ? `${selected.length} serviço${selected.length > 1 ? "s" : ""} · ${formatDuration(duration)}`
                : "Total"}
            </p>
            <p className="font-display text-2xl font-bold leading-tight text-gold">{brl(total)}</p>
          </div>
          <Button
            variant="gold"
            size="xl"
            disabled={!canContinue || book.isPending}
            onClick={next}
          >
            {book.isPending && <Loader2 className="animate-spin" />}
            {step === STEPS.length - 1 ? "Confirmar agendamento" : "Continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepBlock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-3xl font-semibold sm:text-4xl">{title}</h3>
      {subtitle && <p className="mb-6 mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      {children}
    </section>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <span className="text-gold">{icon}</span>
        {label}
      </dt>
      <dd className="font-semibold capitalize">{value ?? "-"}</dd>
    </div>
  );
}

function EmptyHint({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      <span className="text-gold">{icon}</span>
      {children}
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="col-span-full flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Carregando...
    </div>
  );
}

function SuccessCard({
  appointment,
  barberName,
  serviceNames,
  onReset,
}: {
  appointment: Appointment;
  barberName: string;
  serviceNames: string[];
  onReset: () => void;
}) {
  const when = format(fromDateKey(appointment.date), "EEEE, d 'de' MMMM", { locale: ptBR });
  return (
    <div className="animate-fade-up mx-auto max-w-md rounded-2xl border border-gold/40 bg-card p-8 text-center shadow-gold">
      <CheckCircle2 className="mx-auto size-14 text-gold" />
      <p className="eyebrow mt-5">Agendamento recebido</p>
      <h3 className="mt-2 text-4xl font-semibold">Até logo, {appointment.client_name.split(" ")[0]}!</h3>
      <p className="mt-3 text-sm text-muted-foreground">
        Seu horário foi reservado e aguarda a confirmação da barbearia.
      </p>
      <div className="gold-rule my-6" />
      <dl className="space-y-2 text-left text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Barbeiro</dt><dd className="font-semibold">{barberName}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Data</dt><dd className="font-semibold capitalize">{when}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Horário</dt><dd className="font-semibold">{appointment.start_time} – {appointment.end_time}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Serviços</dt><dd className="text-right font-semibold">{serviceNames.join(", ")}</dd></div>
        <div className="flex justify-between pt-2"><dt className="text-muted-foreground">Total</dt><dd className="font-display text-2xl font-bold text-gold">{brl(appointment.total_price)}</dd></div>
      </dl>
      <Button variant="goldOutline" size="xl" className="mt-8 w-full" onClick={onReset}>
        Fazer outro agendamento
      </Button>
    </div>
  );
}
