import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deleteAppointmentPermanently, setAppointmentStatus } from "@/lib/booking/repo";
import type { AppointmentStatus } from "@/lib/booking/types";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wider",
        status === "pending" && "border-warning/40 bg-warning/10 text-warning",
        status === "confirmed" && "border-success/40 bg-success/10 text-success",
        status === "completed" && "border-gold/40 bg-gold/10 text-gold",
        status === "cancelled" && "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function useSetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      setAppointmentStatus(id, status),
    onSuccess: (_d, v) => {
      toast.success(
        v.status === "confirmed"
          ? "Agendamento confirmado"
          : v.status === "completed"
            ? "Cliente marcado como atendido"
            : "Agendamento cancelado",
      );
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "Não foi possível atualizar."),
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAppointmentPermanently(id),
    onSuccess: () => {
      toast.success("Agendamento excluído definitivamente");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["busy"] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "Não foi possível excluir."),
  });
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
