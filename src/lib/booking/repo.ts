/**
 * Data access for the booking system, backed by the barbershop's database.
 * Clients book only through the book_appointment database function, which
 * computes price/duration and refuses overlapping times (also under concurrency).
 */
import { supabase } from "@/integrations/supabase/client";
import { notifyBookingWhatsApp } from "@/lib/whatsapp/notify.functions";
import {
  mapAppointment,
  mapBarber,
  mapBarberBreak,
  mapBusinessHour,
  mapService,
  shopDayStart,
  shopNextDayStart,
} from "./mappers";
import type {
  Appointment,
  AppointmentEdit,
  AppointmentFilter,
  AppointmentStatus,
  Barber,
  BarberBreak,
  BarberService,
  BusinessHour,
  BusyTime,
  NewAppointment,
  Service,
} from "./types";

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function listBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase
    .from("barbers")
    .select("id, name, active")
    .eq("active", true)
    .order("name");
  check(error);
  return (data ?? []).map(mapBarber);
}

export async function listServices(): Promise<Service[]> {
  const { data, error } = await supabase.from("services").select("*").order("price").order("name");
  check(error);
  return (data ?? []).map(mapService);
}

export async function listBarberServices(): Promise<BarberService[]> {
  const { data, error } = await supabase.from("barber_services").select("barber_id, service_id");
  check(error);
  return data ?? [];
}

export async function listBusinessHours(): Promise<BusinessHour[]> {
  const { data, error } = await supabase.from("business_hours").select("*").order("weekday");
  check(error);
  return (data ?? []).map(mapBusinessHour);
}

/** Admin only (protected by database rules). */
export async function listAppointments(filter: AppointmentFilter = {}): Promise<Appointment[]> {
  let q = supabase.from("appointments").select("*").order("appointment_at");
  if (filter.barberId) q = q.eq("barber_id", filter.barberId);
  if (filter.date) q = q.gte("appointment_at", shopDayStart(filter.date)).lt("appointment_at", shopNextDayStart(filter.date));
  if (filter.fromDate) q = q.gte("appointment_at", shopDayStart(filter.fromDate));
  const { data, error } = await q;
  check(error);
  return (data ?? []).map(mapAppointment);
}

/** Public: which times a barber is busy on a day, without client data. */
export async function listBusyTimes(barberId: string, date: string): Promise<BusyTime[]> {
  const { data, error } = await supabase.rpc("get_busy_times", { _barber_id: barberId, _day: date });
  check(error);
  return (data ?? []).map((b) => ({ ...b, status: "pending" as const }));
}

export class SlotUnavailableError extends Error {
  constructor() {
    super("Esse horário acabou de ser reservado. Escolha outro, por favor.");
  }
}

export class BookingError extends Error {}

const SLOT_ERRORS = ["SLOT_TAKEN", "SLOT_IN_PAST", "OUTSIDE_HOURS", "LUNCH_BREAK"];
const BOOKING_MESSAGES: Record<string, string> = {
  INVALID_NAME: "Informe seu nome.",
  INVALID_PHONE: "Informe um telefone com DDD.",
  INVALID_BARBER: "Esse barbeiro não está disponível. Escolha outro.",
  INVALID_SERVICES: "Algum serviço escolhido não está mais disponível. Revise os serviços.",
};

export async function createAppointment(input: NewAppointment): Promise<Appointment> {
  const { data, error } = await supabase.rpc("book_appointment", {
    _barber_id: input.barber_id,
    _client_name: input.client_name,
    _client_phone: input.client_phone,
    _day: input.date,
    _start_time: input.start_time,
    _service_ids: input.service_ids,
  });
  if (error) {
    if (SLOT_ERRORS.includes(error.message)) throw new SlotUnavailableError();
    throw new BookingError(BOOKING_MESSAGES[error.message] ?? "Não foi possível confirmar. Tente novamente.");
  }
  const r = data as {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    total_price: number;
    total_duration: number;
  };
  notifyBooking(r.id);
  return {
    ...input,
    id: r.id,
    date: r.date,
    start_time: r.start_time,
    end_time: r.end_time,
    service_names: [],
    total_price: Number(r.total_price),
    total_duration: r.total_duration,
    status: "pending",
    created_at: new Date().toISOString(),
  };
}

