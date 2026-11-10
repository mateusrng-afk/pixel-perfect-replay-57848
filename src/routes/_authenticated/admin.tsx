import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock, ExternalLink, ListChecks, Loader2, LogOut, Scissors, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { adminStatusQuery, claimFirstAdmin } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel · Barbearia Genario Souza" },
      { name: "description", content: "Área administrativa da Barbearia Genario Souza." },
      { property: "og:title", content: "Painel · Barbearia Genario Souza" },
      { property: "og:description", content: "Área administrativa da Barbearia Genario Souza." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Agendamentos", icon: ListChecks, exact: true },
  { to: "/admin/agenda", label: "Agenda", icon: CalendarDays, exact: false },
  { to: "/admin/servicos", label: "Serviços", icon: Scissors, exact: false },
  { to: "/admin/horarios", label: "Horários", icon: Clock, exact: false },
] as const;

function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

function AdminLayout() {
  const status = useQuery(adminStatusQuery);
  const signOut = useSignOut();

  if (status.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Carregando...
      </div>
    );
  }
  if (!status.data?.isAdmin) return <NoAccess email={status.data?.email ?? null} onSignOut={signOut} />;

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/admin">
            <BrandMark />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.exact }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "bg-accent text-gold" }}
              >
                <n.icon className="size-4" /> {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground hover:text-gold"
            >
              <span className="hidden sm:inline">Página do cliente</span> <ExternalLink className="size-3.5" />
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground hover:text-gold"
            >
              Sair <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.exact }}
            className="flex flex-col items-center gap-1 py-3 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground"
            activeProps={{ className: "text-gold" }}
          >
            <n.icon className="size-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function NoAccess({ email, onSignOut }: { email: string | null; onSignOut: () => void }) {
  const qc = useQueryClient();
  const claim = useMutation({
    mutationFn: claimFirstAdmin,
    onSuccess: (ok) => {
      if (ok) {
        toast.success("Acesso de administrador ativado");
        qc.invalidateQueries();
      } else {
        toast.error("A barbearia já tem um administrador. Peça a ele para liberar seu acesso.");
      }
    },
    onError: () => toast.error("Não foi possível ativar o acesso."),
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-2xl border border-gold/30 bg-card p-7 text-center shadow-card">
        <ShieldCheck className="mx-auto size-9 text-gold" />
        <h1 className="mt-3 text-3xl font-semibold">Acesso ao painel</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {email ? <>Você entrou como <strong className="text-foreground">{email}</strong>, </> : null}
          mas esta conta ainda não é administradora.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Se esta é a primeira conta da barbearia, ative o acesso abaixo.
        </p>
        <Button variant="gold" size="xl" className="mt-6 w-full" disabled={claim.isPending} onClick={() => claim.mutate()}>
          {claim.isPending && <Loader2 className="animate-spin" />} Ativar como administrador
        </Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={onSignOut}>
          Sair
        </Button>
      </div>
    </div>
  );
}
