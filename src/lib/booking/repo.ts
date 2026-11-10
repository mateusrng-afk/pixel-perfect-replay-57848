/**
 * Data access for the booking system. Temporary browser storage implementation;
 * swap these functions for database queries without touching the UI.
 */
import { isSlotTaken, minutesToTime, timeToMinutes, totalDuration, totalPrice } from "./schedule";
import { SEED_BARBERS, SEED_BARBER_SERVICES, SEED_HOURS, SEED_SERVICES } from "./seed";
import type {
  Appointment,
  AppointmentFilter,
  AppointmentStatus,
  Barber,
  BarberService,
  BusinessHour,
  NewAppointment,
  Service,
} from "./types";

interface Store {
  barbers: Barber[];
  services: Service[];
  barber_services: BarberService[];
  business_hours: BusinessHour[];
  appointments: Appointment[];
}

const KEY = "gs-barbearia-v1";

function seed(): Store {
  return {
    barbers: SEED_BARBERS,
    services: SEED_SERVICES,
    barber_services: SEED_BARBER_SERVICES,
    business_hours: SEED_HOURS,
    appointments: [],
  };
}

function read(): Store {
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...seed(), ...JSON.parse(raw) };
  } catch {
    /* ignore corrupted storage */
  }
  const s = seed();
  write(s);
  return s;
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(store));
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export async function listBarbers(): Promise<Barber[]> {
  return read().barbers.filter((b) => b.active);
}

export async function listServices(): Promise<Service[]> {
  return [...read().services].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
}

export async function listBarberServices(): Promise<BarberService[]> {
  return read().barber_services;
}

export async function listBusinessHours(): Promise<BusinessHour[]> {
  return [...read().business_hours].sort((a, b) => a.day_of_week - b.day_of_week);
}

export async function listAppointments(filter: AppointmentFilter = {}): Promise<Appointment[]> {
  return read()
    .appointments.filter(
      (a) =>
        (!filter.barberId || a.barber_id === filter.barberId) &&
        (!filter.date || a.date === filter.date) &&
        (!filter.fromDate || a.date >= filter.fromDate),
    )
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
}

export class SlotUnavailableError extends Error {
  constructor() {
    super("Esse horário acabou de ser reservado. Escolha outro, por favor.");
  }
}

export async function createAppointment(input: NewAppointment): Promise<Appointment> {
  const store = read();
  const services = store.services.filter((s) => input.service_ids.includes(s.id));
  const duration = totalDuration(services);
  const start = timeToMinutes(input.start_time);
  const sameDay = store.appointments.filter(
    (a) => a.barber_id === input.barber_id && a.date === input.date,
  );
  if (isSlotTaken(start, duration, sameDay)) throw new SlotUnavailableError();

  const appointment: Appointment = {
    id: uid(),
    ...input,
    end_time: minutesToTime(start + duration),
    total_price: totalPrice(services),
    status: "pending",
    created_at: new Date().toISOString(),
  };
  store.appointments.push(appointment);
  write(store);
  return appointment;
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus) {
  const store = read();
  store.appointments = store.appointments.map((a) => (a.id === id ? { ...a, status } : a));
  write(store);
}

export async function saveService(service: Omit<Service, "id"> & { id?: string | undefined }): Promise<Service> {
  const store = read();
  if (service.id) {
    const saved = service as Service;
    store.services = store.services.map((s) => (s.id === saved.id ? saved : s));
    write(store);
    return saved;
  }
  const created: Service = { ...service, id: uid() };
  store.services.push(created);
  store.barber_services.push(
    ...store.barbers.map((b) => ({ barber_id: b.id, service_id: created.id })),
  );
  write(store);
  return created;
}

export async function setServiceBarbers(serviceId: string, barberIds: string[]) {
  const store = read();
  store.barber_services = [
    ...store.barber_services.filter((bs) => bs.service_id !== serviceId),
    ...barberIds.map((barber_id) => ({ barber_id, service_id: serviceId })),
  ];
  write(store);
}

export async function saveBusinessHours(hours: BusinessHour[]) {
  const store = read();
  store.business_hours = hours;
  write(store);
}
