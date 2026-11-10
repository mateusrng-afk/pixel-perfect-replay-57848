import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Clock, MapPin, Scissors } from "lucide-react";

import heroImg from "@/assets/hero-barbearia.jpg";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agende seu horário · Barbearia Genario Souza" },
      {
        name: "description",
        content:
          "Escolha seu barbeiro, os serviços e o melhor horário. Agendamento online na Barbearia Genario Souza.",
      },
      { property: "og:title", content: "Agende seu horário · Barbearia Genario Souza" },
      {
        property: "og:description",
        content: "Escolha seu barbeiro, os serviços e o melhor horário em poucos toques.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="relative isolate overflow-hidden">
        <img
          src={heroImg}
          alt="Interior da Barbearia Genario Souza"
          width={1600}
          height={1008}
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-hero" />

        <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <BrandMark />
          <Link
            to="/admin"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-gold"
          >
            Painel
          </Link>
        </nav>

        <div className="mx-auto flex min-h-[62vh] max-w-5xl flex-col justify-end px-5 pb-14 pt-24 sm:min-h-[70vh]">
          <p className="eyebrow animate-fade-up">Barbearia premium</p>
          <h1 className="animate-fade-up mt-3 max-w-2xl text-5xl font-semibold leading-[0.95] sm:text-7xl">
            Estilo afiado,
            <br />
            <span className="text-gradient-gold italic">horário garantido.</span>
          </h1>
          <p className="mt-5 max-w-md text-base text-muted-foreground">
            Escolha seu barbeiro, os serviços e o melhor horário em poucos toques — sem baixar nada.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button variant="gold" size="xl" asChild>
              <a href="#agendar">
                <CalendarCheck /> Agendar horário
              </a>
            </Button>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4 text-gold" /> Seg a Sáb · 08h às 19h
            </span>
          </div>
        </div>
      </header>

      {/* Booking */}
      <main id="agendar" className="mx-auto max-w-5xl scroll-mt-4 px-5 pb-16 pt-12">
        <div className="mb-8 flex items-center gap-4">
          <Scissors className="size-5 text-gold" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Agendamento online
          </h2>
          <div className="gold-rule flex-1" />
        </div>
        <BookingFlow />
      </main>

      <footer className="border-t">
        <div className="mx-auto grid max-w-5xl gap-8 px-5 py-10 sm:grid-cols-3">
          <BrandMark />
          <div className="text-sm">
            <p className="eyebrow mb-2">Funcionamento</p>
            <p>Segunda a sábado: 08h às 19h</p>
            <p className="text-muted-foreground">Domingo: fechado</p>
          </div>
          <div className="text-sm">
            <p className="eyebrow mb-2">Visite-nos</p>
            <p className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0 text-gold" /> Barbearia Genario Souza
            </p>
          </div>
        </div>
        <p className="pb-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Barbearia Genario Souza
        </p>
      </footer>
    </div>
  );
}
