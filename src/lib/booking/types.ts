export type AppointmentStatus = "pending" | "confirmed" | "cancelled";

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

export interface BarberService {
  barber_id: string;
  service_id: string;
}

/** day_of_week: 0 = domingo ... 6 = sábado. Times as "HH:mm". */
export interface BusinessHour {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface Appointment {
  id: string;
  barber_id: string;
  client_name: string;
  client_phone: string;
  /** "yyyy-MM-dd" */
  date: string;
  /** "HH:mm" */
  start_time: string;
  /** "HH:mm" */
  end_time: string;
  service_ids: string[];
  total_price: number;
  status: AppointmentStatus;
  created_at: string;
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
