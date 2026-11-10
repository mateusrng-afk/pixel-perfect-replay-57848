import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageTitle } from "@/components/admin/shared";
import { businessHoursQuery } from "@/lib/booking/queries";
import { saveBusinessHours } from "@/lib/booking/repo";
import { shopHours, timeToMinutes } from "@/lib/booking/schedule";
import type { BusinessHour } from "@/lib/booking/types";
import { WEEKDAYS } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/horarios")({
  head: () => ({
    meta: [
      { title: "Horários de funcionamento · Painel Genario Souza" },
      { name: "description", content: "Defina os dias e horários de funcionamento da barbearia." },
      { property: "og:title", content: "Horários de funcionamento · Painel Genario Souza" },
      { property: "og:description", content: "Defina os dias e horários de funcionamento da barbearia." },
    ],
  }),
  component: HoursPage,
});

// Monday first, Sunday last
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function HoursPage() {
  const qc = useQueryClient();
  const hours = useQuery(businessHoursQuery);
  const [draft, setDraft] = useState<BusinessHour[]>([]);

  useEffect(() => {
    if (hours.data) setDraft(shopHours(hours.data));
  }, [hours.data]);

  const update = (day: number, patch: Partial<BusinessHour>) =>
    setDraft((d) => d.map((h) => (h.day_of_week === day ? { ...h, ...patch } : h)));

  const save = useMutation({
    mutationFn: async () => {
      const bad = draft.find((h) => !h.is_closed && timeToMinutes(h.close_time) <= timeToMinutes(h.open_time));
      if (bad) throw new Error(`${WEEKDAYS[bad.day_of_week]}: o fechamento deve ser depois da abertura.`);
      await saveBusinessHours(draft);
    },
    onSuccess: () => {
      toast.success("Horários salvos");
      qc.invalidateQueries({ queryKey: ["business_hours"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const dirty = JSON.stringify(draft) !== JSON.stringify(shopHours(hours.data ?? []));

  return (
    <>
      <PageTitle title="Horários" subtitle="Dias e horários em que a barbearia aceita agendamentos. Valem para todos os barbeiros.">
        <Button variant="gold" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Salvar alterações
        </Button>
      </PageTitle>

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        {ORDER.map((day) => {
          const h = draft.find((x) => x.day_of_week === day);
          if (!h) return null;
          return (
            <div key={day} className="flex flex-wrap items-center gap-4 border-b px-4 py-4 last:border-b-0">
              <div className="flex w-44 items-center gap-3">
                <Switch checked={!h.is_closed} onCheckedChange={(v) => update(day, { is_closed: !v })} />
                <span className={cn("font-semibold", h.is_closed && "text-muted-foreground")}>{WEEKDAYS[day]}</span>
              </div>
              {h.is_closed ? (
                <span className="text-sm text-muted-foreground">Fechado</span>
              ) : (
                <div className="flex items-center gap-2">
                  <Input type="time" step={1800} value={h.open_time} onChange={(e) => update(day, { open_time: e.target.value })} className="w-28" aria-label={`Abertura ${WEEKDAYS[day]}`} />
                  <span className="text-muted-foreground">às</span>
                  <Input type="time" step={1800} value={h.close_time} onChange={(e) => update(day, { close_time: e.target.value })} className="w-28" aria-label={`Fechamento ${WEEKDAYS[day]}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Os horários são oferecidos a cada 30 minutos, respeitando a duração dos serviços escolhidos.
      </p>
    </>
  );
}
