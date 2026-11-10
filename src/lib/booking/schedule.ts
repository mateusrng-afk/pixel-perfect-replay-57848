import type { Appointment, BusinessHour, Service } from "./types";

export const SLOT_STEP_MINUTES = 30;

export function timeToMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function totalPrice(services: Pick<Service, "price">[]): number {
  return services.reduce((sum, s) => sum + Number(s.price), 0);
}

export function totalDuration(services: Pick<Service, "duration_minutes">[]): number {
  return services.reduce((sum, s) => sum + Number(s.duration_minutes), 0);
}

export function hoursForDate(hours: BusinessHour[], date: Date): BusinessHour | undefined {
  return hours.find((h) => h.day_of_week === date.getDay());
}

export function isClosedOn(hours: BusinessHour[], date: Date): boolean {
  const h = hoursForDate(hours, date);
  return !h || h.is_closed;
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** True when an active appointment already occupies part of [start, start+duration). */
export function isSlotTaken(
  start: number,
  duration: number,
  appointments: Pick<Appointment, "start_time" | "end_time" | "status">[],
): boolean {
  const end = start + duration;
  return appointments.some(
    (a) =>
      a.status !== "cancelled" &&
      overlaps(start, end, timeToMinutes(a.start_time), timeToMinutes(a.end_time)),
  );
}

/**
 * Start times (every 30 min) where the whole procedure fits inside opening hours,
 * does not overlap the barber's active appointments and is not in the past.
 */
export function availableSlots(params: {
  date: Date;
  hours: BusinessHour[];
  appointments: Pick<Appointment, "start_time" | "end_time" | "status">[];
  duration: number;
  now?: Date;
  step?: number;
}): string[] {
  const { date, hours, appointments, duration, now = new Date(), step = SLOT_STEP_MINUTES } =
    params;
  const day = hoursForDate(hours, date);
  if (!day || day.is_closed || duration <= 0) return [];

  const open = timeToMinutes(day.open_time);
  const close = timeToMinutes(day.close_time);
  const isToday = toDateKey(date) === toDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (toDateKey(date) < toDateKey(now)) return [];

  const slots: string[] = [];
  for (let t = open; t + duration <= close; t += step) {
    if (isToday && t <= nowMinutes) continue;
    if (isSlotTaken(t, duration, appointments)) continue;
    slots.push(minutesToTime(t));
  }
  return slots;
}
