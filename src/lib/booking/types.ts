export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface Barber {
  id: string;
  name: string;
  active: boolean;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  active: boolean;
}

/** A service with no rows here is offered by every barber. */
export interface BarberService {
  barber_id: string;
  service_id: string;
}

/** day_of_week: 0 = domingo ... 6 = sábado. Times as "HH:mm". barber_id null = whole shop. */
export interface BusinessHour {
  barber_id: string | null;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

/** A barber's daily lunch break, "HH:mm". Blocks bookings on every open day. */
export interface BarberBreak {
  barber_id: string;
  start_time: string;
  end_time: string;
}

export interface Appointment {
  id: string;
  barber_id: string;
  client_name: string;
  client_phone: string;
  /** "yyyy-MM-dd" in the barbershop's time zone */
  date: string;
  /** "HH:mm" */
  start_time: string;
  /** "HH:mm" */
  end_time: string;
  service_ids: string[];
  service_names: string[];
  total_price: number;
  total_duration: number;
  status: AppointmentStatus;
  created_at: string;
}

/** Busy period for one barber; never carries client data. */
export interface BusyTime {
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
}

export interface NewAppointment {
  barber_id: string;
  client_name: string;
  client_phone: string;
  date: string;
  start_time: string;
  service_ids: string[];
}

export interface AppointmentFilter {
  barberId?: string | undefined;
  date?: string | undefined;
  fromDate?: string | undefined;
}

export interface AppointmentEdit {
  id: string;
  barber_id: string;
  date: string;
  start_time: string;
  service_ids: string[];
}
