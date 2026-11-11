import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { barberBreaksQuery, barbersQuery } from "@/lib/booking/queries";
import { saveBarberBreak } from "@/lib/booking/repo";
import { timeToMinutes } from "@/lib/booking/schedule";
import type { Barber, BarberBreak } from "@/lib/booking/types";
import { cn } from "@/lib/utils";

/** Each barber's own lunch break, saved one barber at a time. */
export function LunchBreaks() {
  const barbers = useQuery(barbersQuery);
  const breaks = useQuery(barberBreaksQuery);

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        <UtensilsCrossed className="size-5 text-gold" /> Almoço dos barbeiros
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Cada barbeiro tem seu próprio intervalo. Nesse horário ele não recebe agendamentos.
      </p>
      {barbers.isLoading || breaks.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          {barbers.data?.map((b) => (
            <LunchRow key={b.id} barber={b} current={breaks.data?.find((x) => x.barber_id === b.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function LunchRow({ barber, current }: { barber: Barber; current: BarberBreak | undefined }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(Boolean(current));
  const [start, setStart] = useState(current?.start_time ?? "12:00");
  const [end, setEnd] = useState(current?.end_time ?? "13:00");

  useEffect(() => {
    setEnabled(Boolean(current));
    setStart(current?.start_time ?? "12:00");
    setEnd(current?.end_time ?? "13:00");
  }, [current]);

  const dirty = enabled !== Boolean(current) || (enabled && (start !== current?.start_time || end !== current?.end_time));

  const save = useMutation({
    mutationFn: async () => {
      if (enabled && timeToMinutes(end) <= timeToMinutes(start)) {
        throw new Error("O fim do almoço deve ser depois do início.");
      }
      await saveBarberBreak(barber.id, enabled ? { start_time: start, end_time: end } : null);
    },
    onSuccess: () => {
      toast.success(`Almoço de ${barber.name} salvo`);
      qc.invalidateQueries({ queryKey: ["barber_breaks"] });
      qc.invalidateQueries({ queryKey: ["busy"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-4 py-4 last:border-b-0">
      <div className="flex w-44 items-center gap-3">
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={`Almoço de ${barber.name}`} />
        <span className={cn("font-semibold", !enabled && "text-muted-foreground")}>{barber.name}</span>
      </div>
      {enabled ? (
        <div className="flex items-center gap-2">
          <Input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} className="w-28" aria-label={`Início do almoço de ${barber.name}`} />
          <span className="text-muted-foreground">às</span>
          <Input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} className="w-28" aria-label={`Fim do almoço de ${barber.name}`} />
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">Sem intervalo</span>
      )}
      {dirty && (
        <Button variant="gold" size="sm" className="ml-auto" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Salvar
        </Button>
      )}
    </div>
  );
}