/** Fire-and-forget WhatsApp notice; a failure here never undoes or blocks the booking. */
function notifyBooking(appointmentId: string) {
  try {
    notifyBookingWhatsApp({ data: { appointment_id: appointmentId } }).catch(() => undefined);
  } catch {
    // ignore: the booking is already saved
  }
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus) {
  const { data, error } = await supabase.from("appointments").update({ status }).eq("id", id).select("id");
  check(error);
  if (!data?.length) throw new Error("Sem permissão para alterar este agendamento.");
}

export async function saveService(service: Omit<Service, "id"> & { id?: string | undefined }): Promise<Service> {
  const fields = {
    name: service.name,
    price: service.price,
    duration_minutes: service.duration_minutes,
    active: service.active,
  };
  const { data, error } = service.id
    ? await supabase.from("services").update(fields).eq("id", service.id).select().single()
    : await supabase.from("services").insert(fields).select().single();
  check(error);
  return mapService(data!);
}

export async function setServiceBarbers(serviceId: string, barberIds: string[]) {
  const { error } = await supabase.from("barber_services").delete().eq("service_id", serviceId);
  check(error);
  if (!barberIds.length) return;
  const { error: insertError } = await supabase
    .from("barber_services")
    .insert(barberIds.map((barber_id) => ({ barber_id, service_id: serviceId })));
  check(insertError);
}

/** Applies each weekday's hours to every barber. */
export async function saveBusinessHours(hours: BusinessHour[]) {
  const results = await Promise.all(
    hours.map((h) =>
      supabase
        .from("business_hours")
        .update({ opening_time: h.open_time, closing_time: h.close_time, is_closed: h.is_closed })
        .eq("weekday", h.day_of_week),
    ),
  );
  for (const r of results) check(r.error);
}

/** Admin only (protected by database rules). */
export async function listBarberBreaks(): Promise<BarberBreak[]> {
  const { data, error } = await supabase.from("barber_breaks").select("*");
  check(error);
  return (data ?? []).map(mapBarberBreak);
}

/** Saves one barber's lunch break; `null` removes it. Other barbers are untouched. */
export async function saveBarberBreak(barberId: string, period: { start_time: string; end_time: string } | null) {
  if (!period) {
    const { error } = await supabase.from("barber_breaks").delete().eq("barber_id", barberId);
    check(error);
    return;
  }
  const { data, error } = await supabase
    .from("barber_breaks")
    .upsert({ barber_id: barberId, start_time: period.start_time, end_time: period.end_time })
    .select("barber_id");
  check(error);
  if (!data?.length) throw new Error("Sem permissão para alterar o almoço.");
}

const EDIT_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Sem permissão para editar agendamentos.",
  NOT_FOUND: "Agendamento não encontrado.",
  APPOINTMENT_CANCELLED: "Agendamentos cancelados não podem ser editados.",
  INVALID_BARBER: "Esse barbeiro não está disponível.",
  INVALID_SERVICES: "Escolha serviços que esse barbeiro faz.",
  SLOT_TAKEN: "Esse horário já está ocupado para esse barbeiro.",
  SLOT_IN_PAST: "Esse horário já passou.",
  OUTSIDE_HOURS: "Fora do horário de funcionamento desse barbeiro.",
  LUNCH_BREAK: "Esse horário cai no almoço do barbeiro.",
};

/** Admin only: change date, time, barber and services; the database recomputes price and checks the slot. */
export async function updateAppointment(input: AppointmentEdit) {
  const { error } = await supabase.rpc("staff_update_appointment", {
    _id: input.id,
    _barber_id: input.barber_id,
    _day: input.date,
    _start_time: input.start_time,
    _service_ids: input.service_ids,
  });
  if (error) throw new BookingError(EDIT_MESSAGES[error.message] ?? "Não foi possível salvar a alteração.");
}

const DELETE_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Sem permissão para excluir este agendamento.",
  NOT_FOUND: "Agendamento não encontrado. Ele pode já ter sido excluído.",
};

/** Staff only: deletes the appointment for good (admin any, barber only own). The client record stays. */
export async function deleteAppointmentPermanently(id: string) {
  const { error } = await supabase.rpc("staff_delete_appointment", { _id: id });
  if (error) throw new BookingError(DELETE_MESSAGES[error.message] ?? "Não foi possível excluir o agendamento.");
}
