import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageTitle } from "@/components/admin/shared";
import { barberServicesQuery, barbersQuery, servicesQuery } from "@/lib/booking/queries";
import { saveService, setServiceBarbers } from "@/lib/booking/repo";
import type { Barber, Service } from "@/lib/booking/types";
import { brl, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços e preços · Painel Genario Souza" },
      { name: "description", content: "Gerencie os serviços, preços e duração dos atendimentos." },
      { property: "og:title", content: "Serviços e preços · Painel Genario Souza" },
      { property: "og:description", content: "Gerencie os serviços, preços e duração dos atendimentos." },
    ],
  }),
  component: ServicesPage,
});

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(60, "Nome muito longo"),
  price: z.number({ invalid_type_error: "Preço inválido" }).min(0, "Preço inválido").max(10000),
  duration_minutes: z.number().int().min(5, "Duração mínima de 5 min").max(480),
});

function ServicesPage() {
  const services = useQuery(servicesQuery);
  const barbers = useQuery(barbersQuery);
  const links = useQuery(barberServicesQuery);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageTitle title="Serviços" subtitle="Preços, duração e quais barbeiros atendem cada serviço.">
        <Button variant="gold" onClick={() => setCreating(true)} disabled={creating}>
          <Plus /> Novo serviço
        </Button>
      </PageTitle>

      <div className="grid gap-3 lg:grid-cols-2">
        {creating && barbers.data && (
          <ServiceEditor
            barbers={barbers.data}
            barberIds={barbers.data.map((b) => b.id)}
            onDone={() => setCreating(false)}
          />
        )}
        {services.data?.map((s) => (
          <ServiceEditor
            key={s.id}
            service={s}
            barbers={barbers.data ?? []}
            barberIds={(links.data ?? []).filter((l) => l.service_id === s.id).map((l) => l.barber_id)}
          />
        ))}
      </div>
    </>
  );
}

function ServiceEditor({
  service,
  barbers,
  barberIds,
  onDone,
}: {
  service?: Service;
  barbers: Barber[];
  barberIds: string[];
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(service?.name ?? "");
  const [price, setPrice] = useState(String(service?.price ?? ""));
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 30));
  const [active, setActive] = useState(service?.active ?? true);
  const [selectedBarbers, setSelectedBarbers] = useState<string[]>(barberIds);

  useEffect(() => setSelectedBarbers(barberIds), [barberIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    !service ||
    name !== service.name ||
    Number(price) !== service.price ||
    Number(duration) !== service.duration_minutes ||
    active !== service.active ||
    [...selectedBarbers].sort().join() !== [...barberIds].sort().join();

  const save = useMutation({
    mutationFn: async () => {
      const parsed = serviceSchema.safeParse({
        name,
        price: Number(price.replace(",", ".")),
        duration_minutes: Number(duration),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const saved = await saveService({ id: service?.id, ...parsed.data, active });
      await setServiceBarbers(saved.id, selectedBarbers);
    },
    onSuccess: () => {
      toast.success(service ? "Serviço atualizado" : "Serviço criado");
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["barber_services"] });
      onDone?.();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  return (
    <article className={cn("rounded-xl border bg-card p-4 shadow-card", !active && "opacity-70", !service && "border-gold/50")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Hidratação" className="font-semibold" />
        </div>
        <div className="flex flex-col items-end gap-1.5 pt-0.5">
          <Label className="text-xs text-muted-foreground">{active ? "Ativo" : "Inativo"}</Label>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Preço (R$)</Label>
          <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Duração (min)</Label>
          <Input type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
      </div>

      <div className="mt-3">
        <Label className="text-xs text-muted-foreground">Barbeiros que atendem</Label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {barbers.map((b) => {
            const on = selectedBarbers.includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBarbers(on ? selectedBarbers.filter((x) => x !== b.id) : [...selectedBarbers, b.id])}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  on ? "border-gold bg-gold/15 text-gold" : "text-muted-foreground hover:border-gold/40",
                )}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
        <p className="text-sm text-muted-foreground">
          {brl(Number(price.replace(",", ".")) || 0)} · {formatDuration(Number(duration) || 0)}
        </p>
        <div className="flex gap-2">
          {!service && (
            <Button variant="ghost" size="sm" onClick={onDone}>Descartar</Button>
          )}
          <Button variant="gold" size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Salvar
          </Button>
        </div>
      </div>
    </article>
  );
}
