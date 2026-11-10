import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { CalendarDays, Clock, ExternalLink, ListChecks, Scissors } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

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

function AdminLayout() {
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
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground hover:text-gold"
          >
            Página do cliente <ExternalLink className="size-3.5" />
          </Link>
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
