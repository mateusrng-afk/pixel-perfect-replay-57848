import type { Barber, BarberService, BusinessHour, Service } from "./types";

export const SEED_BARBERS: Barber[] = [
  { id: "b-genario", name: "Genario", active: true },
  { id: "b-devanio", name: "Devanio", active: true },
  { id: "b-adenilson", name: "Adenilson", active: true },
  { id: "b-mateus", name: "Mateus", active: true },
];

export const SEED_SERVICES: Service[] = [
  { id: "s-corte", name: "Corte", price: 30, duration_minutes: 30, active: true },
  { id: "s-barba", name: "Barba", price: 20, duration_minutes: 30, active: true },
  { id: "s-pigmentacao", name: "Pigmentação", price: 15, duration_minutes: 30, active: true },
  { id: "s-corte-barba", name: "Corte + barba", price: 50, duration_minutes: 60, active: true },
  { id: "s-barba-pezinho", name: "Barba + pezinho", price: 25, duration_minutes: 30, active: true },
  { id: "s-pezinho", name: "Pezinho", price: 5, duration_minutes: 15, active: true },
  { id: "s-sobrancelha", name: "Sobrancelha", price: 5, duration_minutes: 15, active: true },
  { id: "s-luzes", name: "Luzes", price: 65, duration_minutes: 90, active: true },
  { id: "s-nevou", name: "Nevou", price: 100, duration_minutes: 120, active: true },
];

export const SEED_BARBER_SERVICES: BarberService[] = SEED_BARBERS.flatMap((b) =>
  SEED_SERVICES.map((s) => ({ barber_id: b.id, service_id: s.id })),
);

export const SEED_HOURS: BusinessHour[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  day_of_week: d,
  open_time: "08:00",
  close_time: "19:00",
  is_closed: d === 0,
}));
