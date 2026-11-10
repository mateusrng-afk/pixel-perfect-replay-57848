/** Pure conversions between database rows and app types. */
import type { Tables } from "@/integrations/supabase/types";
import { fromDateKey, minutesToTime, timeToMinutes, toDateKey } from "./schedule";
import type { Appointment, AppointmentStatus, Barber, BarberBreak, BusinessHour, Service } from "./types";

export const SHOP_TIME_ZONE = "America/Maceio";
/** Maceió has no daylight saving time. */
export const SHOP_UTC_OFFSET = "-03:00";

const DEFAULT_OPEN = "08:00";
const DEFAULT_CLOSE = "19:00";

export function shopDateTime(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Start of the given shop-local day as an ISO timestamp with offset. */
export function shopDayStart(dateKey: string): string {
  return `${dateKey}T00:00:00${SHOP_UTC_OFFSET}`;
}

export function shopNextDayStart(dateKey: string): string {
  const d = fromDateKey(dateKey);
  d.setDate(d.getDate() + 1);
  return shopDayStart(toDateKey(d));
}

function parseSelected(value: unknown): { id: string; name: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [{ id: item, name: "" }];
    if (item && typeof item === "object" && "id" in item) {
      const o = item as { id: unknown; name?: unknown };
      return [{ id: String(o.id), name: typeof o.name === "string" ? o.name : "" }];
    }
    return [];
  });
}

export function mapAppointment(row: Tables<"appointments">): Appointment {
  const { date, time } = shopDateTime(row.appointment_at);
  const selected = parseSelected(row.selected_services);
  return {
    id: row.id,
    barber_id: row.barber_id ?? "",
    client_name: row.client_name,
    client_phone: row.client_phone,
    date,
    start_time: time,
    end_time: minutesToTime(timeToMinutes(time) + row.total_duration),
    service_ids: selected.map((s) => s.id),
    service_names: selected.map((s) => s.name).filter(Boolean),
    total_price: Number(row.total_price),
    total_duration: row.total_duration,
    status: row.status as AppointmentStatus,
    created_at: row.created_at ?? "",
  };
}

export function mapBusinessHour(row: Tables<"business_hours">): BusinessHour {
  return {
    barber_id: row.barber_id,
    day_of_week: row.weekday,
    open_time: row.opening_time?.slice(0, 5) ?? DEFAULT_OPEN,
    close_time: row.closing_time?.slice(0, 5) ?? DEFAULT_CLOSE,
    is_closed: Boolean(row.is_closed) || !row.opening_time || !row.closing_time,
  };
}

export function mapService(row: Tables<"services">): Service {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    duration_minutes: row.duration_minutes,
    active: row.active ?? true,
  };
}

export function mapBarber(row: Pick<Tables<"barbers">, "id" | "name" | "active">): Barber {
  return { id: row.id, name: row.name, active: row.active ?? true };
}

export function mapBarberBreak(row: Tables<"barber_breaks">): BarberBreak {
  return {
    barber_id: row.barber_id,
    start_time: row.start_time.slice(0, 5),
    end_time: row.end_time.slice(0, 5),
  };
}
